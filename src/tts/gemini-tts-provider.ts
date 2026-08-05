import type { GoogleGenAI } from '@google/genai';
import type { VoiceName } from '../types/voice.js';
import { base64ToUint8Array } from './base64-to-uint8array.js';
import type { ITTSProvider } from './tts-provider.interface.js';

export class GeminiTTSProvider implements ITTSProvider {
  constructor(private readonly client: GoogleGenAI) {}

  async *streamAudio(
    text: string,
    voice: VoiceName,
    promptStyle?: string
  ): AsyncIterable<Uint8Array> {
    const formattedInput = promptStyle ? `${promptStyle}\n\n${text}` : text;

    const stream = await this.client.interactions.create({
      model: 'gemini-3.1-flash-tts-preview',
      input: formattedInput,
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice }],
      },
      stream: true,
    } as any);

    for await (const event of stream as unknown as AsyncIterable<any>) {
      if (event.event_type === 'step.delta' && event.delta?.type === 'audio' && event.delta.data) {
        yield base64ToUint8Array(event.delta.data);
      }
    }
  }
}
