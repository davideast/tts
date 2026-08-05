import { readFile } from 'node:fs/promises';
import type { IFileReader } from '../types/platform.js';

export class NodeFileReader implements IFileReader {
  async readText(source: string): Promise<string> {
    return await readFile(source, 'utf-8');
  }
}
