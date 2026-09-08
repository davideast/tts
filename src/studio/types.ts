import type { PlaybackStatus } from '../audio/player/types.js';
import type { ChunkTiming, TrackMetadata } from '../storage/types.js';
import type { VoiceName } from '../types/voice.js';
import type { AudioLibrary } from '../storage/audio-library.js';
import type { PlaybackEngine } from '../audio/player/playback-engine.js';
import type { ITTSProvider } from '../tts/tts-provider.interface.js';

export interface StudioPlaybackState {
  status: PlaybackStatus;
  positionMs: number;
  durationMs: number;
  rate: number;
  activeChunkIndex: number;
}

export interface StudioLiveState {
  isStreaming: boolean;
  activeSessionId: string | null;
  currentChunkText: string | null;
}

export interface StudioState {
  tracks: TrackMetadata[];
  selectedTrack: TrackMetadata | null;
  playback: StudioPlaybackState;
  queue: TrackMetadata[];
  live: StudioLiveState;
  filterQuery: string;
}

export interface LiveTurnInput {
  sessionId: string;
  stepIndex: number;
  content: string;
  voice?: VoiceName;
  style?: string;
}

export interface RecordedTurnResult {
  wavBuffer: Uint8Array;
  chunkTimings: ChunkTiming[];
  totalPCMBytes: number;
}

export interface StudioAction {
  play(trackId?: string): Promise<void>;
  pause(): void;
  togglePause(): void;
  seek(positionMs: number): Promise<void>;
  scrub(deltaMs: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  selectTrack(trackId: string): Promise<void> | void;
  setFilter(query: string): void;
  deleteTrack(trackId: string): Promise<void>;
  next(): Promise<void>;
  prev(): Promise<void>;
}

export interface StudioStoreOptions {
  library?: AudioLibrary;
  player?: PlaybackEngine;
  ttsProvider?: ITTSProvider;
  enableLiveAudio?: boolean;
  defaultVoice?: VoiceName;
  defaultStyle?: string;
}
