import type { VoiceName } from '../types/voice.js';
import type { FileConfig } from './file-config.js';

export interface ResolvedConfig {
  readonly voice: VoiceName;
  readonly style?: string;
  readonly model: string;
  readonly maxChars: number;
  readonly apiKey?: string;
  readonly maxRetries: number;
}

export function resolveConfig(
  cliArgs: Partial<FileConfig>,
  fileConfig: FileConfig,
  env: Record<string, string | undefined> = process.env
): ResolvedConfig {
  return {
    voice: cliArgs.voice ?? fileConfig.voice ?? 'Kore',
    style: cliArgs.style ?? fileConfig.style,
    model: cliArgs.model ?? fileConfig.model ?? 'gemini-3.1-flash-tts-preview',
    maxChars: cliArgs.maxChars ?? fileConfig.maxChars ?? 400,
    apiKey: cliArgs.apiKey ?? fileConfig.apiKey ?? env.GEMINI_API_KEY,
    maxRetries: cliArgs.maxRetries ?? fileConfig.maxRetries ?? 3,
  };
}
