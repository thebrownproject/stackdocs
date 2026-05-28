-- Migration 011: Add Sprite columns to stacks table for v2
-- Adds sprite_name and sprite_status to support per-stack Sprite VM mapping.
-- Applied manually via Supabase SQL Editor.

ALTER TABLE stacks ADD COLUMN sprite_name TEXT;
ALTER TABLE stacks ADD COLUMN sprite_status TEXT DEFAULT 'pending';

-- sprite_status lifecycle: pending → provisioning → active → suspended
-- sprite_name: Sprites.dev VM identifier (e.g. "stack-abc123"), NULL until provisioned
