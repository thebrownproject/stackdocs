// Outbound delivery adapter: signed POST of the extraction result into the
// customer's system. HMAC-SHA256 over the raw body, sent as X-Trestle-Signature.

import { createHmac } from "node:crypto";
import { postWithRetry, type DeliveryResult } from "./http";

export type { DeliveryResult };

export interface DeliverPayload {
  agentId: string;
  documentId: string;
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
  minConfidence: number;
}

export async function deliverWebhook(
  url: string,
  secret: string | null,
  payload: DeliverPayload,
): Promise<DeliveryResult> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {};
  if (secret) {
    headers["X-Trestle-Signature"] = createHmac("sha256", secret).update(body).digest("hex");
  }
  return postWithRetry(url, body, { headers });
}
