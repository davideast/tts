import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { IAudioPlayer } from './audio-player.interface.js';

export function detectSystemAudioPlayer(): string {
  if (process.platform === 'darwin') {
    if (fs.existsSync('/usr/bin/afplay')) return '/usr/bin/afplay';
    return 'afplay';
  }
  // Linux / Unix detection
  return 'aplay';
}

export class ChunkQueueAudioPlayer implements IAudioPlayer {
  private activeProcess?: ChildProcess;
  private isAborted = false;
  private queue: Promise<void> = Promise.resolve();
  private readonly playerCommand: string;

  constructor(playerCommand?: string) {
    this.playerCommand = playerCommand ?? detectSystemAudioPlayer();
  }

  async playChunk(chunkIndex: number, wavBuffer: Uint8Array): Promise<void> {
    if (this.isAborted) return;

    this.queue = this.queue.then(async () => {
      if (this.isAborted) return;

      const tempFile = path.join(
        os.tmpdir(),
        `tts_live_chunk_${Date.now()}_${chunkIndex}_${Math.random().toString(36).slice(2, 6)}.wav`
      );

      try {
        await writeFile(tempFile, wavBuffer);

        await new Promise<void>((resolvePromise, rejectPromise) => {
          if (this.isAborted) {
            resolvePromise();
            return;
          }

          const child = spawn(this.playerCommand, [tempFile], {
            stdio: 'ignore',
          });
          this.activeProcess = child;

          child.once('error', (err) => {
            this.activeProcess = undefined;
            // If player binary not found, don't crash the whole pipeline, log a warning
            console.warn(`[AudioPlayer] Warning: Failed to spawn ${this.playerCommand}:`, err.message);
            resolvePromise();
          });

          child.once('close', () => {
            this.activeProcess = undefined;
            resolvePromise();
          });
        });
      } finally {
        if (fs.existsSync(tempFile)) {
          await unlink(tempFile).catch(() => {});
        }
      }
    });

    return this.queue;
  }

  async stop(): Promise<void> {
    this.isAborted = true;
    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGTERM');
      } catch {
        // Ignore kill errors
      }
      this.activeProcess = undefined;
    }
  }

  async waitForIdle(): Promise<void> {
    await this.queue;
  }
}
