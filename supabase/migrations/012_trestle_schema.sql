-- Migration 012: Trestle schema
-- Adds per-account agents, versioned config bundles, training samples,
-- eval runs/predictions, and a low-confidence review queue. Extends documents
-- with agent_id. Follows the Clerk-JWT RLS pattern established in migration 009.
--
-- Server-side route handlers use the service-role key (bypasses RLS) and set
-- user_id explicitly. RLS below protects the frontend's direct Clerk-scoped reads.

-- ============================================================================
-- agents — one per account / document type ("same agent, different rules")
-- ============================================================================
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',   -- draft | trained | active
    active_bundle_version INTEGER,
    accuracy_summary JSONB,                         -- { overall, per_field } from promoted held-out run
    api_key_hash TEXT,                              -- sha256 of the embeddable inference API key
    webhook_url TEXT,
    webhook_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_agents_user_id ON agents(user_id, created_at DESC);
CREATE INDEX idx_agents_api_key_hash ON agents(api_key_hash) WHERE api_key_hash IS NOT NULL;

-- ============================================================================
-- agent_bundles — versioned tuned config snapshots (promote = pointer flip)
-- ============================================================================
CREATE TABLE agent_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    version INTEGER NOT NULL,
    rules TEXT,                                     -- tuned system prompt / extraction rules
    few_shot_sample_ids JSONB DEFAULT '[]'::jsonb,  -- array of samples.id used as exemplars
    field_schema JSONB NOT NULL,                    -- [{ name, type, description, required }]
    calibration_map JSONB,                          -- confidence-bin -> empirical pass-rate
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (agent_id, version)
);
CREATE INDEX idx_agent_bundles_agent ON agent_bundles(agent_id, version DESC);

-- ============================================================================
-- samples — labelled training/eval examples (doc + ground-truth output)
-- ============================================================================
CREATE TABLE samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    file_path TEXT NOT NULL,                        -- Supabase Storage path
    filename VARCHAR(255) NOT NULL,
    media_type VARCHAR(100) NOT NULL,
    expected_output JSONB NOT NULL,                 -- ground truth, same shape as extracted_fields
    split VARCHAR(10) NOT NULL DEFAULT 'train',     -- train | test
    source VARCHAR(20) NOT NULL DEFAULT 'upload',   -- upload | correction
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_samples_agent ON samples(agent_id, split);

-- ============================================================================
-- eval_runs — one tuning/eval pass over a sample set
-- ============================================================================
CREATE TABLE eval_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    bundle_version INTEGER,
    phase VARCHAR(20) NOT NULL,                     -- baseline | tune | held_out
    status VARCHAR(20) NOT NULL DEFAULT 'running',  -- running | complete | error
    overall_accuracy REAL,
    per_field_scores JSONB,                         -- field -> { passed, total, accuracy, scorer }
    sample_count INTEGER,
    error TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_eval_runs_agent ON eval_runs(agent_id, started_at DESC);

-- ============================================================================
-- predictions — agent output per sample per run (scoring audit / drilldown)
-- ============================================================================
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_run_id UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    output JSONB,                                   -- value+confidence per field
    per_field_passed JSONB,                         -- field -> bool
    latency_ms INTEGER,
    token_usage JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_predictions_run ON predictions(eval_run_id);

-- ============================================================================
-- review_queue — low-confidence production items awaiting human review
-- ============================================================================
CREATE TABLE review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    reason VARCHAR(20) NOT NULL,                    -- low_confidence | low_field
    min_confidence REAL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | resolved
    corrected_fields JSONB,                         -- on resolve -> new samples row (source='correction')
    resolved_by_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_review_queue_agent ON review_queue(agent_id, status);

-- ============================================================================
-- documents: link production docs to the agent that processed them
-- ============================================================================
ALTER TABLE documents ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_agent ON documents(agent_id);

-- ============================================================================
-- Row-Level Security — Clerk JWT isolation (matches migration 009)
-- ============================================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_clerk_isolation ON agents
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);
CREATE POLICY agent_bundles_clerk_isolation ON agent_bundles
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);
CREATE POLICY samples_clerk_isolation ON samples
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);
CREATE POLICY eval_runs_clerk_isolation ON eval_runs
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);
CREATE POLICY predictions_clerk_isolation ON predictions
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);
CREATE POLICY review_queue_clerk_isolation ON review_queue
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);
