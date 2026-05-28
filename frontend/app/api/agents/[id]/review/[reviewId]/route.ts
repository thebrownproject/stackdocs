import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// POST /api/agents/[id]/review/[reviewId] — resolve a review item with corrected
// fields. The correction becomes a new labelled sample (source='correction'),
// feeding the next training run (the corrections-as-labels flywheel).
export async function POST(req: Request, { params }: { params: Promise<{ id: string; reviewId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: agentId, reviewId } = await params;

  const body = await req.json().catch(() => ({}));
  const correctedFields = body.correctedFields;
  if (!correctedFields || typeof correctedFields !== "object" || Array.isArray(correctedFields)) {
    return NextResponse.json({ error: "correctedFields object is required" }, { status: 400 });
  }

  const db = createAdminSupabaseClient();
  const { data: item } = await db
    .from("review_queue")
    .select("id, document_id, status, documents(file_path, filename, mime_type)")
    .eq("id", reviewId)
    .eq("agent_id", agentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "Review item not found" }, { status: 404 });
  if (item.status === "resolved") return NextResponse.json({ error: "Already resolved" }, { status: 409 });

  const docRaw = item.documents as
    | { file_path?: string; filename?: string; mime_type?: string }
    | { file_path?: string; filename?: string; mime_type?: string }[]
    | null;
  const doc = Array.isArray(docRaw) ? docRaw[0] : docRaw;

  if (doc?.file_path) {
    const { error: sampleErr } = await db.from("samples").insert({
      agent_id: agentId,
      user_id: userId,
      file_path: doc.file_path,
      filename: doc.filename ?? "document",
      media_type: doc.mime_type ?? "application/pdf",
      expected_output: correctedFields,
      split: "train",
      source: "correction",
    });
    if (sampleErr) return NextResponse.json({ error: sampleErr.message }, { status: 500 });
  }

  const { error: updErr } = await db
    .from("review_queue")
    .update({ status: "resolved", corrected_fields: correctedFields, resolved_by_user_id: userId })
    .eq("id", reviewId)
    .eq("user_id", userId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (item.document_id) {
    await db.from("documents").update({ status: "extracted" }).eq("id", item.document_id);
  }

  return NextResponse.json({ ok: true, sampleCreated: Boolean(doc?.file_path) });
}
