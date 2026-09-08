import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWavHeader } from '../wav-header.js';
import { detectSystemAudioPlayer } from './chunk-queue-audio-player.js';
import type { TrackMetadata } from '../../storage/types.js';
import type { PlaybackEngineEvents, PlaybackStatus, PlaybackTimeUpdate } from './types.js';

const BYTES_PER_MS = 48; // 24kHz * 1 channel * 2 bytes/sample = 48 bytes/ms
const RESUME_OVERLAP_MS = 150; // 150ms rewind to prevent syllable clipping

export class PlaybackEngine extends EventEmitter {
  public status: PlaybackStatus = 'idle';
  public rate = 1.0;
  public positionMs = 0;
  public durationMs = 0;
  public currentTrack: TrackMetadata | null = null;
  public queue: TrackMetadata[] = [];
  public history: TrackMetadata[] = [];

  private fullPcm: Uint8Array | null = null;
  private activeProcess?: ChildProcess;
  private activeTempFile?: string;
  private tickerInterval?: Timer;
  private segmentStartTime = 0;
  private segmentStartOffsetMs = 0;
  private isInterrupted = false;
  private readonly playerCommand: string;

  constructor(playerCommand?: string) {
    super();
    this.playerCommand = playerCommand ?? detectSystemAudioPlayer();
  }

  public async load(track: TrackMetadata, autoPlay = true, recordHistory = true): Promise<void> {
    this.killActiveProcess();
    this.stopTicker();
    this.status = 'idle';
    if (recordHistory && this.currentTrack && this.currentTrack.id !== track.id) {
      this.history.push(this.currentTrack);
    }
    this.currentTrack = track;

    if (!fs.existsSync(track.audioPath)) {
      throw new Error(`Audio file not found at: ${track.audioPath}`);
    }

    const audioBuffer = fs.readFileSync(track.audioPath);
    // Skip 44-byte WAV header
    this.fullPcm = audioBuffer.byteLength > 44 ? audioBuffer.subarray(44) : audioBuffer;
    this.durationMs = Math.round(this.fullPcm.byteLength / BYTES_PER_MS);
    this.positionMs = 0;
    this.segmentStartOffsetMs = 0;

    this.emit('track:start', track);
    this.emitTimeUpdate();

    if (autoPlay) {
      await this.play();
    }
  }

  public async play(): Promise<void> {
    if (!this.fullPcm || this.status === 'playing') return;
    if (this.positionMs >= this.durationMs) {
      this.positionMs = 0;
    }

    this.status = 'playing';
    this.emit('status', this.status);
    this.startTicker();
    await this.spawnPlaybackSegment(this.positionMs);
  }

  public pause(): void {
    if (this.status !== 'playing') return;

    this.status = 'paused';
    this.stopTicker();
    this.captureCurrentPosition();
    this.killActiveProcess();
    this.emit('status', this.status);
    this.emitTimeUpdate();
  }

  public togglePause(): void {
    if (this.status === 'playing') {
      this.pause();
    } else {
      this.play().catch((err) => this.emit('error', err));
    }
  }

  public stop(): void {
    this.status = 'stopped';
    this.stopTicker();
    this.positionMs = 0;
    this.segmentStartOffsetMs = 0;
    this.killActiveProcess();
    this.emit('status', this.status);
    this.emitTimeUpdate();
  }

  public async seek(targetPositionMs: number): Promise<void> {
    if (!this.fullPcm) return;

    const clamped = Math.max(0, Math.min(this.durationMs, Math.round(targetPositionMs)));
    this.positionMs = clamped;
    this.segmentStartOffsetMs = clamped;
    this.segmentStartTime = performance.now();

    this.emitTimeUpdate();

    if (this.status === 'playing') {
      this.killActiveProcess();
      await this.spawnPlaybackSegment(clamped);
    }
  }

  public async scrub(deltaMs: number): Promise<void> {
    await this.seek(this.positionMs + deltaMs);
  }

  public async setRate(newRate: number): Promise<void> {
    const clamped = Math.max(0.5, Math.min(2.5, Math.round(newRate * 100) / 100));
    if (this.rate === clamped) return;

    if (this.status === 'playing') {
      this.captureCurrentPosition();
      this.rate = clamped;
      this.killActiveProcess();
      await this.spawnPlaybackSegment(this.positionMs);
    } else {
      this.rate = clamped;
    }

    this.emitTimeUpdate();
  }

  public enqueue(track: TrackMetadata): void {
    this.queue.push(track);
  }

  public async next(): Promise<void> {
    if (this.queue.length === 0) {
      this.stop();
      return;
    }
    const nextTrack = this.queue.shift()!;
    await this.load(nextTrack, true);
  }

