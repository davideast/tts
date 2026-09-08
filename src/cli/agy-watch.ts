import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { GoogleGenAI } from '@google/genai';
import { GeminiTTSProvider } from '../tts/gemini-tts-provider.js';
import { AudioLibrary } from '../storage/audio-library.js';
import { PlaybackEngine } from '../audio/player/playback-engine.js';
import { StudioStore } from '../studio/studio-store.js';
import { getGeminiApiKey } from '../studio/antigravity-watcher.js';
import { parseListenCommand } from './listen-parser.js';
import type { VoiceName } from '../types/voice.js';

function getBrainDir(): string {
  if (process.env.ANTIGRAVITY_BRAIN_DIR) return process.env.ANTIGRAVITY_BRAIN_DIR;
  const antigravityPath = path.join(os.homedir(), '.gemini/antigravity/brain');
  if (fs.existsSync(antigravityPath)) return antigravityPath;
  const fallbackPath = path.join(os.homedir(), '.gemini/jetski/brain');
  return fs.existsSync(fallbackPath) ? fallbackPath : antigravityPath;
}

const BRAIN_DIR = getBrainDir();

interface TranscriptStep {
  key: string;
  convId: string;
  stepIndex: number;
  type: 'USER_INPUT' | 'PLANNER_RESPONSE' | string;
  content: string;
}

function getAllTranscriptSteps(): TranscriptStep[] {
  if (!fs.existsSync(BRAIN_DIR)) return [];
  const entries = fs.readdirSync(BRAIN_DIR, { withFileTypes: true });
  const results: TranscriptStep[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const convId = entry.name;
    const tPath = path.join(BRAIN_DIR, convId, '.system_generated/logs/transcript.jsonl');
    if (!fs.existsSync(tPath)) continue;

    try {
      const lines = fs.readFileSync(tPath, 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const step = JSON.parse(line);
          if (
            (step.type === 'USER_INPUT' || step.type === 'PLANNER_RESPONSE') &&
            typeof step.content === 'string' &&
            step.content.trim()
          ) {
            results.push({
              key: `${convId}:${step.step_index}`,
              convId,
              stepIndex: step.step_index,
              type: step.type,
              content: step.content.trim(),
            });
          }
        } catch {}
      }
    } catch {}
  }

  return results;
}

function getLatestPlannerResponseForConv(steps: TranscriptStep[], convId: string): TranscriptStep | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].convId === convId && steps[i].type === 'PLANNER_RESPONSE') {
      return steps[i];
    }
  }
  return null;
}

