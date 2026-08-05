export interface IFileReader {
  readText(source: string): Promise<string>;
}

export interface IAudioFileWriter {
  writeAudioFile(destination: string, wavData: Uint8Array): Promise<void>;
}

export interface IEnvProvider {
  getApiKey(): string | undefined;
}
