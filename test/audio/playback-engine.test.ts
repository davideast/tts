import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PlaybackEngine } from '../../src/audio/player/playback-engine.js';
import { createWavHeader } from '../../src/audio/wav-header.js';
import type { TrackMetadata } from '../../src/storage/types.js';

describe('PlaybackEngine', () => {
  let tempDir: string;
  let testTrack: TrackMetadata;
  let engine: PlaybackEngine;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `mdmedia_test_engine_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // 1000ms duration at 48 bytes/ms = 48000 PCM bytes
    const pcmBytes = 48000;
    const header = createWavHeader(pcmBytes);
    const wavBuffer = new Uint8Array(44 + pcmBytes);
    wavBuffer.set(header, 0);

    const audioPath = path.join(tempDir, 'test_track.wav');
    fs.writeFileSync(audioPath, wavBuffer);

    testTrack = {
      id: 'test_s1',
      sessionId: 'test-session',
      stepIndex: 1,
      title: 'Test Audio Track',
      slug: 'test-audio-track',
      voice: 'Puck',
      durationMs: 1000,
      charCount: 50,
      chunkCount: 1,
      createdAt: new Date().toISOString(),
      audioPath,
      transcriptPath: path.join(tempDir, 'transcript.md'),
      metadataPath: path.join(tempDir, 'metadata.json'),
    };

    // Use a harmless no-op command for unit tests so we don't play system sound
    engine = new PlaybackEngine('/usr/bin/true');
  });

  afterEach(() => {
    engine.stop();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loads track and calculates duration correctly from PCM bytes', async () => {
    let started = false;
    engine.once('track:start', (track) => {
      started = true;
      expect(track.id).toBe('test_s1');
    });

    await engine.load(testTrack, false);

    expect(started).toBe(true);
    expect(engine.durationMs).toBe(1000);
    expect(engine.positionMs).toBe(0);
    expect(engine.status).toBe('idle');
  });

  it('seeks accurately within bounds and clamps out-of-range positions', async () => {
    await engine.load(testTrack, false);

    await engine.seek(500);
    expect(engine.positionMs).toBe(500);

    await engine.seek(1500); // Exceeds duration
    expect(engine.positionMs).toBe(1000);

    await engine.seek(-200); // Below 0
    expect(engine.positionMs).toBe(0);
  });

  it('scrubs relative time forward and backward', async () => {
    await engine.load(testTrack, false);

    await engine.seek(400);
    await engine.scrub(300);
    expect(engine.positionMs).toBe(700);

    await engine.scrub(-500);
    expect(engine.positionMs).toBe(200);
  });

  it('updates rate and clamps to supported bounds [0.5, 2.5]', async () => {
    await engine.load(testTrack, false);

    await engine.setRate(1.25);
    expect(engine.rate).toBe(1.25);

    await engine.setRate(3.0); // Exceeds max
    expect(engine.rate).toBe(2.5);

    await engine.setRate(0.2); // Below min
    expect(engine.rate).toBe(0.5);
  });

  it('manages sequential queue correctly', async () => {
    const track2: TrackMetadata = { ...testTrack, id: 'test_s2', title: 'Second Track' };

    await engine.load(testTrack, false);
    engine.enqueue(track2);

    expect(engine.queue.length).toBe(1);

    await engine.next();
    expect(engine.currentTrack?.id).toBe('test_s2');
    expect(engine.queue.length).toBe(0);
  });

  it('emits timeupdate events with accurate progress percentage', async () => {
    await engine.load(testTrack, false);

    let lastUpdate: any = null;
    engine.on('timeupdate', (update) => {
      lastUpdate = update;
    });

    await engine.seek(500);

    expect(lastUpdate).not.toBeNull();
    expect(lastUpdate.positionMs).toBe(500);
    expect(lastUpdate.durationMs).toBe(1000);
    expect(lastUpdate.progressPct).toBe(50);
  });

  it('prev() seeks to 0 when positionMs > 2000 and navigates to previous track when positionMs <= 2000', async () => {
    // Create a 3000ms track so we can seek past 2000ms
    const pcm3000 = 144000;
    const header3000 = createWavHeader(pcm3000);
    const buf3000 = new Uint8Array(44 + pcm3000);
    buf3000.set(header3000, 0);
    const longAudioPath = path.join(tempDir, 'long_track.wav');
    fs.writeFileSync(longAudioPath, buf3000);

    const track1: TrackMetadata = { ...testTrack, id: 'track_1', audioPath: longAudioPath, durationMs: 3000 };
    const track2: TrackMetadata = { ...testTrack, id: 'track_2', audioPath: longAudioPath, durationMs: 3000 };

    await engine.load(track1, false);
    await engine.load(track2, false); // pushes track1 to history

    expect(engine.currentTrack?.id).toBe('track_2');
    expect(engine.history.length).toBe(1);

    // When > 2000ms, prev() rewinds current track to 0
    await engine.seek(2500);
    await engine.prev();
    expect(engine.currentTrack?.id).toBe('track_2');
    expect(engine.positionMs).toBe(0);

    // When <= 2000ms, prev() pops from history and unshifts current track to queue
    await engine.prev();
    expect(engine.currentTrack?.id).toBe('track_1');
    expect(engine.history.length).toBe(0);
    expect(engine.queue[0]?.id).toBe('track_2');
  });
});
