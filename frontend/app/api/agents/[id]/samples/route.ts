import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient, DOCUMENTS_BUCKET } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/agents/[id]/samples
function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  const headers = rows.shift() ?? [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]).filter(([key]) => key)),
  );
}

function expectedFromCsv(text: string): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of parseCsv(text)) {
    const filename = row.filename;
    if (!filename) continue;
    const fields = { ...row };
    delete fields.filename;
    map.set(filename, fields);
  }
  return map;
}

async function removeUploaded(db: ReturnType<typeof createAdminSupabaseClient>, paths: string[]) {
  if (paths.length > 0) await db.storage.from(DOCUMENTS_BUCKET).remove(paths);
}

// multipart/form-data: one or more `files`, plus either `expected` as JSON array
// aligned to file order or `expectedCsv`/`expected_csv` file with filename column.
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

  let expected: Record<string, unknown>[];
  const csvFile = form.get("expectedCsv") ?? form.get("expected_csv");
  if (csvFile instanceof File) {
    const byFilename = expectedFromCsv(await csvFile.text());
    expected = files.map((file) => byFilename.get(file.name) ?? {});
    const missing = files.filter((file) => !byFilename.has(file.name)).map((file) => file.name);
    if (missing.length > 0) {
      return NextResponse.json({ error: `CSV is missing expected outputs for: ${missing.join(", ")}` }, { status: 400 });
    }
  } else {
    try {
      const parsed = JSON.parse(String(form.get("expected") ?? "[]"));
      if (!Array.isArray(parsed)) throw new Error();
      expected = parsed.map((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        return value as Record<string, unknown>;
      });
    } catch {
      return NextResponse.json({ error: "`expected` must be a JSON array of objects aligned to files" }, { status: 400 });
    }
    if (expected.length !== files.length) {
      return NextResponse.json({ error: "`expected` length must match number of files" }, { status: 400 });
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  const uploadedPaths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${userId}/samples/${agentId}/${randomUUID()}_${file.name}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) {
      await removeUploaded(db, uploadedPaths);
      return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }
    uploadedPaths.push(path);

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
  if (insErr) {
    await removeUploaded(db, uploadedPaths);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({ inserted: count ?? rows.length }, { status: 201 });
}
