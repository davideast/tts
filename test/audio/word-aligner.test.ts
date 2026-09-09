import { describe, expect, it } from 'bun:test';
import { getActiveWordAtPosition } from '../../src/audio/player/word-aligner.js';
import type { ChunkTiming } from '../../src/storage/types.js';

describe('WordTimingAligner (Seam 2)', () => {
  const sampleChunk: ChunkTiming = {
    chunkIndex: 0,
    startMs: 1000,
    endMs: 5000,
    text: 'We added a history stack, so calling prev() rewinds.',
  };

  it('returns null when positionMs is before startMs or after endMs', () => {
    expect(getActiveWordAtPosition(sampleChunk, 999)).toBeNull();
    expect(getActiveWordAtPosition(sampleChunk, 5001)).toBeNull();
  });

  it('resolves the active word and exact character offsets within chunk.text using character and punctuation weights', () => {
    // At the start of the chunk (1000ms), first word "We" should be highlighted
    const startHighlight = getActiveWordAtPosition(sampleChunk, 1000);
    expect(startHighlight).not.toBeNull();
    expect(startHighlight?.wordIndex).toBe(0);
    expect(startHighlight?.word).toBe('We');
    expect(startHighlight?.charStart).toBe(0);
    expect(startHighlight?.charEnd).toBe(2);
    expect(sampleChunk.text.slice(startHighlight!.charStart, startHighlight!.charEnd)).toBe('We');

    // Near the end of the chunk (4950ms), last word "rewinds." should be highlighted
    const endHighlight = getActiveWordAtPosition(sampleChunk, 4950);
    expect(endHighlight).not.toBeNull();
    expect(endHighlight?.word).toBe('rewinds.');
    expect(sampleChunk.text.slice(endHighlight!.charStart, endHighlight!.charEnd)).toBe('rewinds.');
  });

  it('weights words with commas/periods longer than plain words of identical character length', () => {
    const chunkNoComma: ChunkTiming = {
      chunkIndex: 0,
      startMs: 0,
      endMs: 1000,
      text: 'Hello world',
    };
    const chunkWithComma: ChunkTiming = {
      chunkIndex: 0,
      startMs: 0,
      endMs: 1000,
      text: 'Hello, world',
    };

    // At 550ms (55% elapsed):
    // In "Hello world" (5 + 5 = 10 weight), 55% is in "world" (index 1).
    // In "Hello, world" (6+4=10 + 5 = 15 weight), "Hello," spans 0..10 (66.6%), so 550ms is still on "Hello," (index 0).
    const plainWord = getActiveWordAtPosition(chunkNoComma, 550);
    const commaWord = getActiveWordAtPosition(chunkWithComma, 550);

    expect(plainWord?.wordIndex).toBe(1);
    expect(commaWord?.wordIndex).toBe(0);
    expect(commaWord?.word).toBe('Hello,');
  });

  it('extracts ground-truth wordTimings from a 16-bit PCM waveform and uses exact lookup in getActiveWordAtPosition', () => {
    // Build a 1000ms PCM buffer (48000 bytes):
    // 0..200ms silent, 200..500ms high energy ("Hello"), 500..600ms silent gap, 600..900ms high energy ("world")
    const pcmBuffer = new Uint8Array(48000);
    const view = new DataView(pcmBuffer.buffer);
    // Fill 200..500ms with high amplitude (e.g. 5000)
    for (let byte = 200 * 48; byte < 500 * 48; byte += 2) {
      view.setInt16(byte, 5000, true);
    }
    // Fill 600..900ms with high amplitude (e.g. 5000)
    for (let byte = 600 * 48; byte < 900 * 48; byte += 2) {
      view.setInt16(byte, 5000, true);
    }

    const { extractWordTimingsFromPcm } = require('../../src/audio/player/word-aligner.js');
    const timings = extractWordTimingsFromPcm(pcmBuffer, 'Hello world', 1000);

    expect(timings).toHaveLength(2);
    expect(timings[0].word).toBe('Hello');
    expect(timings[1].word).toBe('world');
    expect(timings[0].startMs).toBeGreaterThanOrEqual(1200);
    expect(timings[1].startMs).toBeGreaterThanOrEqual(timings[0].endMs);

    const chunkWithTimings: ChunkTiming = {
      chunkIndex: 0,
      startMs: 1000,
      endMs: 2000,
      text: 'Hello world',
      wordTimings: timings,
    };

    const atFirstWord = getActiveWordAtPosition(chunkWithTimings, timings[0].startMs + 20);
    expect(atFirstWord?.word).toBe('Hello');

    const atSecondWord = getActiveWordAtPosition(chunkWithTimings, timings[1].startMs + 20);
    expect(atSecondWord?.word).toBe('world');
  });
});
