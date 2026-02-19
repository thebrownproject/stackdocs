-- Migration: 008_add_html_tables.sql
-- Description: Add html_tables column for OCR 3 HTML table output

ALTER TABLE ocr_results
ADD COLUMN html_tables JSONB;

COMMENT ON COLUMN ocr_results.html_tables IS 'HTML table strings from OCR 3 for frontend rendering';
