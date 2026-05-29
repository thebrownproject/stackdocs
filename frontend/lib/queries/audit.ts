import { cache } from "react";
import { demoAuditData, isDemoMode } from "@/lib/demo-data";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type { FieldSchemaEntry, EvalRun } from "@/types/agents";

export interface AuditLinkRow {
  id: string;
  user_id: string;
  agent_id: string;
  eval_run_id: string;
  token: string;
  prospect_name: string | null;
  prospect_company: string | null;
  prospect_email: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

export interface AuditSample {
  id: string;
  filename: string;
  expected_output: Record<string, unknown>;
  predicted_output: Record<string, unknown>;
  per_field_passed: Record<string, boolean>;
  confidence_scores: Record<string, unknown>;
}

export interface AuditData {
  link: AuditLinkRow;
  agent: { id: string; name: string; created_at: string };
  eval_run: EvalRun;
  field_schema: FieldSchemaEntry[];
  samples: AuditSample[];
}

export interface AgentAuditLink {
  id: string;
  token: string;
  prospect_company: string | null;
  prospect_email: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  created_at: string;
  eval_run_id: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export const getAuditByToken = cache(async function getAuditByToken(token: string): Promise<AuditData | null> {
  if (isDemoMode) return demoAuditData[token] ?? null;

  const db = createAdminSupabaseClient();
  const { data: link } = await db
    .from("audit_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!link) return null;

  const [agentResult, runResult] = await Promise.all([
    db.from("agents").select("id, name, created_at").eq("id", link.agent_id).maybeSingle(),
    db
      .from("eval_runs")
      .select("id, bundle_version, phase, status, overall_accuracy, per_field_scores, sample_count, error, started_at, completed_at")
      .eq("id", link.eval_run_id)
      .maybeSingle(),
  ]);
  if (!agentResult.data || !runResult.data) return null;

  const { data: bundle } = runResult.data.bundle_version
    ? await db
        .from("agent_bundles")
        .select("field_schema")
        .eq("agent_id", link.agent_id)
        .eq("version", runResult.data.bundle_version)
        .maybeSingle()
    : { data: null };

  const { data: predictionRows } = await db
    .from("predictions")
    .select("sample_id, output, per_field_passed, confidence_scores, samples(id, filename, expected_output)")
    .eq("eval_run_id", link.eval_run_id);

  const samples: AuditSample[] = (predictionRows ?? []).map((row) => {
    const sample = (Array.isArray(row.samples) ? row.samples[0] : row.samples) as
      | { id?: string; filename?: string; expected_output?: unknown }
      | null;
    return {
      id: sample?.id ?? row.sample_id,
      filename: sample?.filename ?? "Sample",
      expected_output: asRecord(sample?.expected_output),
      predicted_output: asRecord(row.output),
      per_field_passed: (row.per_field_passed ?? {}) as Record<string, boolean>,
      confidence_scores: asRecord(row.confidence_scores),
    };
  });

  return {
    link: link as AuditLinkRow,
    agent: agentResult.data,
    eval_run: runResult.data as EvalRun,
    field_schema: ((bundle?.field_schema ?? []) as FieldSchemaEntry[]) ?? [],
    samples,
  };
});

export async function recordAuditView(id: string): Promise<void> {
  if (isDemoMode) return;

  const db = createAdminSupabaseClient();
  const { data } = await db.from("audit_links").select("view_count").eq("id", id).maybeSingle();
  await db
    .from("audit_links")
    .update({
      view_count: ((data?.view_count as number | undefined) ?? 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export const listAuditLinks = cache(async function listAuditLinks(agentId: string): Promise<AgentAuditLink[]> {
  const db = createAdminSupabaseClient();
  const { data } = await db
    .from("audit_links")
    .select("id, token, prospect_company, prospect_email, expires_at, revoked_at, view_count, created_at, eval_run_id")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as AgentAuditLink[];
});
