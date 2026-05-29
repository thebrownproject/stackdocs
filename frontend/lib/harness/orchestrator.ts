// Training orchestrator: turns an agent's labelled samples into a measured,
// promoted config bundle. Yields SSE-shaped progress so the route handler can
// stream the accuracy climbing in real time.
//
// MVP loop: infer schema -> 80/20 split -> baseline over TRAIN -> build bundle
// (schema + few-shot from TRAIN) -> held-out eval over TEST -> calibrate ->
// promote. The strong-model auto-tune step is deferred (TRESTLE-ARCHITECTURE §9).

import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, type ToolSet } from "ai";
import { runAgent } from "../agent/runtime";
import { getAgentTools } from "../agent/tools/registry";
import { modelId } from "../agent/models";
import { calibrate } from "./calibration";
import { inferSchema } from "./schema-infer";
import { scoreRun, type SampleEval } from "./scoring";
import { splitSamples } from "./split";
import { downloadFileBytes } from "../supabase-admin";
import type { FieldSchema } from "./types";

const MAX_SAMPLES = 60; // cap per run (no queue by design — keep within function limits)
const FEW_SHOT = 3;

interface SampleRow {
  id: string;
  file_path: string;
  filename: string;
  media_type: string;
  expected_output: Record<string, unknown>;
}

interface TrainOptions {
  agentId: string;
  userId: string;
  db: SupabaseClient;
  signal?: AbortSignal;
}

async function runOverSet(
  db: SupabaseClient,
  fieldSchema: FieldSchema,
  rows: SampleRow[],
  fewShot: Array<Record<string, unknown>>,
  rules: string | null,
  tools: ToolSet | undefined,
  signal?: AbortSignal,
): Promise<{ evals: SampleEval[]; predictions: Map<string, { extractedFields: Record<string, unknown>; confidenceScores: Record<string, unknown>; minConfidence: number }> }> {
  const evals: SampleEval[] = [];
  const predictions = new Map<string, { extractedFields: Record<string, unknown>; confidenceScores: Record<string, unknown>; minConfidence: number }>();
  for (const row of rows) {
    if (signal?.aborted) break;
    const bytes = await downloadFileBytes(db, row.file_path);
    const result = await runAgent({
      fieldSchema,
      rules,
      fewShot,
      file: { data: bytes, mediaType: row.media_type },
      filename: row.filename,
      tools,
      abortSignal: signal,
    });
    evals.push({ sampleId: row.id, expected: row.expected_output, actual: result.extractedFields });
    predictions.set(row.id, result);
  }
  return { evals, predictions };
}

