import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/agents/[id]/samples
// multipart/form-data: one or more `files`, plus `expected` = JSON array of
// ground-truth output objects aligned to file order.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: agentId } = await params;

  const db = createAdminSupabaseClient();
  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "No files provided" }, { status: 400 });

  let expected: unknown[];
  try {
    expected = JSON.parse(String(form.get("expected") ?? "[]"));
    if (!Array.isArray(expected)) throw new Error();
  } catch {
    return NextResponse.json({ error: "`expected` must be a JSON array aligned to files" }, { status: 400 });
  }
  if (expected.length !== files.length) {
    return NextResponse.json({ error: "`expected` length must match number of files" }, { status: 400 });
  }

  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${userId}/samples/${agentId}/${randomUUID()}_${file.name}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

    rows.push({
      agent_id: agentId,
      user_id: userId,
      file_path: path,
      filename: file.name,
      media_type: file.type || "application/pdf",
      expected_output: expected[i] ?? {},
      split: "train",
      source: "upload",
    });
  }

  const { error: insErr, count } = await db.from("samples").insert(rows, { count: "exact" });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ inserted: count ?? rows.length }, { status: 201 });
}
