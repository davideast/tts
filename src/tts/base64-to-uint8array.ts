export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined' && Buffer.from) {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
