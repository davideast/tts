import { writeFile } from 'node:fs/promises';
import type { IAudioFileWriter } from '../types/platform.js';

export class NodeAudioFileWriter implements IAudioFileWriter {
  async writeAudioFile(destination: string, wavData: Uint8Array): Promise<void> {
    await writeFile(destination, wavData);
  }
}
