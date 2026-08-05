import type { UniversalEventBus } from '../pipeline/pipeline-event-bus.js';
import { createWavHeader } from './wav-header.js';

export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return result;
}

export class PCMAccumulator {
  private readonly chunks: Uint8Array[] = [];
  private totalBytes = 0;
  private unsubscribe?: () => void;

  attachToEventBus(eventBus: UniversalEventBus): void {
    this.unsubscribe = eventBus.on('audio:delta', ({ audioData }) => {
      this.addChunk(audioData);
    });
  }

  detach(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  addChunk(pcmChunk: Uint8Array): void {
    this.chunks.push(pcmChunk);
    this.totalBytes += pcmChunk.byteLength;
  }

  getTotalBytes(): number {
    return this.totalBytes;
  }

  getConcatenatedPCM(): Uint8Array {
    return concatUint8Arrays(this.chunks);
  }

  buildCompleteWav(sampleRate = 24000, channels = 1, bitDepth = 16): Uint8Array {
    const pcmData = this.getConcatenatedPCM();
    const header = createWavHeader(pcmData.byteLength, sampleRate, channels, bitDepth);
    return concatUint8Arrays([header, pcmData]);
  }

  reset(): void {
    this.chunks.length = 0;
    this.totalBytes = 0;
  }
}
