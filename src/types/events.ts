import type { StoryboardScene } from '../chunker/storyboard-parser.js';
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

export interface SceneStartedEvent {
  scene: StoryboardScene;
}

export interface SceneCompletedEvent {
  sceneIndex: number;
  videoBytes: Uint8Array;
  interactionId: string;
}

export interface VideoPipelineCompletedEvent {
  totalScenesProcessed: number;
  totalBytesGenerated: number;
}

export type PipelineEventMap = {
  'pipeline:start': PipelineStartedEvent;
  'chunk:start': ChunkStartedEvent;
  'audio:delta': AudioDeltaEvent;
  'chunk:complete': ChunkCompletedEvent;
  'pipeline:complete': PipelineCompletedEvent;
  'pipeline:error': { error: Error };
  'scene:start': SceneStartedEvent;
  'scene:complete': SceneCompletedEvent;
  'video:pipeline:complete': VideoPipelineCompletedEvent;
};
