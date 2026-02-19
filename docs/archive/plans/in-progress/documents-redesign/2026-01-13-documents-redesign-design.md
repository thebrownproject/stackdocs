# Documents Section Redesign

**Date:** 2026-01-13
**Status:** Design Complete
**Author:** Fraser + Claude

## Problem

The current Documents section has two issues:

1. **Redundant extraction systems** - Per-document extraction (`/documents/[id]`) duplicates what Stacks does, creating maintenance burden and user confusion.

2. **Unclear value proposition** - Clicking a document without extractions shows an empty "No data extracted" page. The per-document extraction feels like a demo feature rather than something teams would actually use.

3. **Confusing navigation** - Clicking a document navigates away from the list to a separate page, breaking the flow.

## Solution

**Clear separation of concerns:**

| Section | Purpose | AI Features |
|---------|---------|-------------|
| **Documents** | File management - upload, organize, preview, assign to stacks | Metadata generation (name, tags, summary) |
| **Stacks** | Structured data extraction - tables, rows, columns | Full extraction agent |

This gives users a simple mental model: "Documents = files, Stacks = data"

---

## Documents Section Changes

### What Gets Removed

1. **`/documents/[id]` route** - No more per-document extraction detail page
2. **Per-document extraction UI** - No "Extract" button for individual documents
3. **"X fields" indicator** - Remove extraction count from document metadata
4. **`extract-document` agent flow** - Remove incomplete re-extraction flow

### What Stays

1. **Documents list** - Name, Stacks (tags), Date columns
2. **Preview panel** - PDF and Text tabs
3. **Document actions** - Filter, Edit, Export, Delete in toolbar
4. **Stack assignment** - Assign documents to stacks from documents page
5. **Upload flow** - Via Agent Card (modified, see below)

### What's New

1. **AI-generated metadata on upload** - Display name, tags, summary
2. **Refactored preview metadata** - Shows new metadata fields
3. **Clicking document = select only** - No navigation, just updates preview panel

### Document Name Interaction Change

Currently the document name is a `<Link>` that navigates to `/documents/[id]`:

```tsx
// Current
<Link
  href={`/documents/${doc.id}`}
  onClick={(e) => e.stopPropagation()}
  className="font-medium hover:underline truncate"
>
  {doc.filename}
</Link>
```

Change to a plain span - clicking falls through to row selection:

```tsx
// New
<span className="font-medium truncate">
  {doc.filename}
</span>
```

**Result:**
- No underline on hover (not a link)
- Clicking name selects the row (triggers existing row click handler)
- Row hover state (`hover:bg-muted/30`) provides interaction feedback
- Preview panel updates to show selected document

---

## Upload Flow (Revised)

### Current Flow
```
Dropzone → Configure (auto/custom) → Fields (if custom) → Extracting → Complete
```

### New Flow
```
Dropzone → Processing → Review Metadata → Complete
```

### Step Details

**Step 1: Dropzone** (existing)
- User drops/selects file
- File uploads to storage
- Status: "Select a document"

**Step 2: Processing** (new)
- OCR runs on document
- Metadata agent generates: display_name, tags, summary
- Status: "Analyzing document..." (spinner)
- Agent Card collapsed to status bar

**Step 3: Review Metadata** (new)
- Agent Card expands with pre-filled results
- User can edit any field before confirming
- Status: "Review document details"

```
┌─────────────────────────────────────────────────┐
│ Document Details                                │
│                                                 │
│ Name                                            │
│ [Invoice - Acme Corp - March 2026.pdf     ]    │
│                                                 │
│ Tags                                            │
│ [invoice] [acme-corp] [$1,250] [+]             │
│                                                 │
│ Summary                                         │
│ ┌─────────────────────────────────────────────┐│
│ │ Monthly consulting invoice from Acme Corp   ││
│ │ dated March 15, 2026 for $1,250.00         ││
│ └─────────────────────────────────────────────┘│
│                                                 │
│ Add to Stack (optional)                         │
│ [Select a stack...                        ▼]   │
│                                                 │
│              [Regenerate]  [Save Document]      │
└─────────────────────────────────────────────────┘
```

**Step 4: Complete**
- Document saved with metadata
- Document status remains `ocr_complete` (metadata stored alongside OCR)
- Status: "Document saved" (check icon)
- Actions: "Upload Another", "Done"

### Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Stack assignment in upload | Optional | Don't force users into stacks, but educate them |
| Metadata editable | Yes | Keep user in the loop, AI assists but doesn't decide |
| Regenerate button | Yes | Let users re-run if AI got it wrong |
| Summary editable | Yes | Users may want to add context |

---

## Preview Panel Changes

### Current Metadata Display
```
file-sample_150kB.pdf
PDF · 139 KB · 4 pages · 6 fields
```

### New Metadata Display
```
Invoice - Acme Corp - March 2026        ← display_name (or original if not set)
PDF · 139 KB · 4 pages
[invoice] [acme-corp] [$1,250]          ← tags (clickable to filter?)
"Monthly consulting invoice from..."     ← summary (truncated, expand on hover)
```

### Tabs
- **PDF** - Visual document preview (unchanged)
- **Text** - OCR text view (unchanged)
- No "Data" tab - extraction happens in Stacks

