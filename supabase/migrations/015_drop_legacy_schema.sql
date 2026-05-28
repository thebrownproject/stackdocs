-- Migration 015: drop legacy schema no longer used by Trestle
--
-- DESTRUCTIVE — applying this permanently deletes the Stacks feature data, the
-- OCR results, and the old extraction-field RPCs. The Trestle architecture
-- removed OCR (documents are read directly) and the Stacks product entirely;
-- no current code references any of these objects. Review before applying.

-- Stacks feature (tables reference each other and documents — CASCADE the lot).
DROP TABLE IF EXISTS stack_documents CASCADE;
DROP TABLE IF EXISTS stack_table_rows CASCADE;
DROP TABLE IF EXISTS stack_tables CASCADE;
DROP TABLE IF EXISTS stacks CASCADE;

-- OCR results (Mistral OCR retired; includes the html_tables column from 008).
DROP TABLE IF EXISTS ocr_results CASCADE;

-- Old document-editor RPCs (the manual extraction-field editor UI is gone).
DROP FUNCTION IF EXISTS update_extraction_field;
DROP FUNCTION IF EXISTS remove_extraction_field;
