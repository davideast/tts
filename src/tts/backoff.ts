export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateBackoffMs(attempt: number, baseMs = 500, maxMs = 8000): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * 200;
  return Math.min(exponential + jitter, maxMs);
}

export function isRetryableError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error);
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('rate limit') ||
    msg.includes('timeout')
  );
}
