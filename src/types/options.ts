import type { VoiceName } from './voice.js';

export interface SynthesisOptions {
  inputPath: string;
  outputPath: string;
  voice: VoiceName;
  promptStyle?: string;
  maxChunkChars?: number;
  verbose?: boolean;
}
