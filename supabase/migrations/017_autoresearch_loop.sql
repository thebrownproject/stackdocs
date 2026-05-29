-- Migration 017: Autoresearch loop
-- Adds the bundle-version tree (status/parent/score/hypothesis/eval_epoch),
-- the sealed frozen evaluator table, and per-experiment gate results.

ALTER TABLE agent_bundles
    ADD COLUMN IF NOT EXISTS parent_version INTEGER,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'committed'
        CHECK (status IN ('baseline', 'candidate', 'committed', 'discarded')),
    ADD COLUMN IF NOT EXISTS score NUMERIC,
    ADD COLUMN IF NOT EXISTS hypothesis TEXT,
    ADD COLUMN IF NOT EXISTS eval_epoch INTEGER NOT NULL DEFAULT 1;

ALTER TABLE eval_runs
    ADD COLUMN IF NOT EXISTS gate_results JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS agent_evaluators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    eval_epoch INTEGER NOT NULL DEFAULT 1,
    field_schema JSONB NOT NULL,
    gates JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_threshold NUMERIC NOT NULL DEFAULT 0.7,
    split_seed INTEGER NOT NULL DEFAULT 42,
    train_sample_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    held_out_sample_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    strategy_doc TEXT,
    sealed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_evaluators_agent
    ON agent_evaluators(agent_id, eval_epoch DESC);

ALTER TABLE agent_evaluators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_evaluators_owner ON agent_evaluators;
CREATE POLICY agent_evaluators_owner ON agent_evaluators
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);
