# Stacks Schema Design

**Status:** Planning Complete
**Date:** 2024-12-18
**Context:** Database redesign to support Stacks feature with Agent SDK session persistence

---

## Overview

Stackdocs allows users to:
1. Upload individual documents → extract structured data (current MVP)
2. Create **Stacks** → group documents → extract tabular data across multiple docs (this feature)

The name "Stackdocs" comes from this core feature: stacking multiple documents together to create unified data tables.

---

## Key Decisions Made

### 1. Many-to-Many: Documents ↔ Stacks

Documents can belong to multiple stacks. A single invoice might be in both "Q1 Expenses" and "Tax Filings 2023".

**Implementation:** Junction table `stack_documents`

### 2. Separate Rows vs JSONB Array

**Decision:** Use separate `stack_table_rows` table (one row per document per table)

**Why:**
- Can update single rows without rewriting entire table
- Easier error recovery (regenerate one row, not all)
- Per-row metadata (created_at, updated_at, confidence)
- Better performance for large stacks (50+ documents)
- Clear foreign key to source document

**Rejected Alternative:** JSONB array in `stack_tables.extracted_rows`
- Would require rewriting entire array for any update
- Harder to trace errors to specific documents

### 3. Keep Document Extractions as JSONB

**Decision:** Don't normalize `extractions.extracted_fields`

**Why:**
- Documents have varying schemas (invoice vs receipt vs contract)
- JSONB handles schema flexibility well
- Updates are "replace all" anyway
- Current implementation works fine

### 4. Stack Tables Read Existing Extractions

**Decision:** When building stack tables, agent reads from `extractions.extracted_fields`, not from OCR

**Why:**
- Avoids duplicate OCR/extraction work
- Leverages user corrections already made to document extractions
- Faster and cheaper (fewer API calls)
- Stack table is essentially a "view" that transforms existing data

**Data Flow:**
```
OCR → Document Extraction → Stack Table (transforms existing data)
     (not: OCR → Stack Table - would duplicate work)
```

### 5. Session Scope

**Decision:**
- Document-level session in `documents.session_id`
- Table-level session in `stack_tables.session_id`

**Why:**
- Document corrections need document context
- Stack table corrections need table-wide context
- Different scopes, different sessions

### 6. Schema Enforcement via Dynamic Tools

**Decision:** Generate tool schemas dynamically from `stack_tables.columns`

**Why:**
- Prevents agent from hallucinating column names
- Claude's tool calling is reliable - must match schema
- Invalid tool calls fail, agent retries
- More reliable than hoping agent follows instructions

**Example:**
```python
# If columns = ["vendor", "date", "amount"]
# Tool schema is generated as:
@tool("save_row", "Save extracted row", {
    "document_id": str,
    "vendor": str,
    "date": str,
    "amount": str,
})
```

---

## Schema Summary

### New Tables (4)

| Table | Purpose |
|-------|---------|
| `stacks` | Stack metadata (name, description, status) |
| `stack_documents` | Junction table for many-to-many |
| `stack_tables` | Tables within a stack (columns, session_id) |
| `stack_table_rows` | One row per document per table |

### Modified Tables (2)

| Table | Changes |
|-------|---------|
| `documents` | Add `session_id` |
| `extractions` | Add `session_id`, `is_correction`, `model`, `processing_time_ms` |

---

## Files in This Folder

| File | Description |
|------|-------------|
| `README.md` | This file - overview and decisions |
| `Migration.sql` | Complete database migration SQL |
| `Agent-Tools.md` | Tool definitions for extraction and correction |
| `Data-Flow.md` | Data flow diagrams and API endpoints |

---

## Related Documents

- `planning/SCHEMA.md` - Original schema documentation (to be updated)
- `planning/agent-sdk/Migration-Tasks.md` - Agent SDK migration progress
- `CLAUDE.md` - Project overview and context
