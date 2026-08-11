import { defineCommand } from 'citty';
import type { VoiceName } from '../types/voice.js';
import { loadConfigFile, resolveConfig } from '../config/index.js';
import { runSynthesis } from './runner.js';

export const mainCommand = defineCommand({
  meta: {
    name: 'tts',
    version: '0.1.0',
    description:
      'Convert markdown documents of any length into a single audio file via Gemini Flash 3.1 TTS',
  },
  args: {
    input: {
      type: 'string',
      alias: 'i',
      description: 'Path to input markdown (.md) file',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Path for output audio (.wav) file',
      default: 'output.wav',
    },
    voice: {
      type: 'string',
      alias: 'v',
      description: 'Gemini TTS voice name (e.g. Kore, Puck, Zephyr)',
    },
    style: {
      type: 'string',
      alias: 's',
      description: 'Director notes / style prompt for speech delivery',
    },
    maxChars: {
      type: 'string',
      alias: 'c',
      description: 'Maximum characters per document chunk',
    },
    model: {
      type: 'string',
      alias: 'm',
      description: 'Gemini TTS model name',
    },
    apiKey: {
      type: 'string',
      alias: 'k',
      description: 'Gemini API Key',
    },
    maxRetries: {
      type: 'string',
      description: 'Max retry attempts for API calls',
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose audio streaming delta logs',
      default: false,
    },
  },
  async run({ args }) {
    const fileConfig = await loadConfigFile(process.cwd(), '.tts.json');
    const resolved = resolveConfig(
      {
        voice: args.voice as VoiceName | undefined,
        style: args.style,
        model: args.model,
        maxChars: args.maxChars ? Number(args.maxChars) : undefined,
        apiKey: args.apiKey,
        maxRetries: args.maxRetries ? Number(args.maxRetries) : undefined,
      },
      fileConfig
    );

    await runSynthesis({
      input: args.input,
      output: args.output,
      voice: resolved.voice,
      style: resolved.style,
      maxChars: resolved.maxChars,
      model: resolved.model,
      apiKey: resolved.apiKey,
      maxRetries: resolved.maxRetries,
      verbose: args.verbose,
    });
  },
});
