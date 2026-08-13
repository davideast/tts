import { defineCommand } from 'citty';
import type { AspectRatio, DeliveryMode, VideoTask } from '../types/media.js';
import type { VoiceName } from '../types/voice.js';
import { loadConfigFile, resolveConfig } from '../config/index.js';
import { runAudioSynthesis, runVideoGeneration } from './runner.js';

export const audioCommand = defineCommand({
  meta: {
    name: 'audio',
    description: 'Convert markdown documents into spoken audio narration via Gemini Flash 3.1 TTS',
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
    play: {
      type: 'boolean',
      alias: 'p',
      description: 'Play audio in real-time through speakers as chunks stream',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose audio streaming delta logs',
      default: false,
    },
  },
  async run({ args }) {
    const fileConfig = await loadConfigFile(process.cwd());
    const resolved = resolveConfig(
      {
        mode: 'audio',
        voice: args.voice as VoiceName | undefined,
        style: args.style,
        audioModel: args.model,
        maxChars: args.maxChars ? Number(args.maxChars) : undefined,
        apiKey: args.apiKey,
        maxRetries: args.maxRetries ? Number(args.maxRetries) : undefined,
        play: args.play,
      },
      fileConfig
    );

    await runAudioSynthesis({
      input: args.input,
      output: args.output,
      voice: resolved.audio.voice,
      style: resolved.audio.style,
      maxChars: resolved.maxChars,
      model: resolved.audio.model,
      apiKey: resolved.apiKey,
      maxRetries: resolved.maxRetries,
      play: resolved.audio.play,
      verbose: args.verbose,
    });
  },
});

export const videoCommand = defineCommand({
  meta: {
    name: 'video',
    description: 'Generate video clips from markdown storyboards via Gemini Omni Flash',
  },
  args: {
    input: {
      type: 'string',
      alias: 'i',
      description: 'Path to input markdown (.md) storyboard file',
      required: true,
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Path for output video (.mp4) file',
      default: 'output.mp4',
    },
    model: {
      type: 'string',
      alias: 'm',
      description: 'Gemini Omni Flash model name',
    },
    aspectRatio: {
      type: 'string',
      alias: 'a',
      description: 'Video aspect ratio ("16:9" or "9:16")',
    },
    task: {
      type: 'string',
      alias: 't',
      description: 'Video task ("text_to_video", "image_to_video", "reference_to_video", "edit")',
    },
    delivery: {
      type: 'string',
      description: 'Delivery mode ("uri" for large files or "inline")',
    },
    ref: {
      type: 'string',
      alias: 'r',
      description: 'Comma-separated reference image paths',
    },
    firstFrame: {
      type: 'string',
      description: 'Path to starting image frame',
    },
    interactionId: {
      type: 'string',
      description: 'Previous interaction ID for stateful iterative video editing',
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
      description: 'Enable verbose logging',
      default: false,
    },
  },
  async run({ args }) {
    const fileConfig = await loadConfigFile(process.cwd());
    const referenceImages = args.ref
      ? args.ref.split(',').map((s) => s.trim())
      : undefined;

    const resolved = resolveConfig(
      {
        mode: 'video',
        videoModel: args.model,
        aspectRatio: args.aspectRatio as AspectRatio | undefined,
        task: args.task as VideoTask | undefined,
        delivery: args.delivery as DeliveryMode | undefined,
        referenceImages,
        firstFrame: args.firstFrame,
        previousInteractionId: args.interactionId,
        apiKey: args.apiKey,
        maxRetries: args.maxRetries ? Number(args.maxRetries) : undefined,
      },
      fileConfig
    );

    await runVideoGeneration({
      input: args.input,
      output: args.output,
      model: resolved.video.model,
      aspectRatio: resolved.video.aspectRatio,
      task: resolved.video.task,
      delivery: resolved.video.delivery,
      referenceImages: resolved.video.referenceImages,
      firstFrame: resolved.video.firstFrame,
      previousInteractionId: resolved.video.previousInteractionId,
      apiKey: resolved.apiKey,
      maxRetries: resolved.maxRetries,
      verbose: args.verbose,
    });
  },
});

export const mainCommand = defineCommand({
  meta: {
    name: 'mdmedia',
    version: '0.1.0',
    description: 'Transform markdown documents into rich audio and video media via Gemini Flash 3.1 & Gemini Omni Flash',
  },
  subCommands: {
    audio: audioCommand,
    video: videoCommand,
  },
  args: {
    input: {
      type: 'string',
      alias: 'i',
      description: 'Path to input markdown (.md) file',
    },
    output: {
      type: 'string',
      alias: 'o',
      description: 'Path for output media file (.wav or .mp4)',
    },
    voice: {
      type: 'string',
      alias: 'v',
      description: 'Gemini TTS voice name (for audio)',
    },
    aspectRatio: {
      type: 'string',
      alias: 'a',
      description: 'Video aspect ratio ("16:9" or "9:16")',
    },
    play: {
      type: 'boolean',
      alias: 'p',
      description: 'Play audio in real-time through speakers',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose logging',
      default: false,
    },
  },
  async run({ args }) {
    if (!args.input) {
      console.log('mdmedia: Transform markdown documents into rich audio and video media');
      console.log('Use "mdmedia audio --help" or "mdmedia video --help" for commands.');
      return;
    }

    const isVideo = args.output?.endsWith('.mp4');
    if (isVideo) {
      const fileConfig = await loadConfigFile(process.cwd());
      const resolved = resolveConfig({ mode: 'video', aspectRatio: args.aspectRatio as AspectRatio }, fileConfig);
      await runVideoGeneration({
        input: args.input,
        output: args.output ?? 'output.mp4',
        model: resolved.video.model,
        aspectRatio: resolved.video.aspectRatio,
        task: resolved.video.task,
        delivery: resolved.video.delivery,
        apiKey: resolved.apiKey,
        maxRetries: resolved.maxRetries,
        verbose: args.verbose,
      });
    } else {
      const fileConfig = await loadConfigFile(process.cwd());
      const resolved = resolveConfig({ mode: 'audio', voice: args.voice as VoiceName, play: args.play }, fileConfig);
      await runAudioSynthesis({
        input: args.input,
        output: args.output ?? 'output.wav',
        voice: resolved.audio.voice,
        model: resolved.audio.model,
        style: resolved.audio.style,
        apiKey: resolved.apiKey,
        maxRetries: resolved.maxRetries,
        play: resolved.audio.play,
        verbose: args.verbose,
      });
    }
  },
});
