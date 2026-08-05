import type { DocumentChunk } from '../types/chunk.js';
import type { VoiceName } from '../types/voice.js';
import type { ITTSProvider } from '../tts/tts-provider.interface.js';
import type { UniversalEventBus } from './pipeline-event-bus.js';

export class DocumentAudioPipeline {
  constructor(
    private readonly ttsProvider: ITTSProvider,
    private readonly eventBus: UniversalEventBus
  ) {}

  async processDocument(
    chunks: DocumentChunk[],
    voice: VoiceName,
    promptStyle?: string
  ): Promise<void> {
    const totalChars = chunks.reduce((acc, c) => acc + c.charCount, 0);

    this.eventBus.emit('pipeline:start', {
      totalChunks: chunks.length,
      totalChars,
    });

    let totalBytesGenerated = 0;

    try {
      for (const chunk of chunks) {
        this.eventBus.emit('chunk:start', { chunk });

        const audioStream = this.ttsProvider.streamAudio(chunk.text, voice, promptStyle);

        for await (const pcmChunk of audioStream) {
          totalBytesGenerated += pcmChunk.byteLength;
          this.eventBus.emit('audio:delta', {
            chunkIndex: chunk.index,
            audioData: pcmChunk,
          });
        }

        this.eventBus.emit('chunk:complete', {
          chunkIndex: chunk.index,
        });
      }

      this.eventBus.emit('pipeline:complete', {
        totalChunksProcessed: chunks.length,
        totalBytesGenerated,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.eventBus.emit('pipeline:error', { error });
      throw error;
    }
  }
}
