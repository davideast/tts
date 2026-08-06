import type { VoiceName } from '../types/voice.js';

export interface FileConfig {
  readonly voice?: VoiceName;
  readonly style?: string;
  readonly model?: string;
  readonly maxChars?: number;
  readonly apiKey?: string;
  readonly maxRetries?: number;
}
