import { describe, expect, it } from 'bun:test';
import { parseMarkdownToSpeakableParagraphs } from './markdown-ast-parser.js';
import { sanitizeTextForSpeech } from './url-sanitizer.js';

describe('Speech URL Sanitization - Simple Reproduction', () => {
  it('strips bare URLs and parenthetical example URLs from text', () => {
    const input =
      'After it finishes, results will appear on the dashboard (ex: https://example.com/screenshot/0abc123).';
    const expected = 'After it finishes, results will appear on the dashboard.';
    expect(sanitizeTextForSpeech(input)).toBe(expected);
  });

  it('cleans anchor hash fragments from shortlinks', () => {
    const input = 'You can run this via the CLI: go/my-tool#run-via-cli for options.';
    const expected = 'You can run this via the CLI: go/my-tool for options.';
    expect(sanitizeTextForSpeech(input)).toBe(expected);
  });

  it('integrates with markdown paragraph extraction without reading raw URLs', () => {
    const markdown =
      'Check the report at https://example.org/report/xyz987 (see: https://example.org/view).';
    const paragraphs = parseMarkdownToSpeakableParagraphs(markdown);
    expect(paragraphs).toEqual(['Check the report at.']);
  });
});

describe('Speech URL Sanitization - Edge Cases & Complex Scenarios', () => {
  it('preserves descriptive markdown anchor text while stripping URL target', () => {
    const markdown = 'Please read the [developer setup guide](https://example.com/docs/setup) before continuing.';
    const paragraphs = parseMarkdownToSpeakableParagraphs(markdown);
    expect(paragraphs).toEqual(['Please read the developer setup guide before continuing.']);
  });

  it('discards markdown links when anchor text is itself a raw URL', () => {
    const markdown = 'Download the binary from [https://github.com/org/repo/releases](https://github.com/org/repo/releases).';
    const paragraphs = parseMarkdownToSpeakableParagraphs(markdown);
    expect(paragraphs).toEqual(['Download the binary from.']);
  });

  it('strips autolink format <https://...>', () => {
    const markdown = 'Visit <https://example.com/api/v2> for documentation.';
    const paragraphs = parseMarkdownToSpeakableParagraphs(markdown);
    expect(paragraphs).toEqual(['Visit for documentation.']);
  });

  it('handles multiple parenthetical URL prefixes (see, source, ref, link, ex)', () => {
    expect(sanitizeTextForSpeech('Data verified (source: https://data.gov/2026).')).toBe('Data verified.');
    expect(sanitizeTextForSpeech('Refer to specs (ref: https://specs.org/v1).')).toBe('Refer to specs.');
    expect(sanitizeTextForSpeech('Live metrics (link: https://metrics.internal).')).toBe('Live metrics.');
    expect(sanitizeTextForSpeech('Architecture diagram (https://assets.corp.net/img.png).')).toBe('Architecture diagram.');
  });

  it('handles complex URLs with port, query params, tokens, and hashes', () => {
    const complex =
      'API endpoint: https://api.internal.net:8443/v2/queries?session_id=987&token=xyz-123_abc#results-pane is ready.';
    expect(sanitizeTextForSpeech(complex)).toBe('API endpoint: is ready.');
  });

  it('handles multiple URLs in a single sentence without leaving orphan punctuation or spaces', () => {
    const input =
      'Compare https://example.com/a with https://example.com/b (or see https://example.com/c).';
    expect(sanitizeTextForSpeech(input)).toBe('Compare with.');
  });

  it('cleans multi-segment shortlinks with hash fragments', () => {
    expect(sanitizeTextForSpeech('Check go/team-infra/deploy#canary-rollout now.')).toBe(
      'Check go/team-infra/deploy now.'
    );
    expect(sanitizeTextForSpeech('Shortlink go/simple is unchanged.')).toBe(
      'Shortlink go/simple is unchanged.'
    );
  });

  it('sanitizes URLs within Markdown block structures (headings, lists, blockquotes)', () => {
    const markdown = `
# System Architecture (https://example.com/arch)

* Module A: details at https://example.com/mod-a (ref: https://example.com/ref-a)
* Module B: [Read Guide](https://example.com/guide)

> Note: For status, see https://status.example.com/live
`;
    const paragraphs = parseMarkdownToSpeakableParagraphs(markdown);
    expect(paragraphs).toEqual([
      'System Architecture.',
      'Module A: details at',
      'Module B: Read Guide',
      'Note: For status, see',
    ]);
  });

  it('leaves standard non-URL text, numbers, and technical terms untouched', () => {
    const text = 'Model version 3.1 Flash operates with 24kHz 16-bit audio. Email support@example.com if issues arise.';
    expect(sanitizeTextForSpeech(text)).toBe(text);
  });
});
