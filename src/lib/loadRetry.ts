export const LOAD_RETRY_COUNT = 3;

const DEFAULT_RETRY_DELAYS_MS = [250, 500, 1_000];

export interface RetryOptions {
  signal?: AbortSignal;
  /** Number of retries after the initial attempt. */
  retries?: number;
  /** Delay before each retry, or a function receiving the zero-based retry index. */
  delayMs?: number | ((retryIndex: number) => number);
}

function abortError(signal?: AbortSignal) {
  return signal?.reason ?? new DOMException("加载已取消", "AbortError");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError(signal);
}

function waitForRetry(delayMs: number, signal?: AbortSignal) {
  throwIfAborted(signal);
  const delay = Math.max(0, Number.isFinite(delayMs) ? delayMs : 0);
  if (!delay) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(abortError(signal));
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Run a load operation once, then retry it up to three times by default. */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  {
    signal,
    retries = LOAD_RETRY_COUNT,
    delayMs,
  }: RetryOptions = {},
): Promise<T> {
  const retryCount = Math.max(0, Math.floor(retries));
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await operation();
    } catch (error) {
      if (signal?.aborted) throw abortError(signal);
      lastError = error;
      if (attempt >= retryCount) throw error;
      const retryIndex = attempt;
      const retryDelay = typeof delayMs === "function"
        ? delayMs(retryIndex)
        : delayMs ?? DEFAULT_RETRY_DELAYS_MS[retryIndex] ?? DEFAULT_RETRY_DELAYS_MS.at(-1)!;
      await waitForRetry(retryDelay, signal);
    }
  }

  throw lastError ?? new Error("加载失败");
}
