// Per-agent destination adapters — the forward-deployed output seam.
//
// The default destination is the signed webhook (agents.webhook_url). For a
// customer whose system needs a specific payload shape, endpoint, and auth,
// register a destination adapter here keyed by agent id. process.ts prefers a
// registered adapter over the webhook.
//
// Example (in a customer-specific module imported at startup):
//   registerDestination("<agent-id>", httpDestination({
//     url: "https://their-app.example/api/intake",
//     headers: { Authorization: `Bearer ${process.env.THEIR_TOKEN}` },
//     transform: (ctx) => ({ formData: ctx.extractedFields, source: "trestle" }),
//   }));

import { postWithRetry, type DeliveryResult } from "./http";

export interface DeliveryContext {
  agentId: string;
  documentId: string;
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
  minConfidence: number;
}

export interface DestinationAdapter {
  /** Human-readable target, recorded in the delivery log. */
  label: string;
  deliver(ctx: DeliveryContext): Promise<DeliveryResult>;
}

const REGISTRY: Record<string, DestinationAdapter> = {};

export function registerDestination(agentId: string, adapter: DestinationAdapter): void {
  REGISTRY[agentId] = adapter;
}

export function getDestination(agentId: string): DestinationAdapter | undefined {
  return REGISTRY[agentId];
}

/** Build a destination that POSTs a (transformed) payload to a customer's HTTP API. */
export function httpDestination(opts: {
  url: string;
  headers?: Record<string, string>;
  /** Map the extraction result into the customer's expected request shape. */
  transform?: (ctx: DeliveryContext) => unknown;
}): DestinationAdapter {
  return {
    label: opts.url,
    deliver: (ctx) =>
      postWithRetry(opts.url, JSON.stringify(opts.transform ? opts.transform(ctx) : ctx), {
        headers: opts.headers,
      }),
  };
}
