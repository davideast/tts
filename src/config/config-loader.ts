import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { MdMediaConfig } from './file-config.js';

export async function loadConfigFile(
  cwd = process.cwd(),
  fileName = '.mdmedia.json'
): Promise<MdMediaConfig> {
  const configPath = resolve(cwd, fileName);
  try {
    const data = await readFile(configPath, 'utf-8');
    return JSON.parse(data) as MdMediaConfig;
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return {};
    }
    throw new Error(`Failed to parse ${fileName}: ${error.message || error}`);
  }
}
