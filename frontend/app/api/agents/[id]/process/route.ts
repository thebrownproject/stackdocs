import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { processDocument } from "@/lib/agent/process";
import { QuotaExceededError } from "@/lib/billing/enforce";
import { createAdminSupabaseClient, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/agents/[id]/process — dashboard manual upload (Clerk-authed).
// Same production path as /api/extract but scoped to the signed-in owner, so a
// human can drop a document through the tuned agent without an API key.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: agentId } = await params;

  const db = createAdminSupabaseClient();
  const { data: agent } = await db
    .from("agents")
    .select("id, user_id, active_bundle_version, webhook_url, webhook_secret")
    .eq("id", agentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
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

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/pdf";
  const storedPath = `${agent.user_id}/${randomUUID()}_${file.name}`;
  const { error: upErr } = await db.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storedPath, bytes, { contentType: mimeType, upsert: false });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

  let result;
  try {
    result = await processDocument(db, agent, bundle, {
      file: { data: bytes, mediaType: mimeType },
      filename: file.name,
      storedPath,
      fileSize: bytes.byteLength,
      mimeType,
    });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message, reason: err.reason, upgradeUrl: err.upgradeUrl }, { status: 402 });
    }
    throw err;
  }

  return NextResponse.json(result);
}
