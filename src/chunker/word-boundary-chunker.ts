import type { DocumentChunk } from '../types/chunk.js';

const DEFAULT_MAX_CHUNK_CHARS = 400;

function isSentenceEnd(text: string, index: number): boolean {
  const char = text[index];
  if (char !== '.' && char !== '!' && char !== '?') {
    return false;
  }
  // Check that sentence punctuation is followed by whitespace or end of string
  if (index + 1 >= text.length) {
    return true;
  }
  const nextChar = text[index + 1];
  return nextChar === ' ' || nextChar === '\n' || nextChar === '\r' || nextChar === '\t';
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\t' || char === '\r';
}

function countWords(text: string): number {
  let count = 0;
  let inWord = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (isWhitespace(char)) {
      if (inWord) {
        inWord = false;
      }
    } else {
      if (!inWord) {
        count++;
        inWord = true;
      }
    }
  }

  return count;
}

function splitLongText(text: string, maxChars: number): string[] {
  const slices: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const remaining = text.length - startIndex;
    if (remaining <= maxChars) {
      slices.push(text.slice(startIndex).trim());
      break;
    }

    let splitIndex = startIndex + maxChars;
    const minSplitIndex = startIndex + Math.floor(maxChars * 0.35);

    // Pass 1: Prioritize sentence-ending punctuation (., !, ?)
    let foundSentenceEnd = false;
    for (let i = splitIndex; i >= minSplitIndex; i--) {
      if (isSentenceEnd(text, i)) {
        splitIndex = i + 1; // Include the punctuation mark
        foundSentenceEnd = true;
        break;
      }
    }

    // Pass 2: Fallback to whitespace word boundary if no sentence end found
    if (!foundSentenceEnd) {
      for (let i = splitIndex; i >= minSplitIndex; i--) {
        if (isWhitespace(text[i])) {
          splitIndex = i + 1;
          break;
        }
      }
    }

    // Pass 3: Hard limit if no boundary found
    if (splitIndex <= minSplitIndex) {
      splitIndex = startIndex + maxChars;
    }

    const chunkText = text.slice(startIndex, splitIndex).trim();
    if (chunkText.length > 0) {
      slices.push(chunkText);
    }

    startIndex = splitIndex;
  }

  return slices;
}

export function chunkSpeakableParagraphs(
  paragraphs: string[],
  maxChunkChars = DEFAULT_MAX_CHUNK_CHARS
): DocumentChunk[] {
  const rawSegments: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkChars) {
      rawSegments.push(paragraph);
    } else {
      const subSegments = splitLongText(paragraph, maxChunkChars);
      for (const seg of subSegments) {
        rawSegments.push(seg);
      }
    }
  }

  const chunks: DocumentChunk[] = [];
  let currentText = '';
  let chunkIndex = 0;

  for (const segment of rawSegments) {
    const candidateLength = currentText.length > 0
      ? currentText.length + 1 + segment.length
      : segment.length;

    if (candidateLength <= maxChunkChars) {
      currentText = currentText.length > 0 ? `${currentText} ${segment}` : segment;
    } else {
      if (currentText.length > 0) {
        chunks.push({
          id: `chunk-${chunkIndex}`,
          index: chunkIndex,
          text: currentText,
          charCount: currentText.length,
          wordCount: countWords(currentText),
        });
        chunkIndex++;
      }
      currentText = segment;
    }
  }

  if (currentText.length > 0) {
    chunks.push({
      id: `chunk-${chunkIndex}`,
      index: chunkIndex,
      text: currentText,
      charCount: currentText.length,
      wordCount: countWords(currentText),
    });
  }

  return chunks;
}