async function main() {
  const defaultVoice = (process.argv[2] as VoiceName) || 'Puck';
  const defaultStyle = process.argv[3] || undefined;
  const apiKey = process.env.GEMINI_API_KEY || getGeminiApiKey();

  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is required.');
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });
  const provider = new GeminiTTSProvider(client);
  const library = new AudioLibrary();
  const player = new PlaybackEngine();
  const studioStore = new StudioStore({
    library,
    player,
    ttsProvider: provider,
    enableLiveAudio: true,
    defaultVoice,
    defaultStyle,
  });

  // Launch interactive OpenTUI terminal dashboard by default if in a TTY
  const isHeadless = process.argv.includes('--headless') || !process.stdin.isTTY;
  if (!isHeadless) {
    const { startStudioTui } = await import('../tui/app.js');
    await startStudioTui(studioStore);
    return;
  }

  const seenStepKeys = new Set<string>();
  const autoListenConversations = new Map<string, { voice?: VoiceName; style?: string }>();

  const initialSteps = getAllTranscriptSteps();
  for (const step of initialSteps) {
    seenStepKeys.add(step.key);
  }

  console.log(`🎧 [mdmedia watch] Ready! Scoped strictly to explicit /listen commands.`);
  console.log(`   - Type "/listen" in any conversation to narrate its latest response once`);
  console.log(`   - Type "/listen auto" (or "/listen auto -v Fenrir") to auto-narrate ONLY that session`);
  console.log(`   - Type "/listen off" to disable auto-narration for that session`);
  console.log(`   Controls: [Space] Pause/Resume  |  [s] Stop/Skip current  |  [q] Quit\n`);

  library.on('track:saved', (track) => {
    console.log(`💾 [Library] Saved "${track.title}" (${track.slug}) [${Math.round(track.durationMs / 1000)}s]`);
  });

  let isNarrating = false;
  const narrationQueue: {
    convId: string;
    stepIndex: number;
    content: string;
    voice?: VoiceName;
    style?: string;
  }[] = [];

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', async (_str, key) => {
      if (!key) return;
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        studioStore.abortLiveTurn();
        player.stop();
        process.exit(0);
      }
      if (key.name === 'space') {
        studioStore.togglePause();
        const paused = studioStore.getState().playback.status === 'paused';
        console.log(paused ? '⏸  Audio Paused (press [Space] to resume)' : '▶  Audio Resumed');
      }
      if (key.name === 's') {
        studioStore.abortLiveTurn();
        player.stop();
        console.log('⏹  Stopped / skipped current message.');
      }
    });
  }

  async function processQueue() {
    if (isNarrating || narrationQueue.length === 0) return;
    const item = narrationQueue.shift()!;
    isNarrating = true;

    console.log(`\n🔊 Narrating response from session ${item.convId.slice(0, 8)} (step #${item.stepIndex})...`);

    try {
      await studioStore.handleLiveTurn({
        sessionId: item.convId,
        stepIndex: item.stepIndex,
        content: item.content,
        voice: item.voice,
        style: item.style,
      });
    } catch (err: any) {
      console.error(`[watch] Error narrating response:`, err.message);
    } finally {
      isNarrating = false;
      if (narrationQueue.length > 0) {
        processQueue();
      }
    }
  }

  setInterval(() => {
    const allSteps = getAllTranscriptSteps();
    const newSteps = allSteps.filter((s) => !seenStepKeys.has(s.key));

    for (const step of newSteps) {
      seenStepKeys.add(step.key);

      if (step.type === 'USER_INPUT') {
        const cmd = parseListenCommand(step.content);
        if (!cmd) continue;

        if (cmd.mode === 'auto') {
          autoListenConversations.set(step.convId, { voice: cmd.voice, style: cmd.style });
          console.log(`📌 [Session ${step.convId.slice(0, 8)}] Enabled "/listen auto" — new responses in this session will auto-narrate.`);
          const latestResp = getLatestPlannerResponseForConv(allSteps, step.convId);
          if (latestResp) {
            narrationQueue.push({
              convId: step.convId,
              stepIndex: latestResp.stepIndex,
              content: latestResp.content,
              voice: cmd.voice,
              style: cmd.style,
            });
          }
        } else if (cmd.mode === 'off') {
          autoListenConversations.delete(step.convId);
          studioStore.abortLiveTurn();
          player.stop();
          console.log(`🔕 [Session ${step.convId.slice(0, 8)}] Disabled auto-narration.`);
        } else if (cmd.mode === 'once') {
          console.log(`🎯 [Session ${step.convId.slice(0, 8)}] One-shot "/listen" requested — narrating latest response.`);
          const latestResp = getLatestPlannerResponseForConv(allSteps, step.convId);
          if (latestResp) {
            narrationQueue.push({
              convId: step.convId,
              stepIndex: latestResp.stepIndex,
              content: latestResp.content,
              voice: cmd.voice,
              style: cmd.style,
            });
          }
        }
      }

      if (step.type === 'PLANNER_RESPONSE') {
        const sessionOpts = autoListenConversations.get(step.convId);
        if (sessionOpts) {
          narrationQueue.push({
            convId: step.convId,
            stepIndex: step.stepIndex,
            content: step.content,
            voice: sessionOpts.voice,
            style: sessionOpts.style,
          });
        }
      }
    }

    processQueue();
  }, 1500);
}

main();
