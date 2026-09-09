import { DocumentAudioPipeline } from '../pipeline/document-audio-pipeline.js';
import { UniversalEventBus } from '../pipeline/pipeline-event-bus.js';
import { createWavHeader } from '../audio/wav-header.js';
import { extractWordTimingsFromPcm } from '../audio/player/word-aligner.js';
import type { ITTSProvider } from '../tts/tts-provider.interface.js';
import type { DocumentChunk } from '../types/chunk.js';
import type { VoiceName } from '../types/voice.js';
import type { ChunkTiming } from '../storage/types.js';
import type { RecordedTurnResult } from './types.js';

const BYTES_PER_MS = 48; // 24kHz * 1 channel * 2 bytes/sample = 48 bytes/ms

export class NarrationRecorder {
  private activePipeline?: DocumentAudioPipeline;

  constructor(
    private readonly ttsProvider: ITTSProvider,
    private readonly eventBus: UniversalEventBus = new UniversalEventBus()
  ) {}

  public getEventBus(): UniversalEventBus {
    return this.eventBus;
  }

  public abort(): void {
    if (this.activePipeline) {
      this.activePipeline.abort();
    }
  }

  public async record(
    chunks: DocumentChunk[],
    voice: VoiceName,
    promptStyle?: string
  ): Promise<RecordedTurnResult> {
    const chunkTimings: ChunkTiming[] = [];
    const allPcmDeltas: Uint8Array[] = [];
    let currentChunkDeltas: Uint8Array[] = [];
    let totalPCMBytes = 0;

    let currentChunk: DocumentChunk | null = null;
    let currentChunkStartBytes = 0;

    const unsubStart = this.eventBus.on('chunk:start', ({ chunk }) => {
      currentChunk = chunk;
      currentChunkStartBytes = totalPCMBytes;
      currentChunkDeltas = [];
    });

    const unsubDelta = this.eventBus.on('audio:delta', ({ audioData }) => {
      allPcmDeltas.push(audioData);
      currentChunkDeltas.push(audioData);
      totalPCMBytes += audioData.byteLength;
    });

    const unsubComplete = this.eventBus.on('chunk:complete', ({ chunkIndex }) => {
      const chunkEndBytes = totalPCMBytes;
      const startMs = Math.round(currentChunkStartBytes / BYTES_PER_MS);
      const endMs = Math.round(chunkEndBytes / BYTES_PER_MS);
      const text = currentChunk?.text ?? '';

      const chunkByteLen = currentChunkDeltas.reduce((sum, d) => sum + d.byteLength, 0);
      const chunkPcm = new Uint8Array(chunkByteLen);
      let off = 0;
      for (const d of currentChunkDeltas) {
        chunkPcm.set(d, off);
        off += d.byteLength;
      }

      const wordTimings = extractWordTimingsFromPcm(chunkPcm, text, startMs);

      chunkTimings.push({
        chunkIndex,
        startMs,
        endMs,
        text,
        wordTimings,
      });
    });

    this.activePipeline = new DocumentAudioPipeline(this.ttsProvider, this.eventBus);

    try {
      await this.activePipeline.processDocument(chunks, voice, promptStyle);
    } finally {
      this.activePipeline = undefined;
      unsubStart();
      unsubDelta();
      unsubComplete();
    }

    const wavHeader = createWavHeader(totalPCMBytes, 24000, 1, 16);
    const wavBuffer = new Uint8Array(44 + totalPCMBytes);
    wavBuffer.set(wavHeader, 0);

    let offset = 44;
    for (const delta of allPcmDeltas) {
      wavBuffer.set(delta, offset);
      offset += delta.byteLength;
    }

    return {
      wavBuffer,
      chunkTimings,
      totalPCMBytes,
    };
  }
}
