import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  AccuracySummary,
  AgentBundle,
  AgentDetail,
  AgentStatus,
  AgentSummary,
  EvalRun,
  FailureReport,
  FieldSchemaEntry,
  PredictionRow,
  ReviewItem,
} from "@/types/agents";

function sampleCount(samples: unknown): number {
  if (Array.isArray(samples) && samples[0] && typeof samples[0] === "object") {
    return (samples[0] as { count?: number }).count ?? 0;
  }
  return 0;
}

export async function getAgents(): Promise<AgentSummary[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("agents")
    .select("id, name, status, active_bundle_version, accuracy_summary, created_at, samples(count)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching agents:", error);
    return [];
  }

  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status as AgentStatus,
    active_bundle_version: a.active_bundle_version,
    accuracy_summary: a.accuracy_summary as AccuracySummary | null,
    created_at: a.created_at,
    sample_count: sampleCount(a.samples),
  }));
}

// Per-sample predictions from the most recent eval run — the "where did it fail"
// drilldown. Prefers the held-out run (TEST), falling back to the latest run.
export const getAgentFailures = cache(async function getAgentFailures(
  agentId: string,
): Promise<FailureReport | null> {
  const supabase = await createServerSupabaseClient();

  const { data: heldOut } = await supabase
    .from("eval_runs")
    .select("id, phase, overall_accuracy, per_field_scores")
    .eq("agent_id", agentId)
    .eq("phase", "held_out")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let run = heldOut;
  if (!run) {
    const { data: latest } = await supabase
      .from("eval_runs")
      .select("id, phase, overall_accuracy, per_field_scores")
      .eq("agent_id", agentId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    run = latest;
  }
  if (!run) return null;

  const { data: preds } = await supabase
    .from("predictions")
    .select("sample_id, output, per_field_passed, samples(filename, expected_output)")
    .eq("eval_run_id", run.id);

  const rows: PredictionRow[] = (preds ?? []).map((p) => {
    const sample = (Array.isArray(p.samples) ? p.samples[0] : p.samples) as
      | { filename?: string; expected_output?: Record<string, unknown> }
      | null;
    return {
      sampleId: p.sample_id,
      filename: sample?.filename ?? null,
      perFieldPassed: (p.per_field_passed ?? {}) as Record<string, boolean>,
      expected: (sample?.expected_output ?? {}) as Record<string, unknown>,
      output: (p.output ?? {}) as Record<string, unknown>,
    };
  });

  const perField = (run.per_field_scores ?? {}) as FailureReport["perField"];
  const fields =
    Object.keys(perField).length > 0
      ? Object.keys(perField)
      : Array.from(new Set(rows.flatMap((r) => Object.keys(r.perFieldPassed))));

  return {
    runId: run.id,
    phase: run.phase,
    overallAccuracy: run.overall_accuracy,
    perField,
    fields,
    rows,
  };
});

export const getAgent = cache(async function getAgent(id: string): Promise<AgentDetail | null> {
  const supabase = await createServerSupabaseClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, name, status, active_bundle_version, accuracy_summary, created_at, webhook_url, webhook_secret, api_key_hash, inbound_email_token, samples(count)")
    .eq("id", id)
    .single();

  if (error || !agent) {
    console.error("Error fetching agent:", error);
    return null;
  }

  const [runsResult, bundlesResult, reviewResult] = await Promise.all([
    supabase
      .from("eval_runs")
      .select("id, bundle_version, phase, status, overall_accuracy, per_field_scores, sample_count, error, started_at, completed_at")
      .eq("agent_id", id)
      .order("started_at", { ascending: false })
      .limit(25),
    supabase
      .from("agent_bundles")
      .select("id, version, field_schema, created_at")
      .eq("agent_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("review_queue")
      .select("id, document_id, reason, min_confidence, status, created_at, documents(filename)")
      .eq("agent_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const bundles = (bundlesResult.data ?? []) as AgentBundle[];
  const activeBundle = bundles.find((b) => b.version === agent.active_bundle_version);

  const review_items: ReviewItem[] = (reviewResult.data ?? []).map((r) => {
    const doc = r.documents as { filename?: string } | { filename?: string }[] | null;
    const filename = Array.isArray(doc) ? (doc[0]?.filename ?? null) : (doc?.filename ?? null);
    return {
      id: r.id,
      document_id: r.document_id,
      reason: r.reason,
      min_confidence: r.min_confidence,
      status: r.status,
      created_at: r.created_at,
      filename,
    };
  });

  return {
    id: agent.id,
    name: agent.name,
    status: agent.status as AgentStatus,
    active_bundle_version: agent.active_bundle_version,
    accuracy_summary: agent.accuracy_summary as AccuracySummary | null,
    created_at: agent.created_at,
    sample_count: sampleCount(agent.samples),
    webhook_url: agent.webhook_url,
    has_webhook_secret: Boolean(agent.webhook_secret),
    inbound_email_token: agent.inbound_email_token ?? null,
    has_api_key: Boolean(agent.api_key_hash),
    field_schema: (activeBundle?.field_schema ?? null) as FieldSchemaEntry[] | null,
    eval_runs: (runsResult.data ?? []) as EvalRun[],
    bundles,
    review_items,
    pending_review_count: review_items.length,
  };
});
