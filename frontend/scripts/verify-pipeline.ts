// End-to-end pipeline verification against a LIVE stack (Supabase + Anthropic).
//
// Exercises the real headless path — agent creation, sample upload to Storage,
// schema inference, the agent reading documents directly (no OCR), scoring,
// calibration, and bundle promotion — WITHOUT the Clerk-protected console routes
// (there is no UI yet). Afterwards it prints a ready-to-run curl for /api/extract.
//
// Setup:
//   1. Apply supabase/migrations/012_trestle_schema.sql to your Supabase project.
//   2. Fill frontend/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//      ANTHROPIC_API_KEY). The "documents" Storage bucket must exist (it already does).
//   3. Put >= 2 sample documents in frontend/scripts/fixtures/ plus an expected.json
//      mapping each filename to its ground-truth output, e.g.:
//        { "invoice1.pdf": { "vendor": "Acme", "total": "$1,000.00", "date": "2026-01-05" } }
//   4. Run:  npm run verify
//
// Run with: node --env-file=.env.local --import tsx scripts/verify-pipeline.ts

import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateApiKey } from "../lib/auth/api-key";
import { runTraining } from "../lib/harness/orchestrator";
import { createAdminSupabaseClient, DOCUMENTS_BUCKET } from "../lib/supabase-admin";

const FIXTURES = join(import.meta.dirname, "fixtures");
const USER_ID = "verify-script";

const MEDIA: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function mediaType(name: string): string {
  return MEDIA[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/pdf";
}

async function main() {
  for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"]) {
    if (!process.env[v]) throw new Error(`Missing env var ${v} (set it in .env.local)`);
  }

  let expected: Record<string, Record<string, unknown>>;
  try {
    expected = JSON.parse(readFileSync(join(FIXTURES, "expected.json"), "utf8"));
  } catch {
    throw new Error(`Create ${join(FIXTURES, "expected.json")} mapping each sample filename to its ground-truth output.`);
  }
  const files = readdirSync(FIXTURES).filter((f) => f !== "expected.json" && !f.startsWith("."));
  if (files.length < 2) throw new Error("Add at least 2 sample documents to scripts/fixtures/.");
  for (const f of files) {
    if (!expected[f]) throw new Error(`expected.json has no entry for "${f}".`);
  }

  const db = createAdminSupabaseClient();
  const { key, hash } = generateApiKey();

  const { data: agent, error: agentErr } = await db
    .from("agents")
    .insert({ user_id: USER_ID, name: `verify-${Date.now()}`, status: "draft", api_key_hash: hash })
    .select("id")
    .single();
  if (agentErr || !agent) throw new Error(`Create agent failed: ${agentErr?.message}`);
  const agentId = agent.id as string;
  console.log(`\n✓ Created agent ${agentId}`);

  for (const f of files) {
    const bytes = new Uint8Array(readFileSync(join(FIXTURES, f)));
    const path = `${USER_ID}/samples/${agentId}/${randomUUID()}_${f}`;
    const { error: upErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, bytes, { contentType: mediaType(f), upsert: false });
    if (upErr) throw new Error(`Upload ${f} failed: ${upErr.message}`);
    const { error: insErr } = await db.from("samples").insert({
      agent_id: agentId,
      user_id: USER_ID,
      file_path: path,
      filename: f,
      media_type: mediaType(f),
      expected_output: expected[f],
      split: "train",
      source: "upload",
    });
    if (insErr) throw new Error(`Insert sample ${f} failed: ${insErr.message}`);
    console.log(`  • uploaded ${f}`);
  }

  console.log(`\n▶ Training (streaming):`);
  for await (const ev of runTraining({ agentId, userId: USER_ID, db })) {
    if (ev.step === "schema_infer") {
      console.log(`  schema: ${(ev.fieldSchema as Array<{ name: string; type: string }>).map((s) => `${s.name}:${s.type}`).join(", ")}`);
    } else if (ev.step === "split") {
      console.log(`  split: ${ev.train} train / ${ev.test} test`);
    } else if (ev.step === "baseline") {
      console.log(`  baseline accuracy: ${((ev.overall as number) * 100).toFixed(1)}%`);
    } else if (ev.step === "held_out") {
      console.log(`  HELD-OUT accuracy: ${((ev.overall as number) * 100).toFixed(1)}%  (bundle v${ev.version})`);
    } else if (ev.complete) {
      console.log(`\n✓ Promoted bundle v${ev.version} — held-out accuracy ${((ev.accuracy as number) * 100).toFixed(1)}%`);
    }
  }

  console.log(`\nNow test the embeddable endpoint (start the app with \`npm run dev\` first):`);
  console.log(`  curl -X POST http://localhost:3000/api/extract \\`);
  console.log(`    -H "Authorization: Bearer ${key}" \\`);
  console.log(`    -F "file=@/path/to/a/new/document.pdf"`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
