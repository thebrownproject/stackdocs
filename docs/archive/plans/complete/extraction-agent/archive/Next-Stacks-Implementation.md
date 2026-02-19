# Next: Stacks Implementation

**When to read this:** After completing Agent SDK Phases 6-7 (document-level extraction working end-to-end with frontend).

---

## Context

The Agent SDK migration gives us:
- Session persistence (Claude remembers context)
- Streaming (real-time thinking display)
- Tool execution (structured extraction)

**Stacks** uses this same infrastructure for multi-document table extraction.

---

## What Are Stacks?

Users group multiple documents into a "stack" and extract tabular data across all of them.

```
Stack: "Q1 Invoices"
├── invoice_jan.pdf  →  { vendor: "Acme", amount: 1200 }
├── invoice_feb.pdf  →  { vendor: "Widget Co", amount: 800 }
└── invoice_mar.pdf  →  { vendor: "Acme", amount: 1500 }

Stack Table Output:
| Document        | Vendor    | Amount |
|-----------------|-----------|--------|
| invoice_jan.pdf | Acme      | 1200   |
| invoice_feb.pdf | Widget Co | 800    |
| invoice_mar.pdf | Acme      | 1500   |
```

---

## Schema (Already Applied)

Migration `004_add_stacks_schema.sql` added:
- `stacks` - Stack metadata
- `stack_documents` - Junction table (many-to-many)
- `stack_tables` - Tables within stacks (columns, session_id)
- `stack_table_rows` - One row per document per table

Migration `005_remove_extraction_id_from_stack_rows.sql` simplifies the schema.

**Run 005 in Supabase if not already done.**

---

## Implementation Tasks

### 1. Stack Table Extraction Endpoint

```
POST /api/stacks/{stack_id}/tables/{table_id}/extract
```

- Reads existing `extractions.extracted_fields` for each document in stack
- Agent defines columns (auto mode) or uses user-specified columns (custom mode)
- Agent saves one row per document to `stack_table_rows`
- SSE streaming (same pattern as document extraction)

### 2. Stack Table Correction Endpoint

```
POST /api/stacks/{stack_id}/tables/{table_id}/correct
```

- Resumes session from `stack_tables.session_id`
- Agent updates specific rows based on user instruction
- Single row or bulk updates

### 3. Agent Tools (Dynamic Schema)

New tools for stack tables:
- `define_columns` - Auto mode column definition
- `save_table_row` - Dynamic schema from `stack_tables.columns`
- `update_table_row` - Single row correction
- `bulk_update_rows` - Bulk corrections

Key pattern: Tool schemas generated dynamically from `stack_tables.columns` to prevent hallucination.

### 4. Frontend

- Stack creation/management (Supabase direct)
- Table extraction with streaming thinking
- Table view with editable rows
- Export to CSV/JSON

---

## Planning Docs

Full details in `planning/stacks-schema/`:
- `README.md` - Overview and key decisions
- `Migration.sql` - Database schema
- `Agent-Tools.md` - Tool definitions
- `Data-Flow.md` - API endpoints and data flows

---

## Summary

| Document Extraction | Stack Table Extraction |
|---------------------|------------------------|
| Single document | Multiple documents |
| `save_extracted_data` tool | `save_table_row` tool (dynamic) |
| `documents.session_id` | `stack_tables.session_id` |
| JSONB extracted_fields | JSONB row_data per document |
