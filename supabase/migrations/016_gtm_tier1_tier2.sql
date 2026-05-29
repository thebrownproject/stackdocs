-- Migration 016: GTM tier 1 and 2
-- Adds public audit reports, self-serve destinations, billing/quota state, and
-- confidence storage for prediction drilldowns.

ALTER TABLE predictions
    ADD COLUMN IF NOT EXISTS confidence_scores JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS audit_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    eval_run_id UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    prospect_name TEXT,
    prospect_company TEXT,
    prospect_email TEXT,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    view_count INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_links_token ON audit_links(token);
CREATE INDEX IF NOT EXISTS idx_audit_links_user ON audit_links(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_links_agent ON audit_links(agent_id, created_at DESC);

ALTER TABLE audit_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_links_owner ON audit_links;
CREATE POLICY audit_links_owner ON audit_links
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);

CREATE TABLE IF NOT EXISTS destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('webhook', 'google_sheets', 'email')),
    label TEXT NOT NULL,
    config JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_destinations_agent ON destinations(agent_id, enabled, created_at DESC);

ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS destinations_owner ON destinations;
CREATE POLICY destinations_owner ON destinations
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);

CREATE TABLE IF NOT EXISTS user_billing (
    user_id TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
    plan_status TEXT NOT NULL DEFAULT 'active'
        CHECK (plan_status IN ('active', 'past_due', 'canceled', 'trialing')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_started_at TIMESTAMPTZ,
    current_period_ends_at TIMESTAMPTZ,
    docs_processed_current_period INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_billing_owner ON user_billing;
CREATE POLICY user_billing_owner ON user_billing
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);

CREATE OR REPLACE FUNCTION trestle_ensure_billing_period(p_user_id TEXT)
RETURNS user_billing
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    row user_billing;
BEGIN
    INSERT INTO user_billing (
        user_id,
        current_period_started_at,
        current_period_ends_at
    )
    VALUES (
        p_user_id,
        NOW(),
        NOW() + INTERVAL '30 days'
    )
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO row
    FROM user_billing
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF row.current_period_ends_at IS NULL OR row.current_period_ends_at <= NOW() THEN
        UPDATE user_billing
        SET
            docs_processed_current_period = 0,
            current_period_started_at = NOW(),
            current_period_ends_at = NOW() + INTERVAL '30 days',
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING * INTO row;
    END IF;

    RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION trestle_increment_usage(p_user_id TEXT)
RETURNS user_billing
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    row user_billing;
BEGIN
    SELECT * INTO row FROM trestle_ensure_billing_period(p_user_id);

    UPDATE user_billing
    SET
        docs_processed_current_period = docs_processed_current_period + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO row;

    RETURN row;
END;
$$;
