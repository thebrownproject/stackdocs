// Persist a loop experiment as a held-out `eval_run` (+ `predictions`), so a tuned
// bundle becomes a shareable accuracy audit. Writes the exact shape the audit-link
// query reads (lib/queries/audit.ts): eval_runs.{overall_accuracy, per_field_scores,
// gate_results, sample_count, bundle_version} and predictions.{output,
// confidence_scores, per_field_passed} joined to samples.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bundle, ExperimentResult, ExperimentSampleDetail } from "./types";

/** A row ready to insert into `predictions` (minus eval_run_id, set by the writer). */
export interface PredictionRow {
  sample_id: string;
  user_id: string;
  output: Record<string, unknown>;
  confidence_scores: Record<string, unknown>;
  per_field_passed: Record<string, boolean>;
}

/** Pure: map experiment per-sample details to prediction rows. No I/O. */
export function toPredictionRows(
  details: ExperimentSampleDetail[],
  userId: string,
): PredictionRow[] {
  return details.map((d) => ({
    sample_id: d.sampleId,
    user_id: userId,
    output: d.extractedFields,
    confidence_scores: d.confidenceScores,
    per_field_passed: d.perFieldPassed,
  }));
}

/**
 * Write a completed held-out eval run for a tuned bundle and its per-sample
 * predictions. Returns the new eval_run id (which `audit_links.eval_run_id` points
 * at), or null if the run row could not be created.
 */
export async function persistEvalRun(
  db: SupabaseClient,
  args: {
    agentId: string;
    userId: string;
    bundle: Bundle;
    result: ExperimentResult;
    phase?: string; // defaults to "held_out" (what audit links expect)
  },
): Promise<string | null> {
  const { agentId, userId, bundle, result } = args;
  const phase = args.phase ?? "held_out";

  const { data: run } = await db
    .from("eval_runs")
    .insert({
      agent_id: agentId,
      user_id: userId,
      phase,
      bundle_version: bundle.version,
      status: "complete",
      overall_accuracy: result.score,
      per_field_scores: result.perField,
      gate_results: result.gateResults,
      sample_count: result.details?.length ?? 0,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const runId = (run?.id as string | undefined) ?? null;
  if (!runId) return null;

  const rows = toPredictionRows(result.details ?? [], userId).map((r) => ({
    ...r,
    eval_run_id: runId,
  }));
  if (rows.length > 0) await db.from("predictions").insert(rows);

  return runId;
}
