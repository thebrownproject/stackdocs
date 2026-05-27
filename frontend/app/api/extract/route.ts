import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { processDocument } from "@/lib/agent/process";
import { bearerFrom, hashApiKey } from "@/lib/auth/api-key";
import { createAdminSupabaseClient, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const result = await processDocument(db, agent, bundle, {
    file: fileInput,
    filename,
    storedPath,
    fileSize,
    mimeType,
  });

  return NextResponse.json(result);
}
