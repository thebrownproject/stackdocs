# Phase 1: Database Migration - Documents Metadata

**Feature:** Documents Redesign
**Phase:** 1 of N (Database Changes)
**Design Doc:** `2026-01-13-documents-redesign-design.md`
**Created:** 2026-01-13
**Status:** ✅ Complete (2026-01-13)

---

## Overview

Add metadata columns to the `documents` table to support AI-generated document metadata (display name, tags, summary). This is the foundation for the new upload flow where documents get auto-generated metadata.

**Columns to Add:**
- `display_name` - AI-generated or user-edited display name
- `tags` - Array of tags for filtering/search
- `summary` - One-line document summary
- `updated_at` - Auto-updated timestamp on any row change

---

## Tasks

### Task 1: Create Migration File

**File:** `backend/migrations/010_document_metadata.sql`

Create the migration file with the following SQL:

```sql
-- Migration: 010_document_metadata.sql
-- Description: Add metadata columns for document processing redesign
-- Design Doc: docs/plans/in-progress/documents-redesign/2026-01-13-documents-redesign-design.md

-- Add new metadata columns
ALTER TABLE documents
ADD COLUMN display_name TEXT,
ADD COLUMN tags TEXT[] DEFAULT '{}',
ADD COLUMN summary TEXT,
ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

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
```

**Success Criteria:**
- [ ] File exists at `backend/migrations/010_document_metadata.sql`
- [ ] SQL syntax is valid
- [ ] Comments explain each column's purpose

---

### Task 2: Apply Migration to Supabase

Apply the migration using the Supabase MCP tool.

**Command:**
```
mcp__supabase__apply_migration
  project_id: mhunycthasqrqctfgfkt
  name: document_metadata
  query: <contents of 010_document_metadata.sql>
```

**Success Criteria:**
- [ ] Migration applies without errors
- [ ] Verify columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'documents';`
- [ ] Verify trigger exists: `SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'documents';`

---

### Task 3: Verify Trigger Works

Test the `updated_at` trigger by updating an existing document.

**Test Query (run via Supabase MCP or SQL editor):**
```sql
-- Get a document to test with
SELECT id, filename, updated_at FROM documents LIMIT 1;

-- Update the document (any column)
UPDATE documents SET filename = filename WHERE id = '<document_id>';

-- Check that updated_at changed
SELECT id, filename, updated_at FROM documents WHERE id = '<document_id>';
```

**Success Criteria:**
- [ ] `updated_at` column updates automatically when any column changes
- [ ] Original data is preserved (filename unchanged)

---

### Task 4: Update SCHEMA.md Documentation

Update `docs/specs/SCHEMA.md` to reflect the new columns in the `documents` table.

**Changes to Make:**

1. **Update the `documents` table definition** (around line 67-85):

Replace the existing `documents` table SQL block with:

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub',  -- Clerk user ID
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    mode VARCHAR(20) NOT NULL,              -- 'auto' or 'custom'
    status VARCHAR(20) DEFAULT 'processing', -- 'processing', 'ocr_complete', 'completed', 'failed'
    session_id VARCHAR(50),                  -- Claude Agent SDK session for corrections

    -- Metadata (AI-generated or user-edited)
    display_name TEXT,                       -- AI-generated display name
    tags TEXT[] DEFAULT '{}',                -- Tags for filtering/search
    summary TEXT,                            -- One-line document summary

    uploaded_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()       -- Auto-updated via trigger
);

-- Indexes
CREATE INDEX idx_documents_user_id ON documents(user_id, uploaded_at DESC);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_user_status ON documents(user_id, status);
CREATE INDEX idx_documents_session_id ON documents(session_id) WHERE session_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER documents_updated_at_trigger
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();
```

2. **Add the trigger function** to the RPC Functions section (after line 319):

Add a new subsection:

```markdown
### `update_documents_updated_at`

Trigger function that automatically updates the `updated_at` column on any row change.

```sql
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Note:** Attached to `documents` table via `documents_updated_at_trigger`.
```

3. **Update the migrations table** (around line 430-440):

Add a new row:

```markdown
| 010_document_metadata.sql | Add display_name, tags, summary, updated_at columns |
```

4. **Update the "Last Updated" date** at the top of the file to `2026-01-13`.

**Success Criteria:**
- [ ] `documents` table definition includes all 4 new columns
- [ ] Trigger function documented in RPC Functions section
- [ ] Migration listed in Migrations table
- [ ] Version date updated

---

## Verification Checklist

After completing all tasks:

- [x] Migration file exists at `backend/migrations/010_document_metadata.sql`
- [x] All 4 columns exist in production database (`display_name`, `tags`, `summary`, `updated_at`)
- [x] `updated_at` trigger fires on row updates
- [x] `SCHEMA.md` reflects new schema
- [x] Existing documents have NULL for `display_name` and `summary`, empty array `{}` for `tags`
- [x] RLS policy `documents_clerk_isolation` still works (no changes needed - it covers all columns)

---

## Notes

- **No RLS changes needed** - The existing `documents_clerk_isolation` policy covers all columns automatically
- **TIMESTAMPTZ conversion** - Also converted all 13 timestamp columns across all tables to TIMESTAMPTZ for proper timezone handling (user in Melbourne, Australia)
- **No backfill required** - Existing documents will have NULL metadata, processed on-demand
- **TEXT[] for tags** - Chosen over JSONB for simplicity; native Postgres array operations
- **Trigger function reusable** - Could be attached to other tables in future if needed

---

## Rollback

If something goes wrong, rollback with:

```sql
-- Remove trigger first
DROP TRIGGER IF EXISTS documents_updated_at_trigger ON documents;

-- Remove function
DROP FUNCTION IF EXISTS update_documents_updated_at();

-- Remove columns
ALTER TABLE documents
DROP COLUMN IF EXISTS display_name,
DROP COLUMN IF EXISTS tags,
DROP COLUMN IF EXISTS summary,
DROP COLUMN IF EXISTS updated_at;
```