### Actions (top-right toolbar)
- Expand/collapse preview
- Download document
- (Remove any extraction-related actions)

---

## Database Changes

### `documents` Table Updates

Add columns:
```sql
ALTER TABLE documents
ADD COLUMN display_name TEXT,
ADD COLUMN tags TEXT[] DEFAULT '{}',
ADD COLUMN summary TEXT,
ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at_trigger
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();
```

| Column | Type | Description |
|--------|------|-------------|
| `display_name` | TEXT | AI-generated or user-edited display name |
| `tags` | TEXT[] | Array of tags for filtering/search (TEXT[] chosen over JSONB for simplicity - native Postgres array ops) |
| `summary` | TEXT | One-line document summary |
| `updated_at` | TIMESTAMP | Auto-updated on any row change |

### Migration Notes
- Existing documents will have NULL for new metadata fields
- Could backfill by running metadata agent on existing docs (optional)
- Original `file_name` preserved, `display_name` shown in UI
- No RLS changes needed - existing `documents_clerk_isolation` policy covers new columns

### Existing Extractions Migration
The `extractions` table contains per-document extraction data that will no longer be used:
- **Keep table read-only** - Existing data remains accessible but no new records created
- **Deprecate post-MVP** - Once users have migrated to Stacks, consider archiving/removing
- **No data migration** - Extraction data structure differs from Stack tables, not worth migrating

### Files to Update

| File | Update |
|------|--------|
| `backend/migrations/` | Add new migration file: `010_document_metadata.sql` |
| `docs/specs/SCHEMA.md` | Update `documents` table definition with new columns |

---

## Backend Changes

### New Agent: `document_processor_agent`

Copy from existing extraction agent, modify to output metadata only.

**Input:**
- `document_id` - Document to process
- `ocr_text` - Already extracted OCR text

**Output:**
```json
{
  "display_name": "Invoice - Acme Corp - March 2026.pdf",
  "tags": ["invoice", "acme-corp", "$1,250"],
  "summary": "Monthly consulting invoice from Acme Corp dated March 15, 2026 for $1,250.00 covering development services."
}
```

**Tools:**
- `read_ocr` - Read cached OCR text
- `save_metadata` - Write to documents table

### Error Handling

| Scenario | Behavior |
|----------|----------|
| OCR not ready | Wait for OCR to complete before running metadata agent |
| Metadata generation fails | Save document with NULL metadata, user can retry via "Generate Metadata" action |
| User cancels during processing | Document saved with NULL metadata (can be processed later) |
| Agent timeout | Same as failure - NULL metadata, allow retry |

### API Endpoint

```
POST /api/document/metadata
{
  "document_id": "uuid"
}

Response (SSE stream):
- tool events (Reading document, Generating metadata...)
- result: { display_name, tags, summary }
```

### What Gets Removed
- Per-document extraction endpoints (if any exist separately)
- `extract-document` flow backend support

---

## Frontend Changes Summary

### Files to Modify

| File | Change |
|------|--------|
| `app/(app)/documents/[id]/` | **Delete entire directory** |
| `components/agent/flows/upload/` | Add `upload-metadata.tsx` step |
| `components/agent/flows/upload/metadata.ts` | Update flow steps |
| `components/agent/flows/extract/` | **Delete or deprecate** |
| `components/preview-panel/` | Update metadata display |
| `components/documents/document-row.tsx` | Remove click navigation, just select |

### New Components

```
components/agent/flows/upload/
  upload-metadata.tsx    ← New step component
```

### Flow Registration Update

```ts
// upload/metadata.ts
export const uploadFlowMetadata: FlowMetadata = {
  steps: [
    { id: 'dropzone', ... },
    { id: 'processing', ... },      // New
    { id: 'metadata', ... },        // New (replaces configure/fields)
    { id: 'complete', ... }
  ]
}
```

---

## Post-MVP Features

### Smart Search (RAG)
- User asks questions in chat bar
- Agent searches documents using metadata + OCR text
- Returns answers with document citations
- Example: "Which invoices are over $1000?"

### Bulk Upload
- Select multiple files
- Process metadata for each
- Review/edit in batch before saving

### Backfill Metadata
- Button to process existing documents
- Run metadata agent on docs with NULL display_name

---

## Success Criteria

1. **No `/documents/[id]` route** - Clicking documents stays on list
2. **Upload shows metadata review** - Users see AI-generated name/tags/summary
3. **Preview panel shows metadata** - Display name, tags, summary visible
4. **All extraction in Stacks** - No per-document extraction UI remains
5. **Database updated** - New columns exist and are populated on upload

---

## Open Questions

1. **Tag format** - Free-form text or predefined categories?
   - **Recommendation:** Free-form for MVP, AI generates what makes sense

2. **Summary length** - How long should summaries be?
   - **Recommendation:** 1-2 sentences, ~150 characters max

3. **Regenerate scope** - Regenerate all metadata or individual fields?
   - **Recommendation:** All metadata for MVP, simpler UX

4. **Existing documents** - Backfill immediately or lazy?
   - **Recommendation:** Lazy - only process when user requests or uploads new
