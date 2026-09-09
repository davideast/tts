import { lexer, type Token, type Tokens } from 'marked';
import type { WordHighlight } from '../audio/player/word-aligner.js';
import type { ChunkTiming } from '../storage/types.js';

export interface DocumentHighlight {
  paragraphIndex: number;
  docCharStart: number;
  docCharEnd: number;
}

interface DocWordToken {
  wordLower: string;
  docStart: number;
  docEnd: number;
  paragraphIndex: number;
}

function expandPathSpanInText(
  rawText: string,
  wordStart: number,
  wordEnd: number
): { start: number; end: number } {
  let start = wordStart;
  let end = wordEnd;
  while (start > 0 && /[a-zA-Z0-9/_.-]/.test(rawText[start - 1])) {
    start--;
  }
  while (end < rawText.length && /[a-zA-Z0-9/_.-]/.test(rawText[end])) {
    end++;
  }
  while (end > wordEnd && /[.,;:]/.test(rawText[end - 1])) {
    end--;
  }
  return { start, end };
}

function walkInlineAstTokens(
  tokens: Token[],
  parentOffset: number,
  parentRaw: string,
  paragraphIndex: number,
  out: DocWordToken[]
): void {
  let localCursor = 0;

  for (const token of tokens) {
    const relIdx = parentRaw.indexOf(token.raw, localCursor);
    const tokenOffset = parentOffset + (relIdx !== -1 ? relIdx : localCursor);
    localCursor = (relIdx !== -1 ? relIdx : localCursor) + token.raw.length;

    switch (token.type) {
      case 'codespan': {
        // Highlight the entire inline code tick span (`...`) as an atomic unit
        const codeToken = token as Tokens.Codespan;
        const fullSpanStart = tokenOffset;
        const fullSpanEnd = tokenOffset + codeToken.raw.length;
        const wordRegex = /[a-zA-Z0-9]+/g;
        let match: RegExpExecArray | null;
        while ((match = wordRegex.exec(codeToken.text)) !== null) {
          out.push({
            wordLower: match[0].toLowerCase(),
            docStart: fullSpanStart,
            docEnd: fullSpanEnd,
            paragraphIndex,
          });
        }
        break;
      }

      case 'link': {
        // Highlight the entire Markdown link `[label](url)` as an atomic unit
        const linkToken = token as Tokens.Link;
        const fullSpanStart = tokenOffset;
        const fullSpanEnd = tokenOffset + linkToken.raw.length;
        const labelText = linkToken.text || '';
        const wordRegex = /[a-zA-Z0-9]+/g;
        let match: RegExpExecArray | null;
        while ((match = wordRegex.exec(labelText)) !== null) {
          out.push({
            wordLower: match[0].toLowerCase(),
            docStart: fullSpanStart,
            docEnd: fullSpanEnd,
            paragraphIndex,
          });
        }
        break;
      }

      case 'strong':
      case 'em':
      case 'del': {
        const formatted = token as Tokens.Strong | Tokens.Em | Tokens.Del;
        if (formatted.tokens && formatted.tokens.length > 0) {
          walkInlineAstTokens(
            formatted.tokens,
            tokenOffset,
            formatted.raw,
            paragraphIndex,
            out
          );
        }
        break;
      }

      case 'text': {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          walkInlineAstTokens(
            textToken.tokens,
            tokenOffset,
            textToken.raw,
            paragraphIndex,
            out
          );
        } else {
          const wordRegex = /[a-zA-Z0-9]+/g;
          let match: RegExpExecArray | null;
          while ((match = wordRegex.exec(textToken.raw)) !== null) {
            const expanded = expandPathSpanInText(
              textToken.raw,
              match.index,
              match.index + match[0].length
            );
            out.push({
              wordLower: match[0].toLowerCase(),
              docStart: tokenOffset + expanded.start,
              docEnd: tokenOffset + expanded.end,
              paragraphIndex,
            });
          }
        }
        break;
      }

      default: {
        if ('tokens' in token && Array.isArray((token as any).tokens)) {
          walkInlineAstTokens(
            (token as any).tokens,
            tokenOffset,
            token.raw,
            paragraphIndex,
            out
          );
        }
        break;
      }
    }
  }
}

