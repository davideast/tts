import { describe, expect, it } from 'bun:test';
import { mapChunkToMarkdown } from '../../src/chunker/markdown-mapper.js';
import type { ChunkTiming } from '../../src/storage/types.js';
import type { WordHighlight } from '../../src/audio/player/word-aligner.js';

describe('MarkdownChunkMapper (Seam 3)', () => {
  const sampleMarkdown = [
    '# Refactoring PlaybackEngine',
    '',
    '```ts',
    'public history: TrackMetadata[] = [];',
    '```',
    '',
    'We added a history stack to PlaybackEngine so calling prev() rewinds.',
  ].join('\n');

  it('resolves the active paragraph character range within fullMarkdown skipping code blocks', () => {
    const chunk: ChunkTiming = {
      chunkIndex: 1,
      startMs: 1000,
      endMs: 5000,
      text: 'We added a history stack to PlaybackEngine so calling prev() rewinds.',
    };

    const docHighlight = mapChunkToMarkdown(sampleMarkdown, chunk);
    expect(docHighlight).not.toBeNull();

    const extracted = sampleMarkdown.slice(docHighlight!.docCharStart, docHighlight!.docCharEnd);
    expect(extracted).toBe('We added a history stack to PlaybackEngine so calling prev() rewinds.');
  });

  it('resolves the exact word span within fullMarkdown when wordHighlight is provided', () => {
    const chunk: ChunkTiming = {
      chunkIndex: 1,
      startMs: 1000,
      endMs: 5000,
      text: 'We added a history stack to PlaybackEngine so calling prev() rewinds.',
    };

    const wordHighlight: WordHighlight = {
      wordIndex: 3,
      word: 'history',
      charStart: 11,
      charEnd: 18,
    };

    const docHighlight = mapChunkToMarkdown(sampleMarkdown, chunk, wordHighlight);
    expect(docHighlight).not.toBeNull();

    const extractedWord = sampleMarkdown.slice(docHighlight!.docCharStart, docHighlight!.docCharEnd);
    expect(extractedWord).toBe('history');
  });

  it('expands highlight to cover full inline code tick span (e.g. `origin/main`) and ignores markdown link URL targets', () => {
    const markdownWithLinksAndCode =
      'The implementation from [PR #283](https://github.com/google-labs-code/jitro-cli/pull/283) branched off `origin/main` at commit `4f5d6c9`.';
    const chunk: ChunkTiming = {
      chunkIndex: 0,
      startMs: 0,
      endMs: 4000,
      text: 'The implementation from PR #283 branched off origin/main at commit 4f5d6c9.',
    };

    // Word highlight on "origin/main" (starts at char 45 in chunk.text)
    const wordHighlight: WordHighlight = {
      wordIndex: 7,
      word: 'origin/main',
      charStart: chunk.text.indexOf('origin/main'),
      charEnd: chunk.text.indexOf('origin/main') + 'origin/main'.length,
    };

    const docHighlight = mapChunkToMarkdown(markdownWithLinksAndCode, chunk, wordHighlight);
    expect(docHighlight).not.toBeNull();

    const extractedSpan = markdownWithLinksAndCode.slice(
      docHighlight!.docCharStart,
      docHighlight!.docCharEnd
    );
    expect(extractedSpan).toBe('`origin/main`');
  });
});
