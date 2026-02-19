-- Migration: 010_document_metadata.sql
-- Description: Add metadata columns for document processing redesign + convert all timestamps to TIMESTAMPTZ
-- Design Doc: docs/plans/in-progress/documents-redesign/2026-01-13-documents-redesign-design.md

-- Add new metadata columns
ALTER TABLE documents
ADD COLUMN display_name TEXT,
ADD COLUMN tags TEXT[] DEFAULT '{}',
ADD COLUMN summary TEXT,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add comments for documentation
COMMENT ON COLUMN documents.display_name IS 'AI-generated or user-edited display name';
COMMENT ON COLUMN documents.tags IS 'Array of tags for filtering/search';
COMMENT ON COLUMN documents.summary IS 'One-line document summary (1-2 sentences)';
COMMENT ON COLUMN documents.updated_at IS 'Auto-updated on any row change';

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to documents table
CREATE TRIGGER documents_updated_at_trigger
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Convert all existing timestamp columns to timestamptz for proper timezone handling
-- Existing values are treated as UTC during conversion
ALTER TABLE documents ALTER COLUMN uploaded_at TYPE TIMESTAMPTZ USING uploaded_at AT TIME ZONE 'UTC';
ALTER TABLE extractions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE extractions ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE ocr_results ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE stack_documents ALTER COLUMN added_at TYPE TIMESTAMPTZ USING added_at AT TIME ZONE 'UTC';
ALTER TABLE stack_table_rows ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE stack_table_rows ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE stack_tables ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE stack_tables ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE stacks ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE stacks ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
