# Stacks Feature Design v2

> **Status:** Ready for implementation planning
> **Created:** 2025-12-29
> **Replaces:** 2025-12-20-stacks-design.md
> **Database:** Migrations 004 & 005 already applied

---

## Problem

Users upload individual documents and get individual extractions. But many users have batches of similar documents (e.g., 50 invoices) and want to see all data in a single table for analysis, comparison, and export.

Current document extraction services only handle one doc at a time. **Stacks is the unfair advantage** — batch extraction with consistent schema across documents.

## Solution

**Stacks** = Excel workbook mental model
- **Stack** = workbook (container for related documents)
- **Tables** = worksheets (different views/extractions of the data)
- **Rows** = one per document, columns are the extracted fields

Documents are many-to-many — same invoice can belong to "Q1 Expenses" and "Acme Vendor History".

---

## Core Design Principles

### AI-First Interaction

This is not an app with AI bolted on. The **dynamic chat bar** is the primary interaction point.

| Traditional App | Stackdocs |
|-----------------|-----------|
| Buttons/dialogs for actions | Agent guides actions |
| AI as helper sidebar | AI as primary interface |
| User clicks through forms | User converses + clicks options |
| Static UI | Dynamic responses with buttons |

**Dynamic Chat Bar** (iPhone Dynamic Island concept):
- **Idle:** "How can I help you today?"
- **Working:** "Uploading document..." + spinner/glow
- **Awaiting input:** Shows in popup above bar
- **Complete:** "Done! Extracted 5 fields" + action buttons

### PA Model

The agent is a personal assistant, not a chatbot. User tells it what they want, agent:
- Does the work
- Shows progress
- Asks for decisions when needed
- Presents results with next actions

---

## User Workflows

### Creating a Stack

1. User hovers over "Stacks" section in sidebar → `+` appears
2. Clicks `+` → Agent popup opens
3. Agent: "What would you like to call this stack?"
4. User provides name (and optional description)
5. Stack created, user navigated to empty stack view

### Adding Documents to Stack

**From Stack view:**
- Click "+ Add Document" in Documents tab
- Agent offers: Upload new OR select from existing library

**From Document view:**
- Click "No stacks" dropdown in sub-bar
- Select stacks to assign document to (multi-select)

### Creating a Table

1. User clicks `+` tab in stack sub-bar
2. Agent: "What data do you want to extract from these documents?"
3. Based on response + stack description, agent either:
   - Suggests columns ("I recommend: Vendor, Date, Amount")
   - Asks if user wants to specify their own
4. User confirms/edits columns
5. Agent extracts data from all documents in stack
6. Table populated, user sees spreadsheet view

### Adding New Document to Stack with Existing Tables

- Document added to stack
- Tables show new document row with "Not extracted" indicator
- User can click to extract, or agent prompts: "3 documents pending extraction"

### Editing Columns (Re-extraction)

- User modifies table columns (add/remove/rename)
- **Smart merge:** Agent reads existing data, keeps unchanged columns, only re-extracts modified
- No data loss for columns that didn't change

---

## UI Structure

### Navigation

```
Nav header:   Logo | Search | [Upload] | User
Sub-bar:      [contextual based on page]
Content:      [data]
Chat bar:     [dynamic status / input]
Popup:        [agent workspace when active]
```

### Sub-bar Contexts

**Documents list page:**
```
Filter | Search                                          Upload
```

**Document detail page:**
```
Filter | Search                    No stacks | Edit | Export
```

**Stack view (Documents tab):**
```
[≡ Docs] [⊞ Master Data] [⊞ Table2] [+]    Filter | Search | + Add Document
```

**Stack view (Table tab):**
```
[≡ Docs] [⊞ Master Data] [⊞ Table2] [+]    Filter | Search | Export
```

### Tab Overflow

When 4+ tables exist:
```
[≡ Docs] [⊞ Master Data] [⊞ Vendors] [▼ 3 more]   Filter | Search
```

### Default View

Stack remembers last-used view (Documents vs specific Table) per user via localStorage.

### Stack Header

**Removed.** Breadcrumb provides context: `Stacks > Q1 Expenses 2024 > Master Data`

Stack description accessible via agent or settings menu.

---

## Agent Popup Behavior

### Structure

```
┌─────────────────────────────────────┐
│ ∧  [Title]                        ✕ │  ← Chevron collapse, X cancel
│                                     │
│ [Content: forms, options, results]  │
│                                     │
│ [Action buttons]                    │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ ⟳ Status message...                 │  ← Dynamic chat bar
└─────────────────────────────────────┘
```

### States

| State | Chat Bar | Popup |
|-------|----------|-------|
| Idle | "How can I help you today?" | Hidden or suggestions |
| Working | "Extracting..." + spinner | Progress steps |
| Awaiting input | "Waiting for input..." | Question + buttons |
| Complete | "Done!" | Summary + next actions |

### Summary (MVP)

Minimal summary after task completion:
```
✓ Done
Extracted 5 fields from invoice.pdf

[View Document]  [Extract Another]
```

---

## Data Model

Database schema already applied (migrations 004 & 005):

```
stacks
├── id, user_id, name, description, status
└── created_at, updated_at

stack_documents (many-to-many)
├── stack_id, document_id
└── added_at

stack_tables
├── id, stack_id, user_id, name
├── mode (auto/custom), custom_columns, columns (JSONB)
├── session_id (for Agent SDK corrections)
└── status, created_at, updated_at

stack_table_rows (one row per document per table)
├── id, table_id, document_id, user_id
├── row_data (JSONB), confidence_scores (JSONB)
└── created_at, updated_at
```

### Key Points

- **Stack-level AI session:** Conversation context spans all tables in stack
- **Smart merge on column edit:** Agent reads existing row_data, preserves unchanged columns
- **Many-to-many documents:** Same document can exist in multiple stacks

---

## MVP Scope

### In Scope

| Feature | Description |
|---------|-------------|
| Create stack | Via sidebar `+`, agent-guided |
| Add documents | Upload new or select existing |
| Quick-assign | "No stacks" dropdown on document detail |
| Create table | Agent asks purpose, suggests/accepts columns |
| Extract data | AI extracts to table rows |
| View table | Spreadsheet view with document names |
| Pending indicator | "Not extracted" for new docs in table |
| Export table | CSV download |
| Contextual sub-bar | Tabs on left, actions on right |

### Out of Scope (v1)

- Bulk find/replace corrections (user can type corrections in chat)
- Cross-stack queries
- Stack templates
- Scheduled re-extraction
- Sharing stacks between users

---

## Success Criteria

- User can create stack, add 10+ documents, extract to table in <60 seconds
- Natural language corrections work via chat bar
- Export to CSV produces clean, consistent schema
- UI feels like working with a PA, not clicking through forms

---

## Open Questions (Future Sessions)

- Top-right button behavior (upload vs unified action menu)
- Stack settings/archive/delete flows
- Table rename UX (double-click? context menu?)

---

## References

- Previous design: `2025-12-20-stacks-design.md` (archived)
- Database migrations: `backend/migrations/004_add_stacks_schema.sql`, `005_remove_extraction_id_from_stack_rows.sql`
- Schema docs: `docs/specs/SCHEMA.md`
