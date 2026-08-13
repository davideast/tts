import { describe, expect, it } from 'bun:test';
import { LiveAudioPlayerSink } from './live-audio-player-sink.js';
import type { IAudioPlayer } from './player/audio-player.interface.js';
import { ChunkQueueAudioPlayer, detectSystemAudioPlayer } from './player/chunk-queue-audio-player.js';
import { UniversalEventBus } from '../pipeline/pipeline-event-bus.js';

class MockAudioPlayer implements IAudioPlayer {
  public playedChunks: { index: number; byteLength: number }[] = [];
  public isStopped = false;
  private pendingQueue: Promise<void> = Promise.resolve();

  async playChunk(chunkIndex: number, wavBuffer: Uint8Array): Promise<void> {
    this.playedChunks.push({
      index: chunkIndex,
      byteLength: wavBuffer.byteLength,
    });
    // Simulate brief playback delay
    this.pendingQueue = this.pendingQueue.then(
      () => new Promise((res) => setTimeout(res, 20))
    );
    await this.pendingQueue;
  }

  async stop(): Promise<void> {
    this.isStopped = true;
  }

  async waitForIdle(): Promise<void> {
    await this.pendingQueue;
  }
}

describe('LiveAudioPlayerSink - TDD Unit Tests', () => {
  it('buffers PCM deltas per chunk and plays complete WAV on chunk:complete', async () => {
    const player = new MockAudioPlayer();
    const eventBus = new UniversalEventBus();
    const sink = new LiveAudioPlayerSink(player);
    sink.attachToEventBus(eventBus, 24000, 1, 16);

    const chunk1Delta1 = new Uint8Array([1, 2, 3]);
    const chunk1Delta2 = new Uint8Array([4, 5, 6]);

    eventBus.emit('audio:delta', { chunkIndex: 0, audioData: chunk1Delta1 });
    eventBus.emit('audio:delta', { chunkIndex: 0, audioData: chunk1Delta2 });
    eventBus.emit('chunk:complete', { chunkIndex: 0 });

    const chunk2Delta1 = new Uint8Array([10, 20, 30, 40]);
    eventBus.emit('audio:delta', { chunkIndex: 1, audioData: chunk2Delta1 });
    eventBus.emit('chunk:complete', { chunkIndex: 1 });

    await sink.waitForPlaybackComplete();

    expect(player.playedChunks.length).toBe(2);
    // 44-byte header + 6 bytes PCM = 50
    expect(player.playedChunks[0]).toEqual({ index: 0, byteLength: 50 });
    // 44-byte header + 4 bytes PCM = 48
    expect(player.playedChunks[1]).toEqual({ index: 1, byteLength: 48 });
  });

  it('preserves strict sequential order for rapid multi-chunk pipelines', async () => {
    const player = new MockAudioPlayer();
    const eventBus = new UniversalEventBus();
    const sink = new LiveAudioPlayerSink(player);
    sink.attachToEventBus(eventBus);

    for (let c = 0; c < 5; c++) {
      eventBus.emit('audio:delta', { chunkIndex: c, audioData: new Uint8Array([c, c + 1]) });
      eventBus.emit('chunk:complete', { chunkIndex: c });
    }

    await sink.waitForPlaybackComplete();

    expect(player.playedChunks.length).toBe(5);
    for (let c = 0; c < 5; c++) {
      expect(player.playedChunks[c].index).toBe(c);
    }
  });

  it('stops playback immediately on pipeline:error', async () => {
    const player = new MockAudioPlayer();
    const eventBus = new UniversalEventBus();
    const sink = new LiveAudioPlayerSink(player);
    sink.attachToEventBus(eventBus);

    eventBus.emit('audio:delta', { chunkIndex: 0, audioData: new Uint8Array([1, 2]) });
    eventBus.emit('pipeline:error', { error: new Error('Network timeout') });

    expect(player.isStopped).toBe(true);
  });

  it('ChunkQueueAudioPlayer detects appropriate system audio player', () => {
    const detected = detectSystemAudioPlayer();
    if (process.platform === 'darwin') {
      expect(detected).toContain('afplay');
    } else {
      expect(detected).toBe('aplay');
    }
  });

  it('ChunkQueueAudioPlayer handles graceful execution and cleanup', async () => {
    // Use a mock non-destructive player command (like `true` or `echo`)
    const player = new ChunkQueueAudioPlayer('true');
    const fakeWav = new Uint8Array(44);

    await player.playChunk(0, fakeWav);
    await player.playChunk(1, fakeWav);
    await player.waitForIdle();

    await player.stop();
  });
});
