import type { TrackMetadata } from '../../storage/types.js';

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'stopped';

export interface PlaybackTimeUpdate {
  positionMs: number;
  durationMs: number;
  progressPct: number;
  rate: number;
}

export interface PlaybackEngineEvents {
  status: (status: PlaybackStatus) => void;
  timeupdate: (data: PlaybackTimeUpdate) => void;
  'track:start': (track: TrackMetadata) => void;
  'track:end': (track: TrackMetadata) => void;
  error: (err: Error) => void;
}
