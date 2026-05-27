-- Migration 014: webhook delivery log
-- Records each outbound delivery attempt of an extraction result so failed
-- deliveries are visible in the dashboard instead of failing silently.

CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',
    url TEXT NOT NULL,
    ok BOOLEAN NOT NULL,
    status_code INTEGER,
    attempts INTEGER NOT NULL DEFAULT 1,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_webhook_deliveries_agent ON webhook_deliveries(agent_id, created_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_deliveries_clerk_isolation ON webhook_deliveries
    FOR ALL TO authenticated USING ((SELECT auth.jwt()->>'sub') = user_id);
