// Phase-0 setup: infer schema, split, build default gates, seal the evaluator,
// and run the baseline. Default gate floors track lib/audit/verdict.ts ("ready":
// overall >= 0.95, lowest field >= 0.85, review rate <= 0.2).
import type { SupabaseClient } from "@supabase/supabase-js";
import { inferSchema } from "../schema-infer";
import { splitSamples } from "../split";
import type { FieldSchema } from "../types";
import type { EvalSample, Gate, SealedEvaluator } from "./types";

export interface GateDefaults {
  fieldFloor: number; // per-field minimum accuracy
  reviewMax: number; // maximum review rate
}

export const DEFAULT_GATES: GateDefaults = { fieldFloor: 0.85, reviewMax: 0.2 };

export function buildDefaultGates(schema: FieldSchema, defaults: GateDefaults = DEFAULT_GATES): Gate[] {
  const floors: Gate[] = schema.map((f) => ({ kind: "field_floor", field: f.name, min: defaults.fieldFloor }));
  return [...floors, { kind: "review_rate_ceiling", max: defaults.reviewMax }, { kind: "schema_valid" }];
}

interface SampleRow {
  id: string;
  file_path: string;
  filename: string;
  media_type: string;
  expected_output: Record<string, unknown>;
}

function toEvalSample(r: SampleRow): EvalSample {
  return { id: r.id, filePath: r.file_path, filename: r.filename, mediaType: r.media_type, expectedOutput: r.expected_output };
}

/** Load samples, infer schema, split, build gates, and persist a sealed evaluator. */
export async function setupEvaluator(
  db: SupabaseClient,
  agentId: string,
  userId: string,
  opts: { gateDefaults?: GateDefaults; strategyDoc?: string; splitSeed?: number } = {},
): Promise<SealedEvaluator> {
  const { data, error } = await db
    .from("samples")
    .select("id, file_path, filename, media_type, expected_output")
    .eq("agent_id", agentId)
    .limit(60);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SampleRow[];
  if (rows.length < 2) throw new Error("Need at least 2 samples (one held out).");

  const fieldSchema = inferSchema(rows.map((r) => ({ id: r.id, expectedOutput: r.expected_output })));
  const seed = opts.splitSeed ?? 42;
  const { train, test } = splitSamples(rows.map((r) => ({ id: r.id, expectedOutput: r.expected_output })), 0.8, seed);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const trainSamples = train.map((s) => toEvalSample(byId.get(s.id)!));
  const heldOut = test.map((s) => toEvalSample(byId.get(s.id)!));

  const gates = buildDefaultGates(fieldSchema, opts.gateDefaults ?? DEFAULT_GATES);

  const { data: lastEpoch } = await db
    .from("agent_evaluators")
    .select("eval_epoch")
    .eq("agent_id", agentId)
    .order("eval_epoch", { ascending: false })
    .limit(1)
    .maybeSingle();
  const evalEpoch = ((lastEpoch?.eval_epoch as number | undefined) ?? 0) + 1;

  const strategyDoc = opts.strategyDoc ?? "";
  await db.from("agent_evaluators").insert({
    agent_id: agentId,
    user_id: userId,
    eval_epoch: evalEpoch,
    field_schema: fieldSchema,
    gates,
    review_threshold: 0.7,
    split_seed: seed,
    train_sample_ids: trainSamples.map((s) => s.id),
    held_out_sample_ids: heldOut.map((s) => s.id),
    strategy_doc: strategyDoc,
  });

  return {
    agentId,
    userId,
    evalEpoch,
    fieldSchema,
    gates,
    reviewThreshold: 0.7,
    heldOut,
    train: trainSamples,
    strategyDoc,
  };
}
