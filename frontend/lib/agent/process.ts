// Shared production extraction core, used by both the embeddable API-key route
// (/api/extract) and the dashboard's Clerk-authed manual upload (/process).
// Runs the tuned agent over one document, calibrates confidence, persists the
// document + extraction, then routes by confidence (webhook vs review queue).

import type { SupabaseClient } from "@supabase/supabase-js";
import { runAgent } from "./runtime";
import { getAgentTools } from "./tools/registry";
import { deliverWebhook } from "../adapters/webhook";
import { assertQuotaAllowed, checkQuota, recordUsage } from "../billing/enforce";
import { deliverAll, resolveDestinations, type DeliveryContext, type DestinationAdapter } from "../destinations/resolver";
import { applyCalibration, type CalibrationMap } from "../harness/calibration";
import type { FieldSchema } from "../harness/types";

export const REVIEW_THRESHOLD = 0.7; // calibrated min-confidence below which a doc is queued for review

export interface ProcessAgent {
  id: string;
  user_id: string;
  webhook_url: string | null;
  webhook_secret: string | null;
}

export interface ProcessBundle {
  field_schema: FieldSchema;
  rules: string | null;
  few_shot_sample_ids: unknown;
  calibration_map: unknown;
}

export interface ProcessInput {
  file: { data: Uint8Array | string; mediaType: string };
  filename: string;
  storedPath: string;
  fileSize: number;
  mimeType: string;
}

export interface ProcessResult {
  documentId: string;
  status: "needs_review" | "extracted";
  extractedFields: Record<string, unknown>;
  confidenceScores: Record<string, unknown>;
  minConfidence: number;
  delivered: boolean;
}

export async function processDocument(
  db: SupabaseClient,
  agent: ProcessAgent,
  bundle: ProcessBundle,
  input: ProcessInput,
): Promise<ProcessResult> {
  assertQuotaAllowed(await checkQuota(db, agent.user_id));

  // Resolve few-shot exemplars referenced by the bundle.
  const fewShotIds = Array.isArray(bundle.few_shot_sample_ids) ? bundle.few_shot_sample_ids : [];
  let fewShot: Array<Record<string, unknown>> = [];
  if (fewShotIds.length > 0) {
    const { data: ex } = await db.from("samples").select("expected_output").in("id", fewShotIds);
    fewShot = (ex ?? []).map((r) => r.expected_output as Record<string, unknown>);
  }

  const result = await runAgent({
    fieldSchema: bundle.field_schema,
    rules: bundle.rules,
    fewShot,
    file: input.file,
    filename: input.filename,
    tools: getAgentTools(agent.id),
  });

  const calibratedMin = applyCalibration(bundle.calibration_map as CalibrationMap | null, result.minConfidence);
  const needsReview = calibratedMin < REVIEW_THRESHOLD;

  const { data: doc } = await db
    .from("documents")
    .insert({
      user_id: agent.user_id,
      agent_id: agent.id,
      filename: input.filename,
      file_path: input.storedPath,
      file_size_bytes: input.fileSize,
      mime_type: input.mimeType,
      mode: "custom",
      status: needsReview ? "needs_review" : "extracted",
    })
    .select("id")
    .single();
  const documentId = doc?.id as string;

  if (documentId) {
    await db.from("extractions").insert({
      document_id: documentId,
      user_id: agent.user_id,
      extracted_fields: result.extractedFields,
      confidence_scores: result.confidenceScores,
      mode: "custom",
      model: "trestle-agent",
      processing_time_ms: 0,
      status: "completed",
    });
  }

  let delivered = false;
  if (needsReview) {
    await db.from("review_queue").insert({
      document_id: documentId,
      agent_id: agent.id,
      user_id: agent.user_id,
      reason: "low_confidence",
      min_confidence: calibratedMin,
      status: "pending",
    });
  } else {
    const ctx: DeliveryContext = {
      agentId: agent.id,
      documentId,
      extractedFields: result.extractedFields,
      confidenceScores: result.confidenceScores,
      minConfidence: calibratedMin,
    };
    const adapters = await resolveDestinations(db, agent.id);
    if (adapters.length === 0 && agent.webhook_url) {
      const legacy: DestinationAdapter = {
        label: agent.webhook_url,
        deliver: (deliveryCtx) => deliverWebhook(agent.webhook_url!, agent.webhook_secret, deliveryCtx),
      };
      adapters.push(legacy);
    }

    if (adapters.length > 0) {
      const results = await deliverAll(adapters, ctx);
      delivered = results.every((r) => r.ok);
      await db.from("webhook_deliveries").insert(
        results.map((res) => ({
          agent_id: agent.id,
          document_id: documentId,
          user_id: agent.user_id,
          url: res.label,
          ok: res.ok,
          status_code: res.status || null,
          attempts: res.attempts,
          error: res.error ?? null,
        })),
      );
    }
  }

  await recordUsage(db, agent.user_id);

  return {
    documentId,
    status: needsReview ? "needs_review" : "extracted",
    extractedFields: result.extractedFields,
    confidenceScores: result.confidenceScores,
    minConfidence: calibratedMin,
    delivered,
  };
}
