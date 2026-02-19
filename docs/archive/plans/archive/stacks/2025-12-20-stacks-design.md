# Stacks Feature Design

> **Status:** Ready for implementation (pending Agent SDK frontend)
> **Created:** 2025-12-20
> **Database:** Migrations 004 & 005 already applied

---

## Problem

Users upload individual documents and get individual extractions. But many users have batches of similar documents (e.g., 50 invoices) and want to see all data in a single table for analysis, comparison, and export.

## Solution

**Stacks** - users group documents into a stack, then extract tabular data across all documents with a consistent schema.

```
Stack: "Q1 Invoices"
├── invoice_jan.pdf  →  { vendor: "Acme", amount: 1200 }
├── invoice_feb.pdf  →  { vendor: "Widget Co", amount: 800 }
└── invoice_mar.pdf  →  { vendor: "Acme", amount: 1500 }

→ Stack Table Output:
| Document        | Vendor    | Amount |
|-----------------|-----------|--------|
| invoice_jan.pdf | Acme      | 1200   |
| invoice_feb.pdf | Widget Co | 800    |
| invoice_mar.pdf | Acme      | 1500   |
```

---

## Data Model

Database schema (already applied via migrations 004 & 005):

```
stacks
├── id, user_id, name, description, status
└── created_at, updated_at

stack_documents (junction table - many-to-many)
├── stack_id, document_id
└── added_at

stack_tables (tables within a stack)
├── id, stack_id, user_id, name
├── mode (auto/custom), custom_columns
├── columns (JSONB - defined by agent or user)
├── session_id (for Agent SDK corrections)
└── status, created_at, updated_at

stack_table_rows (one row per document per table)
├── id, table_id, document_id
├── row_data (JSONB - the extracted values)
├── confidence_scores (JSONB)
└── created_at, updated_at
```

### Key Design Decisions

1. **Many-to-many** - Documents can belong to multiple stacks (e.g., same invoice in "Q1 Expenses" and "Tax 2024")
2. **Separate rows table** - Enables single-row updates without rewriting entire table
3. **Reads existing extractions** - Stack tables transform data from `extractions.extracted_fields`, not re-running OCR
4. **Session per table** - `stack_tables.session_id` enables natural language corrections across the whole table

---

## User Workflow

1. **Create stack** - Give it a name (e.g., "Q1 Invoices 2024")
2. **Add documents** - Select existing documents from library
3. **Create table** - Choose auto (agent infers columns) or custom (user specifies columns)
4. **Agent extracts** - Reads each document's existing extraction, populates table rows
5. **Review & correct** - Natural language corrections ("Change vendor for invoice_march to Acme Inc")
6. **Export** - CSV/JSON with consistent schema

---

## API Endpoints

### FastAPI (AI processing)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/stacks` | Create stack |
| POST | `/api/stacks/{id}/documents` | Add documents |
| POST | `/api/stacks/{id}/tables` | Create table (triggers extraction) |
| POST | `/api/stacks/{id}/tables/{table_id}/extract` | SSE streaming extraction |
| POST | `/api/stacks/{id}/tables/{table_id}/correct` | SSE correction with session resume |
| GET | `/api/stacks/{id}/tables/{table_id}/rows` | Get all rows |

### Frontend Direct to Supabase

Same pattern as documents - list stacks, get stack details, manual row edits, realtime updates.

---

## Agent Tools

Tool schemas are generated dynamically from `stack_tables.columns` to prevent the agent from hallucinating column names.

| Tool | Purpose | Dynamic Schema |
|------|---------|----------------|
| `define_columns` | Auto mode - agent proposes columns after analyzing docs | No |
| `read_document_extraction` | Read existing extraction for a document | No |
| `save_table_row` | Save row with exact column names | **Yes** |
| `update_table_row` | Correct specific cells in a row | **Yes** |
| `bulk_update_rows` | Bulk corrections (e.g., "change all Acme Corp to Acme Inc") | Validates columns |

### Dynamic Schema Example

```python
# If columns = ["vendor", "date", "amount"]
# Generated tool schema:
@tool("save_table_row", "Save row to table", {
    "document_id": str,
    "vendor": str,      # ← enforced
    "date": str,        # ← enforced
    "amount": str,      # ← enforced
    "confidence_scores": dict
})
```

Claude's tool calling is reliable - if the schema says `vendor`, the agent can't output `vendor_name`. Invalid tool calls fail and the agent retries.

---

## Dependencies & Constraints

### Prerequisites

1. **Agent SDK frontend integration (Phase 7)** - Streaming UI, `useAgentExtraction` hook, SSE handling
2. **Document extraction working end-to-end** - Stacks reads from `extractions.extracted_fields`

### Constraints

- **Database ready** - Migrations 004 & 005 already applied
- **Same streaming pattern** - Reuse SSE infrastructure from document extraction
- **Session per table** - Not per stack (different tables may need different correction contexts)

### Out of Scope (v1)

- Cross-stack queries (search across all stacks)
- Stack templates (pre-defined column sets)
- Scheduled re-extraction (auto-refresh when source docs change)
- Sharing stacks between users

---

## Success Criteria

- User can create stack, add 10+ documents, extract to table in <60 seconds
- Natural language corrections work ("fix the vendor for invoice_march")
- Export to CSV produces clean, consistent schema

---

## References

- Original planning docs: `archive/` folder in this directory
- Database migrations: `backend/migrations/004_add_stacks_schema.sql`, `005_remove_extraction_id_from_stack_rows.sql`
