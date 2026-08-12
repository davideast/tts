import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import { readFile, rm, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WavFileStreamSink } from './wav-file-stream-sink.js';
import { NodeAudioFileWriter } from './wav-file-writer.js';
import { UniversalEventBus } from '../pipeline/pipeline-event-bus.js';

const TEST_SCRATCH_DIR = resolve(process.cwd(), 'test_scratch_sink_dir');

describe('WavFileStreamSink - Safe Directory Creation & File Management', () => {
  beforeEach(async () => {
    if (fs.existsSync(TEST_SCRATCH_DIR)) {
      await rm(TEST_SCRATCH_DIR, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    if (fs.existsSync(TEST_SCRATCH_DIR)) {
      await rm(TEST_SCRATCH_DIR, { recursive: true, force: true });
    }
    const flatFile = resolve(process.cwd(), 'test_scratch_flat.wav');
    if (fs.existsSync(flatFile)) {
      await unlink(flatFile);
    }
  });

  it('safely creates non-existent parent directory when opening write stream', async () => {
    const dest = resolve(TEST_SCRATCH_DIR, '.listen', 'test.wav');
    expect(fs.existsSync(resolve(TEST_SCRATCH_DIR, '.listen'))).toBe(false);

    const sink = new WavFileStreamSink(dest);
    await sink.open();

    expect(fs.existsSync(resolve(TEST_SCRATCH_DIR, '.listen'))).toBe(true);
    expect(fs.existsSync(dest)).toBe(true);

    await sink.finalize(24000, 1, 16);
    const fileBytes = await readFile(dest);
    expect(fileBytes.byteLength).toBe(44);
  });

  it('safely creates deeply nested directory hierarchies', async () => {
    const dest = resolve(TEST_SCRATCH_DIR, 'deep', 'level', 'one', 'two', 'three', 'output.wav');
    const sink = new WavFileStreamSink(dest);
    await sink.open();

    expect(fs.existsSync(resolve(TEST_SCRATCH_DIR, 'deep', 'level', 'one', 'two', 'three'))).toBe(true);
    expect(fs.existsSync(dest)).toBe(true);

    await sink.finalize(24000, 1, 16);
    expect((await readFile(dest)).byteLength).toBe(44);
  });

  it('handles flat current-directory relative file paths without error', async () => {
    const flatFile = resolve(process.cwd(), 'test_scratch_flat.wav');
    const sink = new WavFileStreamSink(flatFile);
    await sink.open();

    expect(fs.existsSync(flatFile)).toBe(true);
    await sink.finalize(24000, 1, 16);
    expect((await readFile(flatFile)).byteLength).toBe(44);
  });

  it('streams PCM deltas and updates WAV header correctly in created directory', async () => {
    const dest = resolve(TEST_SCRATCH_DIR, 'audio_out', 'session_01.wav');
    const sink = new WavFileStreamSink(dest);
    const eventBus = new UniversalEventBus();
    sink.attachToEventBus(eventBus, 24000, 1, 16);

    const chunk1 = new Uint8Array([10, 20, 30, 40]);
    const chunk2 = new Uint8Array([50, 60, 70, 80, 90, 100]);

    eventBus.emit('audio:delta', { chunkIndex: 0, audioData: chunk1 });
    eventBus.emit('audio:delta', { chunkIndex: 0, audioData: chunk2 });

    await new Promise((res) => setTimeout(res, 50));
    eventBus.emit('pipeline:complete', {
      totalChunksProcessed: 1,
      totalBytesGenerated: 10,
    });

    await new Promise((res) => setTimeout(res, 100));

    expect(fs.existsSync(dest)).toBe(true);
    const bytes = await readFile(dest);
    expect(bytes.byteLength).toBe(54); // 44 header + 10 PCM

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(40, true)).toBe(10);
  });

  it('NodeAudioFileWriter safely creates parent directories on write', async () => {
    const dest = resolve(TEST_SCRATCH_DIR, 'writer_nested', 'static.wav');
    const writer = new NodeAudioFileWriter();
    const fakeData = new Uint8Array([1, 2, 3, 4, 5]);

    await writer.writeAudioFile(dest, fakeData);

    expect(fs.existsSync(resolve(TEST_SCRATCH_DIR, 'writer_nested'))).toBe(true);
    expect(fs.existsSync(dest)).toBe(true);
    expect((await readFile(dest)).byteLength).toBe(5);
  });
});
