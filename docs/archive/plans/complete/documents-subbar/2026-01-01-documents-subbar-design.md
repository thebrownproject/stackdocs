# Documents Sub-bar Completion

**Date:** 2026-01-01
**Updated:** 2026-01-05
**Status:** Design Complete (v2.2 - delete implementation + toast notifications)
**Feature:** Complete the documents sub-bar with functional Filter, Edit, Export, Delete, and Stack actions

---

## Overview

The documents sub-bar has placeholder components that need implementation. This feature completes the toolbar functionality for both the documents list view and document detail view.

### Scope

**In scope:**
- Filter dropdown (documents list: date/stack/status; document detail: show/hide fields)
- Edit button → opens agent flow (field editing + re-extract)
- Export button → simple dropdown (CSV/JSON download)
- Delete button → simple confirmation dialog
- Stack dropdown → checkbox toggle for stack membership
- SelectionActions for bulk operations

**Out of scope (tracked in issues):**
- Preview panel redesign (#36)
- Persist selected document (#37)
- Scroll padding bug (#38)
- Tooltip bug (#39)
- Preview panel "Open" button (#40)

### Success Criteria

- Filter dropdown filters documents by date/stack/status
- Edit opens agent flow with field editing + re-extract capability
- Export downloads CSV or JSON via simple dropdown
- Delete shows confirmation dialog and removes document
- Stack dropdown allows toggling stack membership via checkboxes
- Bulk selection actions work for both documents and fields

---

## Architecture

### Sub-bar Component Structure

The sub-bar uses Next.js parallel routes (`@subbar/`) with context-aware rendering:

```
@subbar/documents/
├── page.tsx              # Documents list sub-bar
├── [id]/page.tsx         # Document detail sub-bar (server wrapper)
└── default.tsx           # Fallback for route transitions
```

### Simplified Action Approach

**Agent flow (complex action):**
- Edit — multi-step field editing with re-extract capability

**Simple UI (direct actions):**
- Export — dropdown menu with CSV/JSON options, triggers download
- Delete — confirmation dialog, then API call
- Stack toggle — checkbox in dropdown, immediate DB update

### Prerequisites (Already Implemented)

The following components already exist and just need wiring/updates:
- **Stack dropdown checkbox UI** — `stacks-dropdown.tsx` already uses `DropdownMenuCheckboxItem`, just needs DB operations
- **SelectionActions structure** — Has `onDelete` and `onAddToStack` props, just disabled
- **Sub-bar parallel routes** — `@subbar/documents/` structure exists

### Prerequisites (Need Installation)

- **Sonner toast component** — Required for success/error notifications
  ```bash
  npx shadcn@latest add sonner
  ```
  Then add `<Toaster />` to root layout.

### State Management

| State | Location | Purpose |
|-------|----------|---------|
| Selection (docs) | `DocumentsFilterContext` | Track selected document IDs |
| Selection (fields) | `DocumentDetailFilterContext` | Track selected field IDs |
| List filters | `DocumentsFilterContext` | Date range, stacks, extraction status |
| Detail filters | `DocumentDetailFilterContext` | Show/hide field types |
| Agent flow | `agent-store.ts` (Zustand) | Current flow type/step/data |

**Note:** Documents list and document detail use **separate** filter contexts. Each context manages its own filter state.

---

## Sub-bar Layout

### Documents List

| State | Left | Right |
|-------|------|-------|
| Default | `[Filter] [Search]` | `[Upload]` |
| Checkbox selection | `[Filter] [Search]` | `[X selected] [Actions ▾] [Upload]` |

**Note:** Preview (clicking a row) does not change the sub-bar. Actions are available on the detail page.

### Document Detail

| State | Left | Right |
|-------|------|-------|
| Default | `[Filter] [Search]` | `[Stack ▾] [Edit] [Export] [Delete]` |
| Field checkbox selection | `[Filter] [Search]` | `[X selected] [Actions ▾] [Stack ▾] [Edit] [Export] [Delete]` |

---

## Components

### 1. Filter Dropdown

**Location:** `components/layout/filter-button.tsx` (update existing stub)

**Documents List Filters:**
| Filter | Type | Options |
|--------|------|---------|
| Date range | Select | Today, Yesterday, Last 7 days, Last 30 days, All time |
| Stacks | Multi-select | List of user's stacks + "No stack" option |
| Extraction status | Multi-select | Extracted, Not extracted, Processing, Failed |

**Document Detail Filter:**
- Show/hide field types or categories

**Behavior:**
- Dropdown with sections for each filter type
- Active filters shown as count badge on button: "Filter (2)"
- Clear all option at bottom
- Filters apply immediately (no "Apply" button)

**State:** Extends `DocumentsFilterContext` with filter values

### 2. Edit Flow (Agent)

**Location:** `components/agent/flows/documents/edit/`

**Flow type:** `edit-document` (consistent with `extract-document` naming)

**Trigger:** Edit button in document detail sub-bar

**Steps:**
1. `fields` - Display editable field list with current values
2. `confirm` - Review changes before saving

**Capabilities:**
- Edit field values (text input for each field)
- Delete selected fields
- Trigger re-extraction (button within flow, calls extraction agent)

**Data required:** Document ID, current extraction data, selected field IDs (if any)

**Type definition** (add to `agent-store.ts`):
```typescript
export type EditDocumentFlowStep = 'fields' | 'confirm'

// Add to AgentFlow union:
| { type: 'edit-document'; step: EditDocumentFlowStep; data: EditDocumentData }
```

### 3. Export Dropdown (Simple UI)

**Location:** `components/documents/export-dropdown.tsx` (new component)

**Trigger:** Export button in document detail sub-bar

**Behavior:**
```
[Export ▾]
  ├─ Download as CSV
  └─ Download as JSON
```

- Click option → generates file → browser download
- No agent flow, no confirmation needed
- Uses current document's extraction data
- Show success toast on download

**Filename format:**
- CSV: `{filename}_extraction_{YYYY-MM-DD}.csv`
- JSON: `{filename}_extraction_{YYYY-MM-DD}.json`

**Data required:** Document ID, extraction data

### 4. Delete Dialog (Simple UI)

**Location:** `components/documents/delete-dialog.tsx` (new component)

**Triggers:**
- Delete button in document detail sub-bar (single document)
- Delete in Actions dropdown (bulk documents or fields)

**Behavior:**
- Opens confirmation dialog (use shadcn `AlertDialog` for destructive actions)
- Shows what will be deleted: "Delete invoice.pdf?" or "Delete 3 documents?"
- Destructive action styling (red confirm button)
- On confirm: executes delete, closes dialog, shows success toast, navigates back (if detail) or refreshes list

**Data required:** Document ID(s) or field IDs, context (single vs bulk)

**Delete Implementation (Supabase Direct):**

Delete uses Supabase direct from frontend (not FastAPI — that's for agent operations only). This follows the project architecture where reads/writes go through Supabase directly.

```typescript
async function deleteDocuments(documentIds: string[]) {
  const supabase = createClerkSupabaseClient(getToken)

  // Step 1: Get file paths before deletion
  const { data: docs, error: fetchError } = await supabase
    .from('documents')
    .select('id, file_path')
    .in('id', documentIds)

  if (fetchError || !docs) {
    throw new Error('Failed to fetch documents for deletion')
  }

  // Step 2: Delete from database (cascades automatically)
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .in('id', documentIds)

  if (deleteError) {
    throw new Error('Failed to delete documents')
  }

  // Step 3: Delete from storage (best effort - log failures)
  const filePaths = docs.map(d => d.file_path)
  const { error: storageError } = await supabase
    .storage
    .from('documents')
    .remove(filePaths)

  if (storageError) {
    // Log but don't fail - DB deletion succeeded
    console.error('Storage cleanup failed, files may be orphaned:', filePaths, storageError)
  }

  return { deleted: documentIds.length }
}
```

**Why this approach works:**
- RLS policy `documents_clerk_isolation` ensures users can only delete their own documents
- `ON DELETE CASCADE` on foreign keys automatically cleans up: `ocr_results`, `extractions`, `stack_documents`, `stack_table_rows`
- Storage deletion is best-effort — if it fails, files are orphaned but no data integrity issue
- Bulk delete uses `.in()` filter for efficient single round-trip

### 5. Stack Dropdown (Checkbox Toggle)

**Location:** `components/documents/stacks-dropdown.tsx` (update existing)

**Prerequisites:** Checkbox UI already exists via `DropdownMenuCheckboxItem`. Needs:
- DB operations wired up
- `allStacks` fetched and passed (currently only `assignedStacks` is fetched)

**Structure:**
```
[2 Stacks ▾]
  ☑ Receipts Q4
  ☐ Tax Documents
  ☑ Invoice Processing
  ☐ Client Invoices
```

**Behavior:**
- Button label shows count: "2 Stacks" or "No stacks"
- Dropdown shows **all** user's stacks with checkboxes
- Checked = document belongs to that stack
- Toggle updates database immediately:
  - Check → `INSERT INTO stack_documents`
  - Uncheck → `DELETE FROM stack_documents`
- No "Create new stack" option (out of scope for MVP)

**Data fetch update:** `@subbar/documents/[id]/page.tsx` must fetch both:
- `assignedStacks` — stacks this document belongs to
- `allStacks` — all user's stacks (for the full checkbox list)

### 6. SelectionActions (Bulk Operations)

**Location:** `components/layout/selection-actions.tsx` (update existing)

**Documents List Actions:**
```
[Actions ▾]
  ├─ Add to Stack
  └─ Delete
```

**Document Detail Actions (fields):**
```
[Actions ▾]
  └─ Delete
```

**Behavior:**
- "Add to Stack" opens a modal/popover with stack checkboxes (same as Stack dropdown)
- "Delete" opens confirmation dialog

---

## Click Behavior (Already Implemented)

| Action | Result |
|--------|--------|
| Click row (not on name) | Preview in sidebar, stay on list |
| Click document name | Navigate to `/documents/[id]` |
| Click checkbox | Toggle selection for bulk actions |

**Conflict resolution:** Checkbox selection takes priority over preview state.

---

## API & Database Operations

### FastAPI Endpoints (Agent Operations Only)
- `POST /api/document/upload` - Upload document and run OCR
- `POST /api/agent/extract` - Trigger AI extraction

### Supabase Direct Operations (Frontend)

| Operation | Method | Description |
|-----------|--------|-------------|
| Delete documents | Supabase direct | `DELETE FROM documents WHERE id IN (...)` — cascades to related tables |
| Delete storage files | Supabase Storage | `supabase.storage.from('documents').remove(filePaths)` |
| Update extraction | Supabase direct | Update field values in `extractions` table |
| Delete fields | Supabase direct | Remove fields from extraction JSONB |
| Add to stack | Supabase direct | `INSERT INTO stack_documents (document_id, stack_id)` |
| Remove from stack | Supabase direct | `DELETE FROM stack_documents WHERE document_id = ? AND stack_id = ?` |

**Note:** All Supabase operations are protected by RLS policies. Users can only access their own data.

---

## Toast Notifications

Uses Sonner (shadcn's toast component) for all user feedback.

### Success Toasts
| Action | Message |
|--------|---------|
| Document deleted | "Document deleted" or "3 documents deleted" |
| Export complete | "Exported to CSV" or "Exported to JSON" |
| Stack toggle | "Added to {stack}" or "Removed from {stack}" |

### Error Handling
| Scenario | Handling |
|----------|----------|
| Delete fails | Show error toast, keep dialog open for retry |
| Export fails | Show error toast, allow retry |
| Stack toggle fails | Show error toast, revert checkbox state |
| Filter returns empty | Show "No documents match filters" empty state |
| Network error | Generic error toast with retry option |

---

## File Changes Summary

### New Files
```
components/documents/
├── export-dropdown.tsx       # CSV/JSON export dropdown
└── delete-dialog.tsx         # Confirmation dialog for delete

components/agent/flows/documents/
└── edit/                     # Edit agent flow (only agent flow needed)
    ├── metadata.tsx          # Use .tsx if importing step components
    ├── use-edit-flow.ts
    ├── steps/                # Step components (fields, confirm)
    └── index.ts
```

### Modified Files
```
components/layout/filter-button.tsx               # Implement filter dropdown
components/layout/selection-actions.tsx           # Enable and wire up actions
components/documents/stacks-dropdown.tsx          # Wire up DB operations (UI exists)
components/documents/document-detail-actions.tsx  # Add Delete button, wire up Edit/Export
components/agent/flows/registry.ts                # Register edit-document flow
components/agent/stores/agent-store.ts            # Add EditDocumentFlowStep type
components/documents/documents-filter-context.tsx # Add filter state
app/(app)/@subbar/documents/[id]/page.tsx         # Fetch allStacks for dropdown
```

---

## Implementation Order

1. **Filter dropdown** - Self-contained, no dependencies
2. **Stack dropdown** - Update to checkbox toggle with DB operations
3. **Export dropdown** - Simple dropdown with file generation
4. **Delete dialog** - Confirmation dialog with delete API
5. **Edit flow** - Agent flow for field editing + re-extract
6. **Wire up SelectionActions** - Connect bulk actions
7. **Integration testing** - Verify all actions work together

---

## Changes from v1 Design

| Original (v1) | Updated (v2) | Reasoning |
|---------------|--------------|-----------|
| 4 agent flows | 1 agent flow (Edit only) | Simpler UI for simple actions |
| Export via agent flow | Simple dropdown | Just a file download, no multi-step needed |
| Delete via agent flow | Simple dialog | Just a confirmation, no multi-step needed |
| Add-to-stack via agent flow | Checkbox dropdown | Direct toggle is faster |
| Stack dropdown with navigation | Checkbox toggle | Simpler, immediate feedback |
| Preview adds Edit to sub-bar | Preview doesn't change sub-bar | Cleaner separation: list = browse, detail = act |

---

## Code Review Findings

### v2.1 Review (2026-01-05)

| Finding | Resolution |
|---------|------------|
| Flow type should be `edit-document` not `edit` | Updated to match `extract-document` naming convention |
| `document-detail-actions.tsx` missing from modified files | Added — needs Delete button and wiring |
| Filter contexts not distinguished | Clarified: list uses `DocumentsFilterContext`, detail uses `DocumentDetailFilterContext` |
| `allStacks` not fetched for Stack dropdown | Added note: `@subbar/[id]/page.tsx` must fetch both `assignedStacks` and `allStacks` |
| `agent-store.ts` type update not mentioned | Added type definition snippet for `EditDocumentFlowStep` |
| Stack dropdown checkbox UI already exists | Added to Prerequisites section — just needs DB operations |

### v2.2 Review (2026-01-05)

| Finding | Resolution |
|---------|------------|
| No delete endpoint exists in FastAPI | Use Supabase direct from frontend (aligns with architecture: FastAPI = agents only) |
| Delete needs storage cleanup | 3-step process: fetch paths → delete DB → delete storage (best effort) |
| RLS policy verification | Confirmed `documents_clerk_isolation` allows DELETE for owner |
| Cascade behavior | Verified `ON DELETE CASCADE` on all related tables |
| Sonner not installed | Added to Prerequisites — requires `npx shadcn@latest add sonner` |
| Export filename format needed | Added: `{filename}_extraction_{YYYY-MM-DD}.csv/json` |
| Success toasts missing | Added Toast Notifications section with success messages |

---

## Related Documentation

- `frontend/CLAUDE.md` - Agent system patterns
- `docs/specs/ARCHITECTURE.md` - System architecture
- `docs/specs/SCHEMA.md` - Database schema (extractions, stack_documents tables)
- `docs/plans/issues/ACTIVE.md` - Issue #40 (Preview panel Open button)
