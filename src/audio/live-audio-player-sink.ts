import type { UniversalEventBus } from '../pipeline/pipeline-event-bus.js';
import type { IAudioPlayer } from './player/audio-player.interface.js';
import { createWavHeader } from './wav-header.js';

export class LiveAudioPlayerSink {
  private readonly chunkBuffers = new Map<number, Uint8Array[]>();
  private unsubscribeDelta?: () => void;
  private unsubscribeComplete?: () => void;
  private unsubscribeError?: () => void;

  constructor(private readonly player: IAudioPlayer) {}

  attachToEventBus(
    eventBus: UniversalEventBus,
    sampleRate = 24000,
    channels = 1,
    bitDepth = 16
  ): void {
    this.unsubscribeDelta = eventBus.on('audio:delta', ({ chunkIndex, audioData }) => {
      let buffers = this.chunkBuffers.get(chunkIndex);
      if (!buffers) {
        buffers = [];
        this.chunkBuffers.set(chunkIndex, buffers);
      }
      buffers.push(audioData);
    });

    this.unsubscribeComplete = eventBus.on('chunk:complete', ({ chunkIndex }) => {
      const buffers = this.chunkBuffers.get(chunkIndex) ?? [];
      this.chunkBuffers.delete(chunkIndex);

      const totalPCMBytes = buffers.reduce((acc, b) => acc + b.byteLength, 0);
      const header = createWavHeader(totalPCMBytes, sampleRate, channels, bitDepth);

      const wavBuffer = new Uint8Array(44 + totalPCMBytes);
      wavBuffer.set(header, 0);

      let offset = 44;
      for (const pcm of buffers) {
        wavBuffer.set(pcm, offset);
        offset += pcm.byteLength;
      }

      this.player.playChunk(chunkIndex, wavBuffer).catch((err) => {
        console.warn(`[LiveAudioPlayerSink] Error playing chunk ${chunkIndex}:`, err);
      });
    });

    this.unsubscribeError = eventBus.on('pipeline:error', () => {
      this.player.stop().catch(() => {});
    });
  }

  detach(): void {
    if (this.unsubscribeDelta) {
      this.unsubscribeDelta();
      this.unsubscribeDelta = undefined;
    }
    if (this.unsubscribeComplete) {
      this.unsubscribeComplete();
      this.unsubscribeComplete = undefined;
    }
    if (this.unsubscribeError) {
      this.unsubscribeError();
      this.unsubscribeError = undefined;
    }
  }

  async waitForPlaybackComplete(): Promise<void> {
    await this.player.waitForIdle();
  }
}
