-- Stackdocs MVP - Add Extraction Metadata Fields
-- Migration: 003
-- Created: 2025-11-10
-- Description: Add model and processing_time_ms to extractions table for monitoring and debugging

-- ============================================================================
-- 1. Add new columns to extractions table
-- ============================================================================

-- Add model column to track which LLM was used for extraction
ALTER TABLE extractions
ADD COLUMN model VARCHAR(50) NOT NULL DEFAULT 'anthropic/claude-3.5-sonnet';

-- Add processing_time_ms column to track extraction performance
ALTER TABLE extractions
ADD COLUMN processing_time_ms INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- 2. Remove default values (only needed for existing rows)
-- ============================================================================

-- Remove defaults so future inserts must explicitly provide values
ALTER TABLE extractions
ALTER COLUMN model DROP DEFAULT,
ALTER COLUMN processing_time_ms DROP DEFAULT;

-- ============================================================================
-- 3. Update column comments for documentation
-- ============================================================================

COMMENT ON COLUMN extractions.model IS 'LLM model used for extraction (e.g., anthropic/claude-3.5-sonnet). Enables A/B testing and debugging.';
COMMENT ON COLUMN extractions.processing_time_ms IS 'Time taken for LLM extraction in milliseconds. Used for performance monitoring and optimization.';
COMMENT ON COLUMN extractions.extracted_fields IS 'Structured data extracted by AI as JSONB. Keys are field names, values are extracted data.';
COMMENT ON COLUMN extractions.confidence_scores IS 'Confidence scores (0.0-1.0) for each extracted field. Keys match extracted_fields keys.';
COMMENT ON COLUMN extractions.updated_at IS 'Last modification timestamp. Changes when user manually edits extracted_fields.';

-- ============================================================================
-- 4. Verification queries
-- ============================================================================

-- Verify new columns exist
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'extractions'
-- ORDER BY ordinal_position;

-- Verify existing extractions got default values (if any exist)
-- SELECT id, model, processing_time_ms, created_at
-- FROM extractions
-- LIMIT 5;
