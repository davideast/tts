import type { VoiceName } from '../types/voice.js';

export interface ITTSProvider {
  streamAudio(
    text: string,
    voice: VoiceName,
    promptStyle?: string
  ): AsyncIterable<Uint8Array>;
}
