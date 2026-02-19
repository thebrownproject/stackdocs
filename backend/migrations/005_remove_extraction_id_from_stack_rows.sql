-- Stackdocs - Remove extraction_id from stack_table_rows
-- Migration: 005
-- Created: 2024-12-18
-- Description: Simplify schema by removing redundant extraction_id FK.
--              document_id is sufficient for traceability - can join to
--              extractions via document_id when needed.

-- ============================================================================
-- 1. Drop the column
-- ============================================================================

ALTER TABLE stack_table_rows
DROP COLUMN IF EXISTS extraction_id;

-- ============================================================================
-- 2. Update table comment
-- ============================================================================

COMMENT ON TABLE stack_table_rows IS 'Rows in a stack table - one row per document. Links to source document via document_id.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
