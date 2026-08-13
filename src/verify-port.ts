import fs from 'node:fs';
import { readFile, rm, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LiveAudioPlayerSink, WavFileStreamSink } from './audio/index.js';
import type { IAudioPlayer } from './audio/player/audio-player.interface.js';
import { loadConfigFile, resolveConfig } from './config/index.js';
import { UniversalEventBus } from './pipeline/pipeline-event-bus.js';
import { calculateBackoffMs } from './tts/backoff.js';
import {
  parseMarkdownToSpeakableParagraphs,
  parseMarkdownToStoryboardScenes,
  sanitizeTextForSpeech,
} from './chunker/index.js';

class MockPlayer implements IAudioPlayer {
  public played: number[] = [];
  async playChunk(chunkIndex: number, wavBuffer: Uint8Array): Promise<void> {
    this.played.push(chunkIndex);
  }
  async stop(): Promise<void> {}
  async waitForIdle(): Promise<void> {}
}

async function runTests() {
  console.log('=== Running verification suite for mdmedia ===');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
    }
  }

  // 1. Verify config resolver priorities
  console.log('\n--- 1. Testing Config Loader & Resolver (.mdmedia.json) ---');
  const resolved = resolveConfig(
    { voice: 'Puck', maxRetries: 5, play: true, aspectRatio: '9:16' },
    {
      mode: 'audio',
      audio: { voice: 'Charon', model: 'custom-model' },
      video: { aspectRatio: '16:9', task: 'image_to_video' },
      maxChars: 300,
    },
    { GEMINI_API_KEY: 'test-key' }
  );
  assert(resolved.audio.voice === 'Puck', 'CLI args override .mdmedia.json for audio voice');
  assert(resolved.audio.model === 'custom-model', '.mdmedia.json sets audio model');
  assert(resolved.video.aspectRatio === '9:16', 'CLI args override .mdmedia.json for video aspectRatio');
  assert(resolved.video.task === 'image_to_video', '.mdmedia.json sets video task');
  assert(resolved.maxChars === 300, '.mdmedia.json overrides default for maxChars');
  assert(resolved.apiKey === 'test-key', 'Environment variable used for apiKey');
  assert(resolved.maxRetries === 5, 'CLI args override .mdmedia.json for maxRetries');
  assert(resolved.audio.play === true, 'CLI args override for play flag');

  // 2. Verify exponential backoff
  console.log('\n--- 2. Testing Exponential Backoff ---');
  const ms1 = calculateBackoffMs(0, 500, 8000);
  const ms2 = calculateBackoffMs(1, 500, 8000);
  assert(ms1 >= 500 && ms1 <= 700, 'Attempt 0 delay within expected range (500-700ms)');
  assert(ms2 >= 1000 && ms2 <= 1200, 'Attempt 1 delay within expected range (1000-1200ms)');

  // 3. Verify WavFileStreamSink O(1) memory streaming and WAV header in-place update
  console.log('\n--- 3. Testing WavFileStreamSink O(1) Memory Streaming ---');
  const testWavPath = resolve(process.cwd(), 'verify_test_output.wav');
  if (fs.existsSync(testWavPath)) {
    await unlink(testWavPath);
  }

  const eventBus = new UniversalEventBus();
  const sink = new WavFileStreamSink(testWavPath);
  sink.attachToEventBus(eventBus, 24000, 1, 16);

  const fakePCM1 = new Uint8Array([1, 2, 3, 4, 5]);
  const fakePCM2 = new Uint8Array([6, 7, 8, 9, 10]);

  eventBus.emit('audio:delta', { chunkIndex: 0, audioData: fakePCM1 });
  eventBus.emit('audio:delta', { chunkIndex: 0, audioData: fakePCM2 });

  await new Promise((res) => setTimeout(res, 50));
  eventBus.emit('pipeline:complete', {
    totalChunksProcessed: 1,
    totalBytesGenerated: 10,
  });

  await new Promise((res) => setTimeout(res, 200));

  assert(fs.existsSync(testWavPath), 'WAV output file was created on disk');
  const fileBytes = await readFile(testWavPath);
  assert(
    fileBytes.byteLength === 54,
    `WAV total file size is exactly 54 bytes (44 header + 10 PCM, got ${fileBytes.byteLength})`
  );

  const riff = String.fromCharCode(...fileBytes.subarray(0, 4));
  const wave = String.fromCharCode(...fileBytes.subarray(8, 12));
  assert(riff === 'RIFF' && wave === 'WAVE', 'Valid RIFF/WAVE header identifiers present');

  const view = new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength);
  const dataSize = view.getUint32(40, true);
  assert(
    dataSize === 10,
    `RIFF data chunk size field equals exactly 10 bytes (got ${dataSize})`
  );

  if (fs.existsSync(testWavPath)) {
    await unlink(testWavPath);
  }

  // 4. Verify Speech URL Sanitization
  console.log('\n--- 4. Testing Speech URL Sanitization ---');
  const sanitizedStr = sanitizeTextForSpeech(
    'Dashboard at https://example.com/0abc (see: https://example.com/view) using go/tool#run-cli.'
  );
  assert(
    sanitizedStr === 'Dashboard at using go/tool.',
    'sanitizeTextForSpeech strips bare URLs, parentheticals, and cleans shortlink hashes'
  );

  const mdParagraphs = parseMarkdownToSpeakableParagraphs(
    '# Architecture (https://example.com)\n\n* Guide: [Docs](https://example.com/docs)\n* Raw: https://example.com/raw'
  );
  assert(
    mdParagraphs[0] === 'Architecture.' &&
      mdParagraphs[1] === 'Guide: Docs.' &&
      mdParagraphs[2] === 'Raw:',
    'parseMarkdownToSpeakableParagraphs sanitizes URLs across headings and list items'
  );

  // 5. Verify Safe Directory Creation
  console.log('\n--- 5. Testing Safe Directory Creation ---');
  const nestedVerifyDir = resolve(process.cwd(), 'verify_test_nested_dir', '.listen');
  const nestedVerifyFile = resolve(nestedVerifyDir, 'out.wav');
  if (fs.existsSync(resolve(process.cwd(), 'verify_test_nested_dir'))) {
    await rm(resolve(process.cwd(), 'verify_test_nested_dir'), { recursive: true, force: true });
  }

  const nestedSink = new WavFileStreamSink(nestedVerifyFile);
  await nestedSink.open();
  assert(fs.existsSync(nestedVerifyDir), 'WavFileStreamSink automatically creates parent directories on open');
  await nestedSink.finalize(24000, 1, 16);
  assert(fs.existsSync(nestedVerifyFile), 'WavFileStreamSink writes and finalizes in created directory');

  if (fs.existsSync(resolve(process.cwd(), 'verify_test_nested_dir'))) {
    await rm(resolve(process.cwd(), 'verify_test_nested_dir'), { recursive: true, force: true });
  }

  // 6. Verify LiveAudioPlayerSink
  console.log('\n--- 6. Testing LiveAudioPlayerSink ---');
  const mockPlayer = new MockPlayer();
  const playerBus = new UniversalEventBus();
  const playerSink = new LiveAudioPlayerSink(mockPlayer);
  playerSink.attachToEventBus(playerBus);

  playerBus.emit('audio:delta', { chunkIndex: 0, audioData: new Uint8Array([1, 2]) });
  playerBus.emit('chunk:complete', { chunkIndex: 0 });
  await playerSink.waitForPlaybackComplete();

  assert(mockPlayer.played.length === 1 && mockPlayer.played[0] === 0, 'LiveAudioPlayerSink streams completed chunks to audio player');

  // 7. Verify Storyboard Scene Parser
  console.log('\n--- 7. Testing Storyboard Scene Parser ---');
  const scenes = parseMarkdownToStoryboardScenes(
    '# Scene 1\n<FIRST_FRAME> start.png\n[0-3s] The car speeds off.\n\n# Scene 2\n[3-6s] It turns a corner.'
  );
  assert(scenes.length === 2, 'parseMarkdownToStoryboardScenes extracts multiple scenes');
  assert(scenes[0].firstFrame === 'start.png', 'parseMarkdownToStoryboardScenes extracts first frame');
  assert(scenes[0].prompt.includes('[0-3s] The car speeds off.'), 'parseMarkdownToStoryboardScenes captures timecoded prompt');

  console.log(`\n=== Verification Results: ${passed}/${total} checks passed ===`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