function tokenizeMarkdownAst(fullMarkdown: string): DocWordToken[] {
  const topTokens = lexer(fullMarkdown);
  const out: DocWordToken[] = [];
  let cursor = 0;
  let paragraphIndex = 0;

  for (const token of topTokens) {
    const idx = fullMarkdown.indexOf(token.raw, cursor);
    const tokenOffset = idx !== -1 ? idx : cursor;
    cursor = tokenOffset + token.raw.length;

    if (token.type === 'code' || token.type === 'space' || token.type === 'hr') {
      continue;
    }

    if (token.type === 'list') {
      const listToken = token as Tokens.List;
      let itemCursor = 0;
      for (const item of listToken.items) {
        const itemIdx = listToken.raw.indexOf(item.raw, itemCursor);
        const itemOffset = tokenOffset + (itemIdx !== -1 ? itemIdx : itemCursor);
        itemCursor = (itemIdx !== -1 ? itemIdx : itemCursor) + item.raw.length;
        if (item.tokens) {
          walkInlineAstTokens(item.tokens, itemOffset, item.raw, paragraphIndex, out);
        }
        paragraphIndex++;
      }
      continue;
    }

    if ('tokens' in token && Array.isArray((token as any).tokens)) {
      walkInlineAstTokens(
        (token as any).tokens,
        tokenOffset,
        token.raw,
        paragraphIndex,
        out
      );
      paragraphIndex++;
    }
  }

  return out;
}

function tokenizeChunkText(text: string): Array<{
  wordLower: string;
  charStart: number;
  charEnd: number;
}> {
  const tokens: Array<{ wordLower: string; charStart: number; charEnd: number }> = [];
  const regex = /[a-zA-Z0-9]+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      wordLower: match[0].toLowerCase(),
      charStart: match.index,
      charEnd: match.index + match[0].length,
    });
  }
  return tokens;
}

export function mapChunkToMarkdown(
  fullMarkdown: string,
  chunk: ChunkTiming,
  wordHighlight?: WordHighlight
): DocumentHighlight | null {
  if (!fullMarkdown || !chunk.text.trim()) return null;

  const docTokens = tokenizeMarkdownAst(fullMarkdown);
  if (docTokens.length === 0) return null;

  const chunkTokens = tokenizeChunkText(chunk.text);
  if (chunkTokens.length === 0) return null;

  // Determine which token index in chunk.text we are aligning
  let targetChunkIdx = 0;
  if (wordHighlight) {
    let bestDist = Infinity;
    for (let i = 0; i < chunkTokens.length; i++) {
      const dist = Math.abs(chunkTokens[i].charStart - wordHighlight.charStart);
      if (dist < bestDist) {
        bestDist = dist;
        targetChunkIdx = i;
      }
    }
  }

  const targetWordLower = chunkTokens[targetChunkIdx].wordLower;
  const expectedRatio = targetChunkIdx / Math.max(1, chunkTokens.length);

  let bestDocToken: DocWordToken | null = null;
  let bestScore = -1;
  let bestRatioDist = Infinity;

  for (let m = 0; m < docTokens.length; m++) {
    if (docTokens[m].wordLower !== targetWordLower) continue;

    // Score surrounding n-gram context window [-4 ... +4]
    let score = 0;
    for (let offset = -4; offset <= 4; offset++) {
      if (offset === 0) continue;
      const cTok = chunkTokens[targetChunkIdx + offset];
      const dTok = docTokens[m + offset];
      if (cTok && dTok && cTok.wordLower === dTok.wordLower) {
        const weight = Math.abs(offset) === 1 ? 5 : Math.abs(offset) === 2 ? 3 : 1;
        score += weight;
      }
    }

    const docRatio = m / Math.max(1, docTokens.length);
    const ratioDist = Math.abs(docRatio - expectedRatio);

    if (
      score > bestScore ||
      (score === bestScore && ratioDist < bestRatioDist)
    ) {
      bestScore = score;
      bestRatioDist = ratioDist;
      bestDocToken = docTokens[m];
    }
  }

  if (!bestDocToken) {
    return null;
  }

  if (!wordHighlight) {
    // Find end token for the chunk span within the same paragraph
    const endChunkIdx = chunkTokens.length - 1;
    const endWordLower = chunkTokens[endChunkIdx].wordLower;
    let bestEndToken = bestDocToken;
    for (let m = docTokens.length - 1; m >= 0; m--) {
      if (
        docTokens[m].paragraphIndex === bestDocToken.paragraphIndex &&
        docTokens[m].wordLower === endWordLower &&
        docTokens[m].docStart >= bestDocToken.docStart
      ) {
        bestEndToken = docTokens[m];
        break;
      }
    }

    let docCharEnd = bestEndToken.docEnd;
    while (docCharEnd < fullMarkdown.length && /[.!?)`'"]/.test(fullMarkdown[docCharEnd])) {
      docCharEnd++;
    }

    return {
      paragraphIndex: bestDocToken.paragraphIndex,
      docCharStart: bestDocToken.docStart,
      docCharEnd,
    };
  }

  return {
    paragraphIndex: bestDocToken.paragraphIndex,
    docCharStart: bestDocToken.docStart,
    docCharEnd: bestDocToken.docEnd,
  };
}
