import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/runtime";
import { deliverWebhook } from "@/lib/adapters/webhook";
import { bearerFrom, hashApiKey } from "@/lib/auth/api-key";
import { applyCalibration } from "@/lib/harness/calibration";
import type { FieldSchema } from "@/lib/harness/types";
import { createAdminSupabaseClient, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REVIEW_THRESHOLD = 0.7; // calibrated min-confidence below which a doc is queued for review

// POST /api/extract — embeddable inference. Auth: `Authorization: Bearer <agent api key>`.
// Body: multipart with `file`, OR JSON { fileUrl, mediaType, filename }.
export async function POST(req: Request) {
  const key = bearerFrom(req.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "Missing API key" }, { status: 401 });

  const db = createAdminSupabaseClient();
  const { data: agent } = await db
    .from("agents")
    .select("id, user_id, active_bundle_version, webhook_url, webhook_secret")
    .eq("api_key_hash", hashApiKey(key))
    .maybeSingle();
  if (!agent) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  if (!agent.active_bundle_version) {
    return NextResponse.json({ error: "Agent has no trained bundle" }, { status: 409 });
  }

  const { data: bundle } = await db
    .from("agent_bundles")
    .select("field_schema, rules, few_shot_sample_ids, calibration_map")
    .eq("agent_id", agent.id)
    .eq("version", agent.active_bundle_version)
    .maybeSingle();
  if (!bundle) return NextResponse.json({ error: "Active bundle missing" }, { status: 409 });

  // Resolve the input document into bytes (uploaded) or a URL (referenced).
  let fileInput: { data: Uint8Array | string; mediaType: string };
  let filename: string;
  let storedPath: string;
  let fileSize = 0;
  let mimeType: string;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    filename = file.name;
    mimeType = file.type || "application/pdf";
    fileSize = bytes.byteLength;
    storedPath = `${agent.user_id}/${randomUUID()}_${filename}`;
    const { error: upErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storedPath, bytes, { contentType: mimeType, upsert: false });
    if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    fileInput = { data: bytes, mediaType: mimeType };
  } else {
    const body = await req.json().catch(() => ({}));
    if (typeof body.fileUrl !== "string") {
      return NextResponse.json({ error: "Provide a `file` (multipart) or `fileUrl` (JSON)" }, { status: 400 });
    }
    filename = typeof body.filename === "string" ? body.filename : "document";
    mimeType = typeof body.mediaType === "string" ? body.mediaType : "application/pdf";
    storedPath = body.fileUrl; // external reference, not copied into storage
    fileInput = { data: body.fileUrl, mediaType: mimeType };
  }

  // Resolve few-shot exemplars referenced by the bundle.
  const fewShotIds = Array.isArray(bundle.few_shot_sample_ids) ? bundle.few_shot_sample_ids : [];
  let fewShot: Array<Record<string, unknown>> = [];
  if (fewShotIds.length > 0) {
    const { data: ex } = await db.from("samples").select("expected_output").in("id", fewShotIds);
    fewShot = (ex ?? []).map((r) => r.expected_output as Record<string, unknown>);
  }

  const result = await runAgent({
    fieldSchema: bundle.field_schema as FieldSchema,
    rules: bundle.rules,
    fewShot,
    file: fileInput,
  });

  const calibratedMin = applyCalibration(bundle.calibration_map, result.minConfidence);
  const needsReview = calibratedMin < REVIEW_THRESHOLD;

  const { data: doc } = await db
    .from("documents")
    .insert({
      user_id: agent.user_id,
      agent_id: agent.id,
      filename,
      file_path: storedPath,
      file_size_bytes: fileSize,
      mime_type: mimeType,
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
  } else if (agent.webhook_url) {
    const res = await deliverWebhook(agent.webhook_url, agent.webhook_secret, {
      agentId: agent.id,
      documentId,
      extractedFields: result.extractedFields,
      confidenceScores: result.confidenceScores,
      minConfidence: calibratedMin,
    });
    delivered = res.ok;
  }

  return NextResponse.json({
    documentId,
    status: needsReview ? "needs_review" : "extracted",
    extractedFields: result.extractedFields,
    confidenceScores: result.confidenceScores,
    minConfidence: calibratedMin,
    delivered,
  });
}
