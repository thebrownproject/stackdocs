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
}
