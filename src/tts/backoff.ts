export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateBackoffMs(attempt: number, baseMs = 500, maxMs = 8000): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * 200;
  return Math.min(exponential + jitter, maxMs);
}
