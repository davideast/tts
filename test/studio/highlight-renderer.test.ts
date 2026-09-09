import { describe, expect, it } from 'bun:test';
import { buildHighlightedMarkdownBlocks } from '../../src/studio/highlight-renderer.js';
import type { ChunkTiming } from '../../src/storage/types.js';

describe('buildHighlightedMarkdownBlocks (R1)', () => {
  it('returns an empty array for empty or whitespace markdown', () => {
    expect(buildHighlightedMarkdownBlocks('', [], 0)).toEqual([]);
    expect(buildHighlightedMarkdownBlocks('   \n\n  ', [], 1000)).toEqual([]);
  });

  it('splits markdown into paragraph and fenced code blocks without altering code blocks', () => {
    const markdown = [
      'First spoken paragraph with some words.',
      '',
      '```ts',
      'const x = "First spoken paragraph with some words.";',
      'console.log(x);',
      '```',
      '',
      'Second spoken paragraph after code block.',
    ].join('\n');

    const chunkTimings: ChunkTiming[] = [
      {
        chunkIndex: 0,
        startMs: 1000,
        endMs: 4000,
        text: 'First spoken paragraph with some words.',
      },
      {
        chunkIndex: 1,
        startMs: 5000,
        endMs: 8000,
        text: 'Second spoken paragraph after code block.',
      },
    ];

    const blocks = buildHighlightedMarkdownBlocks(markdown, chunkTimings, 0);
    expect(blocks).toHaveLength(3);

    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].text).toBe('First spoken paragraph with some words.');
    expect(blocks[0].timestampBadge).toBe('[00:01]');
    expect(blocks[0].isActive).toBe(false);

    expect(blocks[1].type).toBe('code');
    expect(blocks[1].text).toBe(
      '```ts\nconst x = "First spoken paragraph with some words.";\nconsole.log(x);\n```'
    );
    expect(blocks[1].timestampBadge).toBeUndefined();
    expect(blocks[1].isActive).toBe(false);
    expect(blocks[1].beforeWord).toBe(blocks[1].text);
    expect(blocks[1].activeWord).toBe('');
    expect(blocks[1].afterWord).toBe('');

    expect(blocks[2].type).toBe('paragraph');
    expect(blocks[2].text).toBe('Second spoken paragraph after code block.');
    expect(blocks[2].timestampBadge).toBe('[00:05]');
    expect(blocks[2].isActive).toBe(false);
  });

  it('identifies the active spoken paragraph and slices exact beforeWord, activeWord, afterWord spans', () => {
    const markdown = [
      'Alpha beta gamma delta.',
      '',
      '```js',
      'const y = 42;',
      '```',
      '',
      'Epsilon zeta eta theta.',
    ].join('\n');

    const chunkTimings: ChunkTiming[] = [
      {
        chunkIndex: 0,
        startMs: 0,
        endMs: 2000,
        text: 'Alpha beta gamma delta.',
      },
      {
        chunkIndex: 1,
        startMs: 2000,
        endMs: 4000,
        text: 'Epsilon zeta eta theta.',
      },
    ];

    // At positionMs = 2100 (early in chunk 1 -> "Epsilon")
    const blocks = buildHighlightedMarkdownBlocks(markdown, chunkTimings, 2100);
    expect(blocks).toHaveLength(3);

    // Paragraph 0 is inactive
    expect(blocks[0].isActive).toBe(false);
    expect(blocks[0].beforeWord).toBe('Alpha beta gamma delta.');
    expect(blocks[0].activeWord).toBe('');
    expect(blocks[0].afterWord).toBe('');

    // Code block is inactive
    expect(blocks[1].isActive).toBe(false);

    // Paragraph 2 is active
    expect(blocks[2].isActive).toBe(true);
    expect(blocks[2].activeWord).toBe('Epsilon');
    expect(blocks[2].beforeWord).toBe('');
    expect(blocks[2].afterWord).toBe(' zeta eta theta.');
    expect(blocks[2].beforeWord + blocks[2].activeWord + blocks[2].afterWord).toBe(
      blocks[2].text
    );
  });

  it('handles out-of-bounds positionMs with all blocks inactive', () => {
    const markdown = 'Single paragraph of spoken text.';
    const chunkTimings: ChunkTiming[] = [
      {
        chunkIndex: 0,
        startMs: 1000,
        endMs: 3000,
        text: 'Single paragraph of spoken text.',
      },
    ];

    const before = buildHighlightedMarkdownBlocks(markdown, chunkTimings, 500);
    expect(before[0].isActive).toBe(false);
    expect(before[0].activeWord).toBe('');
    expect(before[0].beforeWord).toBe('Single paragraph of spoken text.');

    const after = buildHighlightedMarkdownBlocks(markdown, chunkTimings, 3500);
    expect(after[0].isActive).toBe(false);
    expect(after[0].activeWord).toBe('');
    expect(after[0].beforeWord).toBe('Single paragraph of spoken text.');
  });

  it('highlights the active word when Markdown contains bold/code syntax (**, `) that was stripped from spoken chunk text', () => {
    const markdown = '- **Fix**: Define a single `PathContextOpts` interface for callers.';
    const chunkTimings: ChunkTiming[] = [
      {
        chunkIndex: 0,
        startMs: 0,
        endMs: 2000,
        text: 'Fix: Define a single PathContextOpts interface for callers.',
      },
    ];

    // At 100ms, active word is "Fix"
    const blocks = buildHighlightedMarkdownBlocks(markdown, chunkTimings, 100);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].isActive).toBe(true);
    expect(blocks[0].activeWord).toBe('Fix');
    expect(blocks[0].beforeWord + blocks[0].activeWord + blocks[0].afterWord).toBe(
      markdown
    );
  });
});
