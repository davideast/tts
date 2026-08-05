import type { DocumentChunk } from './chunk.js';

export interface PipelineStartedEvent {
  totalChunks: number;
  totalChars: number;
}

export interface ChunkStartedEvent {
  chunk: DocumentChunk;
}

export interface AudioDeltaEvent {
  chunkIndex: number;
  audioData: Uint8Array;
}

export interface ChunkCompletedEvent {
  chunkIndex: number;
}

export interface PipelineCompletedEvent {
  totalChunksProcessed: number;
  totalBytesGenerated: number;
}

export type PipelineEventMap = {
  'pipeline:start': PipelineStartedEvent;
  'chunk:start': ChunkStartedEvent;
  'audio:delta': AudioDeltaEvent;
  'chunk:complete': ChunkCompletedEvent;
  'pipeline:complete': PipelineCompletedEvent;
  'pipeline:error': { error: Error };
};
