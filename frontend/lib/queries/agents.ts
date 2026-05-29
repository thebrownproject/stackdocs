import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  demoAgentDetails,
  demoAgents,
  demoDeliveries,
  demoFailures,
  isDemoMode,
} from "@/lib/demo-data";
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
  DestinationSummary,
  BillingSummary,
  WebhookDelivery,
} from "@/types/agents";

function sampleCount(samples: unknown): number {
  if (Array.isArray(samples) && samples[0] && typeof samples[0] === "object") {
    return (samples[0] as { count?: number }).count ?? 0;
  }
  return 0;
}

export async function getAgents(): Promise<AgentSummary[]> {
  if (isDemoMode) return demoAgents;

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
  if (isDemoMode) return demoFailures[agentId] ?? null;

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

// Recent webhook delivery attempts for an agent (most recent first).
export const getAgentDeliveries = cache(async function getAgentDeliveries(
  agentId: string,
): Promise<WebhookDelivery[]> {
  if (isDemoMode) return demoDeliveries[agentId] ?? [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("id, document_id, url, ok, status_code, attempts, error, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("Error fetching webhook deliveries:", error);
    return [];
  }
  return (data ?? []) as WebhookDelivery[];
});

export const getAgent = cache(async function getAgent(id: string): Promise<AgentDetail | null> {
  if (isDemoMode && demoAgentDetails[id]) return demoAgentDetails[id];

  const supabase = await createServerSupabaseClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, user_id, name, status, active_bundle_version, accuracy_summary, created_at, webhook_url, webhook_secret, api_key_hash, inbound_email_token, samples(count)")
    .eq("id", id)
    .single();

  if (error || !agent) {
    console.error("Error fetching agent:", error);
    if (isDemoMode) return demoAgentDetails[id] ?? null;
    return null;
  }

  const [runsResult, bundlesResult, reviewResult, auditLinksResult, destinationsResult, billingResult] = await Promise.all([
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
    supabase
      .from("audit_links")
      .select("id, token, prospect_company, prospect_email, expires_at, revoked_at, view_count, created_at, eval_run_id")
      .eq("agent_id", id)
      .eq("user_id", agent.user_id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("destinations")
      .select("id, agent_id, kind, label, config, enabled, created_at, updated_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_billing")
      .select("plan, plan_status, docs_processed_current_period, current_period_ends_at")
      .eq("user_id", agent.user_id)
      .maybeSingle(),
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
    audit_links: (auditLinksResult.data ?? []),
    destinations: (destinationsResult.data ?? []) as DestinationSummary[],
    billing: (billingResult.data ?? null) as BillingSummary | null,
  };
});
