import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  AccuracySummary,
  AgentBundle,
  AgentDetail,
  AgentStatus,
  AgentSummary,
  EvalRun,
  FieldSchemaEntry,
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

export const getAgent = cache(async function getAgent(id: string): Promise<AgentDetail | null> {
  const supabase = await createServerSupabaseClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, name, status, active_bundle_version, accuracy_summary, created_at, webhook_url, api_key_hash, samples(count)")
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
    has_api_key: Boolean(agent.api_key_hash),
    field_schema: (activeBundle?.field_schema ?? null) as FieldSchemaEntry[] | null,
    eval_runs: (runsResult.data ?? []) as EvalRun[],
    bundles,
    review_items,
    pending_review_count: review_items.length,
  };
});
