-- Stackdocs MVP - OCR Results Table
-- Migration: 002
-- Created: 2025-11-06
-- Description: Create ocr_results table for caching Mistral OCR output

-- ============================================================================
-- 1. OCR Results Table
-- ============================================================================
-- Stores raw OCR text and metadata from Mistral OCR API
-- One OCR result per document (UNIQUE constraint on document_id)
-- Cached for re-extraction without additional API costs

CREATE TABLE ocr_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- OCR output (markdown-formatted text from Mistral OCR)
    raw_text TEXT NOT NULL,
    page_count INTEGER NOT NULL,

    -- Layout data (JSONB for flexibility)
    -- Example: {"pages": [{"index": 0, "images": [{"id": "img-0.jpeg", "top_left_x": 10, ...}], "dimensions": {...}}]}
    layout_data JSONB,

    -- Performance & usage tracking
    processing_time_ms INTEGER NOT NULL,
    usage_info JSONB NOT NULL,  -- {"pages_processed": 3, "doc_size_bytes": 524288}

    -- Model tracking
    model VARCHAR(50) NOT NULL,  -- e.g., "mistral-ocr-2505-completion"

    -- Metadata
    ocr_engine VARCHAR(20) DEFAULT 'mistral',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================
-- Index for fast lookup by document_id (primary use case for re-extraction)
CREATE INDEX idx_ocr_results_document_id ON ocr_results(document_id);

-- Index for user-based queries (analytics, usage tracking)
CREATE INDEX idx_ocr_results_user_id ON ocr_results(user_id, created_at DESC);

-- ============================================================================
-- 3. Enable Row-Level Security
-- ============================================================================
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS Policy (User Isolation)
-- ============================================================================
-- Users can only access their own OCR results
CREATE POLICY ocr_results_user_isolation ON ocr_results
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 5. Comments (for documentation)
-- ============================================================================
COMMENT ON TABLE ocr_results IS 'Cached OCR results from Mistral OCR API. One result per document for re-extraction without additional API costs.';
COMMENT ON COLUMN ocr_results.raw_text IS 'Markdown-formatted text extracted by Mistral OCR. Called "raw" because it is unprocessed by LLM extraction.';
COMMENT ON COLUMN ocr_results.layout_data IS 'JSONB containing page-level layout data: images (id, coordinates, base64, annotations) and page dimensions.';
COMMENT ON COLUMN ocr_results.usage_info IS 'Mistral API usage metadata: pages_processed and doc_size_bytes for cost tracking.';
COMMENT ON COLUMN ocr_results.model IS 'Specific Mistral OCR model version used (e.g., mistral-ocr-2505-completion) for debugging and A/B testing.';
COMMENT ON COLUMN ocr_results.ocr_engine IS 'OCR provider name. Defaults to "mistral". Future-proofing for other OCR engines.';
