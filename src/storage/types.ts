import type { VoiceName } from '../types/voice.js';

export interface ChunkTiming {
  chunkIndex: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface TrackMetadata {
  id: string;
  sessionId: string;
  stepIndex: number;
  title: string;
  slug: string;
  voice: VoiceName;
  style?: string;
  durationMs: number;
  charCount: number;
  chunkCount: number;
  createdAt: string;
  audioPath: string;
  transcriptPath: string;
  metadataPath: string;
  chunkTimings?: ChunkTiming[];
}

export interface CatalogIndex {
  version: 1;
  updatedAt: string;
  tracks: TrackMetadata[];
}

export interface SaveTrackInput {
  sessionId: string;
  stepIndex: number;
  markdown: string;
  audioBuffer: Uint8Array;
  voice: VoiceName;
  style?: string;
  chunkTimings?: ChunkTiming[];
}

export interface TrackFilter {
  sessionId?: string;
  query?: string;
}
