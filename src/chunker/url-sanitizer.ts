/**
 * Sanitizes raw URLs, parenthetical links, anchor hashes, and markdown image syntax for natural text-to-speech recitation.
 */
export function sanitizeTextForSpeech(text: string): string {
  let cleaned = text;

  // 1. Strip markdown image syntax: ![alt](url), ![][ref], ![alt]
  cleaned = cleaned.replace(/!\[.*?\](?:\(.*?\)|\[.*?\])?/g, '');

  // 2. Strip parenthetical URLs like (https://...), (ex: https://...), (or see https://...), (source: http://...)
  cleaned = cleaned.replace(/\((?:[^()]*?[:\s]*)?https?:\/\/[^\s\)]+\)/gi, '');

  // 3. Strip parenthetical references like (see below): or (see above)
  cleaned = cleaned.replace(/\((?:see|refer to|shown|as shown)?\s*(?:below|above)\)\s*[:]?/gi, '');

  // 4. Strip autolink wrappers <https://...>
  cleaned = cleaned.replace(/<https?:\/\/[^>]+>/gi, '');

  // 5. Strip standalone HTTP/HTTPS URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s\)\]>]+/gi, '');

  // 6. Strip anchor hash fragments from shortlinks (e.g. go/team-infra/deploy#canary-rollout -> go/team-infra/deploy)
  cleaned = cleaned.replace(/\b(go\/[a-zA-Z0-9_\-\/]+)#[a-zA-Z0-9_\-]+/gi, '$1');

  // 7. Clean up orphan empty parentheses and labels left behind after AST link stripping:
  // e.g. (), (see: ), (ref: ), (ex: ), (source: )
  cleaned = cleaned.replace(/\((?:[a-zA-Z\s,.]*[:]\s*|\s*)\)/gi, '');
  cleaned = cleaned.replace(/\((?:ex|see|or see|source|link|url|ref|e\.g\.)\s*\)/gi, '');

  // 8. Clean up whitespace before punctuation marks
  cleaned = cleaned.replace(/\s+([.,!?:;])/g, '$1');

  // 9. Clean up multiple spaces
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

  return cleaned.trim();
}
