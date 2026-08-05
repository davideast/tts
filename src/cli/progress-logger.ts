import type { UniversalEventBus } from '../pipeline/pipeline-event-bus.js';

export class ProgressLogger {
  constructor(private readonly verbose = false) {}

  attach(eventBus: UniversalEventBus): () => void {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      eventBus.on('pipeline:start', ({ totalChunks, totalChars }) => {
        console.log(`[TTS Pipeline] Starting synthesis...`);
        console.log(`[TTS Pipeline] Document split into ${totalChunks} chunk(s) (${totalChars} characters total).`);
      })
    );

    unsubs.push(
      eventBus.on('chunk:start', ({ chunk }) => {
        console.log(`[Chunk ${chunk.index + 1}] Synthesizing "${chunk.text.slice(0, 60)}${chunk.text.length > 60 ? '...' : ''}" (${chunk.charCount} chars)`);
      })
    );

    let currentChunkBytes = 0;
    unsubs.push(
      eventBus.on('audio:delta', ({ audioData }) => {
        currentChunkBytes += audioData.byteLength;
        if (this.verbose) {
          console.log(`  -> Streaming delta: +${(audioData.byteLength / 1024).toFixed(1)} KB (chunk total: ${(currentChunkBytes / 1024).toFixed(1)} KB)`);
        }
      })
    );

    unsubs.push(
      eventBus.on('chunk:complete', ({ chunkIndex }) => {
        console.log(`[Chunk ${chunkIndex + 1}] Synthesis completed (${(currentChunkBytes / 1024).toFixed(1)} KB audio streamed).`);
        currentChunkBytes = 0;
      })
    );

    unsubs.push(
      eventBus.on('pipeline:complete', ({ totalChunksProcessed, totalBytesGenerated }) => {
        console.log(`[TTS Pipeline] Complete! Processed ${totalChunksProcessed} chunk(s).`);
        console.log(`[TTS Pipeline] Total raw PCM audio: ${(totalBytesGenerated / 1024).toFixed(1)} KB.`);
      })
    );

    unsubs.push(
      eventBus.on('pipeline:error', ({ error }) => {
        console.error(`[TTS Pipeline Error] ${error.message}`);
      })
    );

    return () => {
      for (const fn of unsubs) fn();
    };
  }
}
