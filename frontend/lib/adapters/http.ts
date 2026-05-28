// Shared HTTP delivery primitive: POST a body with retry on transient failures
// (5xx / 429 / network) using exponential backoff, each attempt time-boxed so a
// hung endpoint can't stall the function. Used by the webhook adapter and any
// custom destination adapter.

export interface DeliveryResult {
  ok: boolean;
  status: number;
  attempts: number;
  error?: string;
}

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function postWithRetry(
  url: string,
  body: string,
  opts?: { headers?: Record<string, string> },
): Promise<DeliveryResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts?.headers ?? {}) };

  let status = 0;
  let error: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      status = res.status;
      if (res.ok) return { ok: true, status, attempts: attempt };
      error = `HTTP ${status}`;
      // Don't retry client errors (4xx) other than rate-limiting.
      if (status < 500 && status !== 429) return { ok: false, status, attempts: attempt, error };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(500 * 2 ** (attempt - 1));
  }

  return { ok: false, status, attempts: MAX_ATTEMPTS, error };
}
