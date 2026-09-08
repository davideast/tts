import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWavHeader } from '../wav-header.js';
import type { IAudioPlayer } from './audio-player.interface.js';

export function detectSystemAudioPlayer(): string {
  if (process.platform === 'darwin') {
    if (fs.existsSync('/usr/bin/afplay')) return '/usr/bin/afplay';
    return 'afplay';
  }
  return 'aplay';
}

const BYTES_PER_MS = 48; // 24000 Hz * 1 channel * 2 bytes/sample = 48000 bytes/sec = 48 bytes/ms
const RESUME_OVERLAP_MS = 180; // Rewind 180ms on resume so no syllable is clipped

export class ChunkQueueAudioPlayer implements IAudioPlayer {
  private activeProcess?: ChildProcess;
  private isAborted = false;
  private isPaused = false;
  private wasPausedDuringPlayback = false;
  private queue: Promise<void> = Promise.resolve();
  private readonly playerCommand: string;

  constructor(playerCommand?: string) {
    this.playerCommand = playerCommand ?? detectSystemAudioPlayer();
  }

  reset(): void {
    this.isAborted = false;
    this.isPaused = false;
    this.wasPausedDuringPlayback = false;
  }

  togglePause(): boolean {
    this.isPaused = !this.isPaused;
    if (this.isPaused && this.activeProcess) {
      // Mark that we interrupted active playback and kill afplay immediately so CoreAudio buffer stops
      this.wasPausedDuringPlayback = true;
      try {
        this.activeProcess.kill('SIGTERM');
      } catch {}
    }
    return this.isPaused;
  }

  async playChunk(chunkIndex: number, wavBuffer: Uint8Array): Promise<void> {
    if (this.isAborted) return;

    this.queue = this.queue.then(async () => {
      if (this.isAborted) return;

      // Extract raw PCM bytes after the 44-byte WAV header
      const fullPcm = wavBuffer.byteLength > 44 ? wavBuffer.subarray(44) : wavBuffer;
      let offsetBytes = 0;

      while (offsetBytes < fullPcm.byteLength && !this.isAborted) {
        // Wait while paused before spawning afplay
        while (this.isPaused && !this.isAborted) {
          await new Promise((r) => setTimeout(r, 60));
        }
        if (this.isAborted) break;

        const remainingPcm = fullPcm.subarray(offsetBytes);
        const wavHeader = createWavHeader(remainingPcm.byteLength);
        const slicedWav = new Uint8Array(44 + remainingPcm.byteLength);
        slicedWav.set(wavHeader, 0);
        slicedWav.set(remainingPcm, 44);

        const tempFile = path.join(
          os.tmpdir(),
          `tts_live_chunk_${Date.now()}_${chunkIndex}_${Math.random().toString(36).slice(2, 6)}.wav`
        );

        let segmentStartTime = performance.now();
        this.wasPausedDuringPlayback = false;

        try {
          await writeFile(tempFile, slicedWav);

          await new Promise<void>((resolvePromise) => {
            if (this.isAborted) {
              resolvePromise();
              return;
            }

            segmentStartTime = performance.now();
            const child = spawn(this.playerCommand, [tempFile], {
              stdio: 'ignore',
            });
            this.activeProcess = child;

            if (this.isPaused) {
              this.wasPausedDuringPlayback = true;
              try {
                child.kill('SIGTERM');
              } catch {}
            }

            child.once('error', (err) => {
              this.activeProcess = undefined;
              console.warn(`[AudioPlayer] Warning: Failed to spawn ${this.playerCommand}:`, err.message);
              resolvePromise();
            });

            child.once('close', () => {
              this.activeProcess = undefined;
              resolvePromise();
            });
          });

          if (this.wasPausedDuringPlayback && !this.isAborted) {
            // Calculate exact elapsed PCM bytes before pause, rewinding slightly for seamless syllable continuity
            const elapsedMs = performance.now() - segmentStartTime;
            const effectiveMs = Math.max(0, elapsedMs - RESUME_OVERLAP_MS);
            let advancedBytes = Math.floor(effectiveMs * BYTES_PER_MS);
            advancedBytes -= advancedBytes % 2; // Keep 16-bit sample alignment
            offsetBytes = Math.min(fullPcm.byteLength, offsetBytes + advancedBytes);
          } else {
            // Completed normally without pause interruption
            offsetBytes = fullPcm.byteLength;
          }
        } finally {
          if (fs.existsSync(tempFile)) {
            await unlink(tempFile).catch(() => {});
          }
        }
      }
    });

    return this.queue;
  }

  async stop(): Promise<void> {
    this.isAborted = true;
    this.isPaused = false;
    this.wasPausedDuringPlayback = false;
    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM');
      } catch {}
      this.activeProcess = undefined;
    }
  }

  async waitForIdle(): Promise<void> {
    await this.queue;
  }
}
