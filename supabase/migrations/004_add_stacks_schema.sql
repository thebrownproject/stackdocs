-- Stackdocs - Stacks Schema + Agent SDK Sessions
-- Migration: 004
-- Created: 2024-12-18
-- Description: Add stacks feature with many-to-many document relationships,
--              stack tables for multi-document extraction, and session
--              persistence for Agent SDK.

-- ============================================================================
-- PART 1: NEW TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: stacks
-- Purpose: Stack metadata - a collection of related documents
-- ----------------------------------------------------------------------------
CREATE TABLE stacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Stack info
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'active',  -- active, processing, error

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stacks_user_id ON stacks(user_id, created_at DESC);

-- Comments
COMMENT ON TABLE stacks IS 'User-created stacks (collections of documents)';
COMMENT ON COLUMN stacks.status IS 'active=ready, processing=extraction running, error=failed';


-- ----------------------------------------------------------------------------
-- Table: stack_documents (Junction Table)
-- Purpose: Many-to-many relationship between documents and stacks
-- ----------------------------------------------------------------------------
CREATE TABLE stack_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stack_id UUID NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    -- When document was added to stack
    added_at TIMESTAMP DEFAULT NOW(),

    -- Prevent duplicate assignments
    UNIQUE(stack_id, document_id)
);

-- Indexes for fast lookups in both directions
CREATE INDEX idx_stack_documents_stack ON stack_documents(stack_id);
CREATE INDEX idx_stack_documents_document ON stack_documents(document_id);

-- Comments
COMMENT ON TABLE stack_documents IS 'Junction table: documents can belong to multiple stacks';


-- ----------------------------------------------------------------------------
-- Table: stack_tables
-- Purpose: User-created tables within a stack for multi-document extraction
-- ----------------------------------------------------------------------------
CREATE TABLE stack_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stack_id UUID NOT NULL REFERENCES stacks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Table info
    name VARCHAR(255) NOT NULL DEFAULT 'Master Data',

    -- Extraction configuration (same pattern as document extraction)
    mode VARCHAR(20) NOT NULL DEFAULT 'auto',  -- 'auto' or 'custom'
    custom_columns TEXT[],  -- column names if mode='custom', e.g., ['vendor', 'date', 'amount']

    -- Actual columns after extraction (set by agent)
    -- Format: [{"name": "vendor", "type": "text"}, {"name": "amount", "type": "number"}]
    columns JSONB,

    -- Agent SDK session for this table
    session_id VARCHAR(50),

    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, error

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stack_tables_stack ON stack_tables(stack_id);
CREATE INDEX idx_stack_tables_user ON stack_tables(user_id);
CREATE INDEX idx_stack_tables_session ON stack_tables(session_id) WHERE session_id IS NOT NULL;

-- Comments
COMMENT ON TABLE stack_tables IS 'Tables within a stack - each table extracts specific columns from all documents';
COMMENT ON COLUMN stack_tables.mode IS 'auto=AI decides columns, custom=user specifies columns';
COMMENT ON COLUMN stack_tables.columns IS 'Column definitions after extraction: [{name, type}, ...]';
COMMENT ON COLUMN stack_tables.session_id IS 'Claude Agent SDK session for table-level corrections';


-- ----------------------------------------------------------------------------
-- Table: stack_table_rows
-- Purpose: Individual rows in a stack table, one per document
-- ----------------------------------------------------------------------------
CREATE TABLE stack_table_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES stack_tables(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Link to source extraction (optional - for traceability)
    extraction_id UUID REFERENCES extractions(id) ON DELETE SET NULL,

    -- Extracted data for this row
    -- Keys must match stack_tables.columns
    -- Example: {"vendor": "Acme Inc", "date": "2024-01-15", "amount": "1500.00"}
    row_data JSONB NOT NULL,

    -- Confidence scores per column
    -- Example: {"vendor": 0.95, "date": 0.98, "amount": 0.92}
    confidence_scores JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- One row per document per table
    UNIQUE(table_id, document_id)
);

-- Indexes
CREATE INDEX idx_stack_table_rows_table ON stack_table_rows(table_id);
CREATE INDEX idx_stack_table_rows_document ON stack_table_rows(document_id);
CREATE INDEX idx_stack_table_rows_user ON stack_table_rows(user_id);

-- Comments
COMMENT ON TABLE stack_table_rows IS 'Rows in a stack table - one row per document';
COMMENT ON COLUMN stack_table_rows.row_data IS 'Extracted data keyed by column name from stack_tables.columns';
COMMENT ON COLUMN stack_table_rows.extraction_id IS 'Source extraction this row was derived from';


-- ============================================================================
-- PART 2: MODIFY EXISTING TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: documents - Add session_id for document-level agent chat
-- ----------------------------------------------------------------------------
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS session_id VARCHAR(50);

COMMENT ON COLUMN documents.session_id IS 'Claude Agent SDK session for document-level corrections';

CREATE INDEX IF NOT EXISTS idx_documents_session_id
ON documents(session_id) WHERE session_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- Table: extractions - Add Agent SDK metadata
-- ----------------------------------------------------------------------------

-- Session ID for the extraction
ALTER TABLE extractions
ADD COLUMN IF NOT EXISTS session_id VARCHAR(50);

-- Flag to distinguish corrections from fresh extractions
ALTER TABLE extractions
ADD COLUMN IF NOT EXISTS is_correction BOOLEAN DEFAULT FALSE;

-- Comments
COMMENT ON COLUMN extractions.session_id IS 'Claude Agent SDK session that produced this extraction';
COMMENT ON COLUMN extractions.is_correction IS 'True if this was a correction via session resume';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_extractions_session_id
ON extractions(session_id) WHERE session_id IS NOT NULL;


-- ============================================================================
-- PART 3: ROW-LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stack_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stack_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE stack_table_rows ENABLE ROW LEVEL SECURITY;

-- Stacks: Users can only see their own stacks
CREATE POLICY stacks_user_isolation ON stacks
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Stack Documents: Users can only see documents in their stacks
CREATE POLICY stack_documents_user_isolation ON stack_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM stacks
            WHERE stacks.id = stack_documents.stack_id
            AND stacks.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM stacks
            WHERE stacks.id = stack_documents.stack_id
            AND stacks.user_id = auth.uid()
        )
    );

-- Stack Tables: Users can only see their own tables
CREATE POLICY stack_tables_user_isolation ON stack_tables
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Stack Table Rows: Users can only see their own rows
CREATE POLICY stack_table_rows_user_isolation ON stack_table_rows
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
