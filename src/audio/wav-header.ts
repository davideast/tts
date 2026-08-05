export function createWavHeader(
  dataByteLength: number,
  sampleRate = 24000,
  channels = 1,
  bitDepth = 16
): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  function writeString(offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      header[offset + i] = str.charCodeAt(i);
    }
  }

  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');

  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // 1 = Linear PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  return header;
}
