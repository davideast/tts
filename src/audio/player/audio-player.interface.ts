export interface IAudioPlayer {
  playChunk(chunkIndex: number, wavBuffer: Uint8Array): Promise<void>;
  stop(): Promise<void>;
  togglePause?(): boolean;
  reset?(): void;
  waitForIdle(): Promise<void>;
}

