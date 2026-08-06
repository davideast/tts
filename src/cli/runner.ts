import { GoogleGenAI } from '@google/genai';
import { WavFileStreamSink } from '../audio/index.js';
import { NodeFileReader, prepareDocumentChunks } from '../chunker/index.js';
import { DocumentAudioPipeline, UniversalEventBus } from '../pipeline/index.js';
import { GeminiTTSProvider, NodeEnvProvider, createGeminiClient } from '../tts/index.js';
import type { VoiceName } from '../types/voice.js';
import { ProgressLogger } from './progress-logger.js';

export interface RunSynthesisArgs {
  input: string;
  output: string;
  voice: VoiceName;
  style?: string;
  maxChars?: number;
  model?: string;
  apiKey?: string;
  maxRetries?: number;
  verbose?: boolean;
}

export async function runSynthesis(args: RunSynthesisArgs): Promise<void> {
  const fileReader = new NodeFileReader();
  const chunks = await prepareDocumentChunks(fileReader, args.input, args.maxChars);

  if (chunks.length === 0) {
    console.warn(`[Warning] No speakable markdown content found in ${args.input}`);
    return;
  }

  const eventBus = new UniversalEventBus();
  const progressLogger = new ProgressLogger(args.verbose);
  progressLogger.attach(eventBus);

  const streamSink = new WavFileStreamSink(args.output);
  streamSink.attachToEventBus(eventBus);

  const apiKey = args.apiKey ?? new NodeEnvProvider().getApiKey();
  const genaiClient = apiKey
    ? new GoogleGenAI({ apiKey })
    : createGeminiClient(new NodeEnvProvider());

  const ttsProvider = new GeminiTTSProvider(genaiClient, args.maxRetries, args.model);

  const pipeline = new DocumentAudioPipeline(ttsProvider, eventBus);

  await pipeline.processDocument(chunks, args.voice, args.style);

  const bytesWritten = streamSink.getBytesWritten() + 44; // PCM bytes + 44-byte header
  console.log(
    `[Success] Single audio file created at: ${args.output} (${(bytesWritten / 1024).toFixed(1)} KB) in O(1) memory`
  );
}
