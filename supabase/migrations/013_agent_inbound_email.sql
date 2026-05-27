-- Migration 013: per-agent inbound email token (email-in stub)
-- Each agent gets a stable token used to derive a unique inbound address
-- (doc-<token>@<inbound-domain>). Delivery (an inbound email provider routing
-- to /api/extract) is wired later; this reserves the address per agent now.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS inbound_email_token TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_agents_inbound_token
    ON agents(inbound_email_token) WHERE inbound_email_token IS NOT NULL;
