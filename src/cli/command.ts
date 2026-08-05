import { defineCommand } from 'citty';
import type { VoiceName } from '../types/voice.js';
import { runSynthesis } from './runner.js';

export const mainCommand = defineCommand({
  meta: {
    name: 'tts-flash',
    version: '0.1.0',
    description: 'Convert markdown documents of any length into a single audio file via Gemini Flash 3.1 TTS',
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
      default: 'Kore',
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
      default: '400',
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose audio streaming delta logs',
      default: false,
    },
  },
  async run({ args }) {
    await runSynthesis({
      input: args.input,
      output: args.output,
      voice: args.voice as VoiceName,
      style: args.style,
      maxChars: Number(args.maxChars) || 400,
      verbose: args.verbose,
    });
  },
});
