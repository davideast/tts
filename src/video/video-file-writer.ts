import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface IVideoFileWriter {
  writeVideoFile(destinationPath: string, videoData: Uint8Array): Promise<void>;
}

export class NodeVideoFileWriter implements IVideoFileWriter {
  async writeVideoFile(destinationPath: string, videoData: Uint8Array): Promise<void> {
    const fullPath = resolve(destinationPath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, videoData);
  }
}
