interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("429") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("fetch")
  );
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  { retries = 3, baseDelayMs = 250 }: RetryOptions = {},
): Promise<T> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableError(error)) {
        throw error;
      }
      const jitter = Math.floor(Math.random() * 80);
      const delay = baseDelayMs * 2 ** attempt + jitter;
      await sleep(delay);
      attempt += 1;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown retry error.");
}
