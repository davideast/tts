import { describe, expect, it } from 'bun:test';
import { generateTrackSlug } from '../../src/storage/slugifier.js';

describe('generateTrackSlug', () => {
  it('extracts explicit [TITLE: ...] directive', () => {
    const md = '[TITLE: Refactoring Authentication Middleware]\n\nHere is the plan...';
    const result = generateTrackSlug(md, 'step1');
    expect(result.title).toBe('Refactoring Authentication Middleware');
    expect(result.slug).toBe('refactoring-authentication-middleware');
  });

  it('extracts markdown H1 heading', () => {
    const md = '# Database Schema Migration\n\nWe updated the tables.';
    const result = generateTrackSlug(md, 'step2');
    expect(result.title).toBe('Database Schema Migration');
    expect(result.slug).toBe('database-schema-migration');
  });

  it('extracts markdown H2 heading and cleans formatting', () => {
    const md = '## Implementing `ChunkQueueAudioPlayer` with [Link](https://google.com)\n\nDetails.';
    const result = generateTrackSlug(md, 'step3');
    expect(result.title).toBe('Implementing ChunkQueueAudioPlayer with Link');
    expect(result.slug).toBe('implementing-chunkqueueaudioplayer-with-link');
  });

  it('falls back to first sentence when no headings exist', () => {
    const md = 'The quick brown fox jumps over the lazy dog. Here is the second sentence.';
    const result = generateTrackSlug(md, 'step4');
    expect(result.title).toBe('The quick brown fox jumps over the lazy dog.');
    expect(result.slug).toBe('the-quick-brown-fox-jumps-over-the-lazy-dog');
  });

  it('clamps slug length to at most 48 characters without trailing hyphens', () => {
    const md = '# Super Long Title That Exceeds The Maximum Slug Limit Of Forty Eight Characters';
    const result = generateTrackSlug(md, 'step5');
    expect(result.slug.length).toBeLessThanOrEqual(48);
    expect(result.slug).not.toEndWith('-');
  });

  it('handles empty markdown with deterministic fallback', () => {
    const result = generateTrackSlug('', 'abc123');
    expect(result.title).toBe('Response abc123');
    expect(result.slug).toBe('response-abc123');
  });
});
