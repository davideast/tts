import fs from 'node:fs';
import { open as openFile } from 'node:fs/promises';
import type { UniversalEventBus } from '../pipeline/pipeline-event-bus.js';
import { createWavHeader } from './wav-header.js';

export class WavFileStreamSink {
  private writeStream?: fs.WriteStream;
  private bytesWritten = 0;
  private unsubscribeDelta?: () => void;
  private unsubscribeComplete?: () => void;
  private unsubscribeError?: () => void;
  private openPromise?: Promise<void>;

  constructor(private readonly destination: string) {}

  async open(): Promise<void> {
    if (this.writeStream) return;
    this.writeStream = fs.createWriteStream(this.destination);
    const placeholder = new Uint8Array(44);
    this.openPromise = new Promise<void>((resolve, reject) => {
      this.writeStream!.write(placeholder, (err) => (err ? reject(err) : resolve()));
    });
    await this.openPromise;
  }

  attachToEventBus(
    eventBus: UniversalEventBus,
    sampleRate = 24000,
    channels = 1,
    bitDepth = 16
  ): void {
    this.unsubscribeDelta = eventBus.on('audio:delta', ({ audioData }) => {
      this.writePCMChunk(audioData);
    });

    this.unsubscribeComplete = eventBus.on('pipeline:complete', () => {
      this.finalize(sampleRate, channels, bitDepth).catch((err) => {
        console.error('[WavFileStreamSink] Error finalizing WAV header:', err);
      });
    });

    this.unsubscribeError = eventBus.on('pipeline:error', () => {
      this.closeStream();
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

  async writePCMChunk(chunk: Uint8Array): Promise<void> {
    if (!this.writeStream) {
      await this.open();
    } else if (this.openPromise) {
      await this.openPromise;
    }
    this.bytesWritten += chunk.byteLength;
    await new Promise<void>((resolve, reject) => {
      this.writeStream!.write(chunk, (err) => (err ? reject(err) : resolve()));
    });
  }

  private closeStream(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.writeStream) {
        resolve();
        return;
      }
      this.writeStream.end(() => {
        this.writeStream = undefined;
        resolve();
      });
    });
  }

  async finalize(sampleRate = 24000, channels = 1, bitDepth = 16): Promise<void> {
    await this.closeStream();
    const header = createWavHeader(this.bytesWritten, sampleRate, channels, bitDepth);
    const fd = await openFile(this.destination, 'r+');
    try {
      await fd.write(header, 0, header.length, 0);
    } finally {
      await fd.close();
    }
  }

  getBytesWritten(): number {
    return this.bytesWritten;
  }
}
