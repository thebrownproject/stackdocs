export type AgentStatus = "draft" | "trained" | "active";

export interface AccuracySummary {
  overall: number;
  per_field?: Record<string, number>;
}

export interface FieldSchemaEntry {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}

export interface AgentSummary {
  id: string;
  name: string;
  status: AgentStatus;
  active_bundle_version: number | null;
  accuracy_summary: AccuracySummary | null;
  created_at: string;
  sample_count: number;
}

export interface EvalRun {
  id: string;
  bundle_version: number | null;
  phase: string;
  status: string;
  overall_accuracy: number | null;
  per_field_scores: Record<string, { passed: number; total: number; accuracy: number; scorer: string }> | null;
  sample_count: number | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface AgentBundle {
  id: string;
  version: number;
  field_schema: FieldSchemaEntry[];
  created_at: string;
}

export interface ReviewItem {
  id: string;
  document_id: string;
  reason: string;
  min_confidence: number | null;
  status: string;
  created_at: string;
  filename: string | null;
}

export interface WebhookDelivery {
  id: string;
  document_id: string | null;
  url: string;
  ok: boolean;
  status_code: number | null;
  attempts: number;
  error: string | null;
  created_at: string;
}

export interface PredictionRow {
  sampleId: string;
  filename: string | null;
  perFieldPassed: Record<string, boolean>;
  expected: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface FailureReport {
  runId: string;
  phase: string;
  overallAccuracy: number | null;
  perField: Record<string, { passed: number; total: number; accuracy: number; scorer: string }>;
  fields: string[];
  rows: PredictionRow[];
}

export interface AgentDetail extends AgentSummary {
  webhook_url: string | null;
  has_webhook_secret: boolean;
  inbound_email_token: string | null;
  has_api_key: boolean;
  field_schema: FieldSchemaEntry[] | null;
  eval_runs: EvalRun[];
  bundles: AgentBundle[];
  review_items: ReviewItem[];
  pending_review_count: number;
  audit_links: AgentAuditLink[];
  destinations: DestinationSummary[];
  billing: BillingSummary | null;
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

export interface DestinationSummary {
  id: string;
  agent_id: string;
  kind: "webhook" | "google_sheets" | "email";
  label: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingSummary {
  plan: "free" | "starter" | "pro";
  plan_status: "active" | "past_due" | "canceled" | "trialing";
  docs_processed_current_period: number;
  current_period_ends_at: string | null;
}
