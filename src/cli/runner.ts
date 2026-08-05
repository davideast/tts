import { NodeAudioFileWriter, PCMAccumulator } from '../audio/index.js';
import { NodeFileReader, prepareDocumentChunks } from '../chunker/index.js';
import { DocumentAudioPipeline, UniversalEventBus } from '../pipeline/index.js';
import { createGeminiClient, GeminiTTSProvider, NodeEnvProvider } from '../tts/index.js';
import type { VoiceName } from '../types/voice.js';
import { ProgressLogger } from './progress-logger.js';

export interface RunSynthesisArgs {
  input: string;
  output: string;
  voice: VoiceName;
  style?: string;
  maxChars?: number;
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

  const pcmAccumulator = new PCMAccumulator();
  pcmAccumulator.attachToEventBus(eventBus);

  const envProvider = new NodeEnvProvider();
  const genaiClient = createGeminiClient(envProvider);
  const ttsProvider = new GeminiTTSProvider(genaiClient);

  const pipeline = new DocumentAudioPipeline(ttsProvider, eventBus);

  await pipeline.processDocument(chunks, args.voice, args.style);

  const completeWav = pcmAccumulator.buildCompleteWav(24000, 1, 16);
  const audioWriter = new NodeAudioFileWriter();

  await audioWriter.writeAudioFile(args.output, completeWav);
  console.log(`[Success] Single audio file created at: ${args.output} (${(completeWav.byteLength / 1024).toFixed(1)} KB)`);
}
