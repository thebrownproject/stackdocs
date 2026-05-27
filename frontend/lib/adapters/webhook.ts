// Outbound delivery adapter: signed POST of the extraction result into the
// customer's system. HMAC-SHA256 over the raw body, sent as X-Trestle-Signature.
// Retries on transient failures (5xx / 429 / network) with exponential backoff;
// each request has its own timeout so a hung endpoint can't stall the function.

import { createHmac } from "node:crypto";

export interface DeliverPayload {
  agentId: string;
  documentId: string;
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
  minConfidence: number;
}

export interface DeliveryResult {
  ok: boolean;
  status: number;
  attempts: number;
  error?: string;
}

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function deliverWebhook(
  url: string,
  secret: string | null,
  payload: DeliverPayload,
): Promise<DeliveryResult> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    headers["X-Trestle-Signature"] = createHmac("sha256", secret).update(body).digest("hex");
  }

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
