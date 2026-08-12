import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { IAudioFileWriter } from '../types/platform.js';

export class NodeAudioFileWriter implements IAudioFileWriter {
  async writeAudioFile(destination: string, wavData: Uint8Array): Promise<void> {
    const parentDir = dirname(resolve(destination));
    await mkdir(parentDir, { recursive: true });
    await writeFile(destination, wavData);
  }
}
