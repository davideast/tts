import type { DocumentChunk } from '../types/chunk.js';
import type { IFileReader } from '../types/platform.js';
import { parseMarkdownToSpeakableParagraphs } from './markdown-ast-parser.js';
import { chunkSpeakableParagraphs } from './word-boundary-chunker.js';

export async function prepareDocumentChunks(
  fileReader: IFileReader,
  sourcePath: string,
  maxChunkChars?: number
): Promise<DocumentChunk[]> {
  const rawMarkdown = await fileReader.readText(sourcePath);
  const speakableParagraphs = parseMarkdownToSpeakableParagraphs(rawMarkdown);
  return chunkSpeakableParagraphs(speakableParagraphs, maxChunkChars);
}

export * from './file-reader.js';
export * from './markdown-ast-parser.js';
export * from './word-boundary-chunker.js';
export * from './url-sanitizer.js';