async function writeRun(
  db: SupabaseClient,
  base: { agent_id: string; user_id: string; phase: string; bundle_version: number | null },
  score: ReturnType<typeof scoreRun>,
  predictionRows: SampleRow[],
  predictions: Map<string, { extractedFields: Record<string, unknown>; confidenceScores: Record<string, unknown> }>,
): Promise<string | null> {
  const { data: run } = await db
    .from("eval_runs")
    .insert({
      ...base,
      status: "complete",
      overall_accuracy: score.result.overallAccuracy,
      per_field_scores: score.result.perField,
      sample_count: predictionRows.length,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (run?.id) {
    const rows = predictionRows.map((r) => ({
      eval_run_id: run.id,
      sample_id: r.id,
      user_id: base.user_id,
      output: predictions.get(r.id)?.extractedFields ?? {},
      confidence_scores: predictions.get(r.id)?.confidenceScores ?? {},
      per_field_passed: score.perSample[r.id] ?? {},
    }));
    if (rows.length > 0) await db.from("predictions").insert(rows);
  }

  return (run?.id as string | undefined) ?? null;
}

// TUNE step: a strong model reads the baseline failures and proposes general
// extraction rules to fix the systematic mistakes. Returns null if nothing failed.
async function proposeRules(
  fieldSchema: FieldSchema,
  evals: SampleEval[],
  perSample: Record<string, Record<string, boolean>>,
  signal?: AbortSignal,
): Promise<string | null> {
  const failures = evals
    .map((e) => ({
      expected: e.expected,
      actual: e.actual,
      failed: Object.entries(perSample[e.sampleId] ?? {})
        .filter(([, ok]) => !ok)
        .map(([f]) => f),
    }))
    .filter((x) => x.failed.length > 0)
    .slice(0, 8);
  if (failures.length === 0) return null;

  const schemaDesc = fieldSchema.map((f) => `${f.name} (${f.type})`).join(", ");
  const cases = failures
    .map(
      (x, i) =>
        `Case ${i + 1} — wrong fields: ${x.failed.join(", ")}\n  expected: ${JSON.stringify(x.expected)}\n  extracted: ${JSON.stringify(x.actual)}`,
    )
    .join("\n\n");

  const { text } = await generateText({
    model: anthropic(modelId("tuning")),
    abortSignal: signal,
    prompt:
      `A document-extraction agent is making mistakes. Fields: ${schemaDesc}.\n\n` +
      `Cases where its output was wrong:\n\n${cases}\n\n` +
      `Write concise, GENERAL extraction rules (not specific to these exact documents) that would fix the ` +
      `systematic mistakes — where to find values, formatting/normalisation, and common confusions. ` +
      `Return only the rules as short plain-text bullet points.`,
  });
  const rules = text.trim();
  return rules.length > 0 ? rules : null;
}

export async function* runTraining(opts: TrainOptions): AsyncGenerator<Record<string, unknown>> {
  const { agentId, userId, db, signal } = opts;

  const { data: sampleData, error } = await db
    .from("samples")
    .select("id, file_path, filename, media_type, expected_output")
    .eq("agent_id", agentId)
    .limit(MAX_SAMPLES);
  if (error) throw new Error(error.message);
  const samples = (sampleData ?? []) as SampleRow[];
  if (samples.length < 2) {
    throw new Error("Need at least 2 samples to train (one held out for testing).");
  }
  yield { step: "load", sampleCount: samples.length };

  // Same custom tools used in production, so accuracy is measured under prod conditions.
  const tools = getAgentTools(agentId);

  const fieldSchema = inferSchema(samples.map((s) => ({ id: s.id, expectedOutput: s.expected_output })));
  yield { step: "schema_infer", fieldSchema };

  const { train, test } = splitSamples(samples.map((s) => ({ id: s.id, expectedOutput: s.expected_output })));
  const byId = new Map(samples.map((s) => [s.id, s]));
  const trainRows = train.map((s) => byId.get(s.id)!);
  const testRows = test.map((s) => byId.get(s.id)!);
  yield { step: "split", train: trainRows.length, test: testRows.length };

  // Baseline over TRAIN (no rules, no few-shot) — the starting accuracy.
  const baseline = await runOverSet(db, fieldSchema, trainRows, [], null, tools, signal);
  const baselineScore = scoreRun(fieldSchema, baseline.evals);
  await writeRun(db, { agent_id: agentId, user_id: userId, phase: "baseline", bundle_version: null }, baselineScore, trainRows, baseline.predictions);
  yield { step: "baseline", overall: baselineScore.result.overallAccuracy, perField: baselineScore.result.perField };

  // Build the bundle: inferred schema + few-shot exemplars from TRAIN.
  const fewShot = trainRows.slice(0, FEW_SHOT).map((r) => r.expected_output);

  // TUNE: propose rules from baseline failures, re-run TRAIN, keep only if improved.
  let rules: string | null = null;
  if (baselineScore.result.overallAccuracy < 0.99) {
    const proposed = await proposeRules(fieldSchema, baseline.evals, baselineScore.perSample, signal);
    if (proposed) {
      const tuned = await runOverSet(db, fieldSchema, trainRows, fewShot, proposed, tools, signal);
      const tunedScore = scoreRun(fieldSchema, tuned.evals);
      await writeRun(db, { agent_id: agentId, user_id: userId, phase: "tune", bundle_version: null }, tunedScore, trainRows, tuned.predictions);
      if (tunedScore.result.overallAccuracy >= baselineScore.result.overallAccuracy) rules = proposed;
      yield {
        step: "tune",
        overall: tunedScore.result.overallAccuracy,
        perField: tunedScore.result.perField,
        adopted: rules !== null,
      };
    }
  }

  // Held-out eval over TEST with the bundle — the honest number shown before payment.
  const heldOut = await runOverSet(db, fieldSchema, testRows, fewShot, rules, tools, signal);
  const heldOutScore = scoreRun(fieldSchema, heldOut.evals);

  // Calibrate from held-out (confidence, passed) pairs.
  const pairs: Array<{ confidence: number; passed: boolean }> = [];
  for (const r of testRows) {
    const pred = heldOut.predictions.get(r.id);
    const passedByField = heldOutScore.perSample[r.id] ?? {};
    if (!pred) continue;
    for (const f of fieldSchema) {
      const conf = (pred.confidenceScores as Record<string, unknown>)[f.name];
      if (typeof conf === "number") pairs.push({ confidence: conf, passed: !!passedByField[f.name] });
    }
  }
  const calibrationMap = calibrate(pairs);

  // Promote: next version, write bundle, point the agent at it.
  const { data: last } = await db
    .from("agent_bundles")
    .select("version")
    .eq("agent_id", agentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (last?.version ?? 0) + 1;

  await db.from("agent_bundles").insert({
    agent_id: agentId,
    user_id: userId,
    version,
    rules,
    few_shot_sample_ids: trainRows.slice(0, FEW_SHOT).map((r) => r.id),
    field_schema: fieldSchema,
    calibration_map: calibrationMap,
  });

  const accuracySummary = { overall: heldOutScore.result.overallAccuracy, perField: heldOutScore.result.perField };
  const heldOutRunId = await writeRun(
    db,
    { agent_id: agentId, user_id: userId, phase: "held_out", bundle_version: version },
    heldOutScore,
    testRows,
    heldOut.predictions,
  );
  await db
    .from("agents")
    .update({ active_bundle_version: version, status: "trained", accuracy_summary: accuracySummary, updated_at: new Date().toISOString() })
    .eq("id", agentId);

  yield {
    step: "held_out",
    overall: heldOutScore.result.overallAccuracy,
    perField: heldOutScore.result.perField,
    version,
    evalRunId: heldOutRunId,
  };
  yield { complete: true, version, accuracy: heldOutScore.result.overallAccuracy, evalRunId: heldOutRunId };
}