  public async prev(): Promise<void> {
    if (this.positionMs > 2000 || this.history.length === 0) {
      await this.seek(0);
    } else {
      const prevTrack = this.history.pop()!;
      if (this.currentTrack) {
        this.queue.unshift(this.currentTrack);
      }
      await this.load(prevTrack, true, false);
    }
  }

  private async spawnPlaybackSegment(startMs: number): Promise<void> {
    if (!this.fullPcm || this.status !== 'playing') return;

    this.isInterrupted = false;
    let byteOffset = Math.floor(startMs * BYTES_PER_MS);
    byteOffset -= byteOffset % 2; // Keep 16-bit alignment

    const remainingPcm = this.fullPcm.subarray(byteOffset);
    if (remainingPcm.byteLength === 0) {
      await this.handleTrackCompleted();
      return;
    }

    const wavHeader = createWavHeader(remainingPcm.byteLength);
    const slicedWav = new Uint8Array(44 + remainingPcm.byteLength);
    slicedWav.set(wavHeader, 0);
    slicedWav.set(remainingPcm, 44);

    const tempFile = path.join(
      os.tmpdir(),
      `mdmedia_play_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.wav`
    );
    this.activeTempFile = tempFile;

    try {
      await writeFile(tempFile, slicedWav);

      if (this.status !== 'playing') {
        await unlink(tempFile).catch(() => {});
        return;
      }

      this.segmentStartTime = performance.now();
      this.segmentStartOffsetMs = startMs;

      const args = [tempFile];
      // macOS afplay supports -r for playback rate
      if (this.playerCommand.includes('afplay') && this.rate !== 1.0) {
        args.unshift('-r', this.rate.toFixed(2));
      }

      const child = spawn(this.playerCommand, args, { stdio: 'ignore' });
      this.activeProcess = child;

      child.once('error', (err) => {
        this.activeProcess = undefined;
        console.warn(`[PlaybackEngine] Failed to spawn ${this.playerCommand}:`, err.message);
      });

      child.once('close', async (code) => {
        this.activeProcess = undefined;
        if (tempFile) {
          await unlink(tempFile).catch(() => {});
        }

        if (!this.isInterrupted && this.status === 'playing') {
          // Completed naturally to end of track
          this.positionMs = this.durationMs;
          this.emitTimeUpdate();
          await this.handleTrackCompleted();
        }
      });
    } catch (err: any) {
      this.emit('error', err);
    }
  }

  private async handleTrackCompleted(): Promise<void> {
    const finishedTrack = this.currentTrack;
    this.status = 'stopped';
    this.stopTicker();
    this.emit('status', this.status);

    if (finishedTrack) {
      this.emit('track:end', finishedTrack);
    }

    if (this.queue.length > 0) {
      await this.next();
    }
  }

  private captureCurrentPosition(): void {
    if (this.status === 'playing' && this.segmentStartTime > 0) {
      const wallElapsedMs = performance.now() - this.segmentStartTime;
      const audioElapsedMs = wallElapsedMs * this.rate;
      const rawCurrentMs = this.segmentStartOffsetMs + audioElapsedMs;
      // Rewind slightly on pause to avoid clipping consonant
      const effectiveMs = Math.max(0, rawCurrentMs - RESUME_OVERLAP_MS);
      this.positionMs = Math.min(this.durationMs, Math.round(effectiveMs));
      this.segmentStartOffsetMs = this.positionMs;
    }
  }

  private killActiveProcess(): void {
    this.isInterrupted = true;
    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM');
      } catch {}
      this.activeProcess = undefined;
    }
  }

  private startTicker(): void {
    this.stopTicker();
    this.tickerInterval = setInterval(() => {
      if (this.status === 'playing' && this.segmentStartTime > 0) {
        const wallElapsedMs = performance.now() - this.segmentStartTime;
        const audioElapsedMs = wallElapsedMs * this.rate;
        this.positionMs = Math.min(
          this.durationMs,
          Math.round(this.segmentStartOffsetMs + audioElapsedMs)
        );
        this.emitTimeUpdate();
      }
    }, 100);
  }

  private stopTicker(): void {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = undefined;
    }
  }

  private emitTimeUpdate(): void {
    const progressPct =
      this.durationMs > 0
        ? Math.min(100, Math.round((this.positionMs / this.durationMs) * 1000) / 10)
        : 0;

    const data: PlaybackTimeUpdate = {
      positionMs: this.positionMs,
      durationMs: this.durationMs,
      progressPct,
      rate: this.rate,
    };

    this.emit('timeupdate', data);
  }
}
