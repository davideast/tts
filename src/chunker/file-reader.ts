import { readFile } from 'node:fs/promises';
import type { IFileReader } from '../types/platform.js';

export class NodeFileReader implements IFileReader {
  async readText(source: string): Promise<string> {
    try {
      return await readFile(source, 'utf-8');
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        throw new Error(`Input file not found: ${source}`);
      }
      throw err;
    }
  }
}
