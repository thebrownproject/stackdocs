# Phase 4: Frontend Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove per-document detail page and extraction UI, update document list and preview panel to use new metadata fields (display_name, tags, summary).

**Architecture:** Documents now have AI-generated metadata stored directly on the documents table. The preview panel shows this metadata instead of extraction field counts. The `/documents/[id]` route is removed - users view documents via the preview panel on the list page.

**Tech Stack:** Next.js 16, React 18, shadcn/ui, Supabase, TypeScript

---

## Overview

This phase removes the per-document extraction UI by:
1. Deleting the `/documents/[id]` detail page and related routes
2. Changing document name from a navigating Link to a plain span with display_name and tags
3. Updating preview panel to show new metadata (display_name, tags, summary)
4. Deprecating the `extract-document` agent flow
5. Adding breadcrumb enhancement to show selected document name

**Dependencies:** Requires Phase 1 (database columns) and Phase 3 (upload flow) to be complete.

---

## Task 1: Delete Document Detail Route (Conditional)

**Note:** These routes may already be deleted. Check if they exist before attempting removal.

**Step 1a: Check if routes exist**

```bash
# Check which directories exist
ls -la frontend/app/\(app\)/documents/\[id\]/ 2>/dev/null && echo "EXISTS" || echo "ALREADY DELETED"
ls -la frontend/app/\(app\)/@header/documents/\[id\]/ 2>/dev/null && echo "EXISTS" || echo "ALREADY DELETED"
ls -la frontend/app/\(app\)/@subbar/documents/\[id\]/ 2>/dev/null && echo "EXISTS" || echo "ALREADY DELETED"
```

**Step 1b: Delete if they exist**

```bash
# Delete only if directories exist
[ -d "frontend/app/(app)/documents/[id]" ] && git rm -r frontend/app/\(app\)/documents/\[id\]/
[ -d "frontend/app/(app)/@header/documents/[id]" ] && git rm -r frontend/app/\(app\)/@header/documents/\[id\]/
[ -d "frontend/app/(app)/@subbar/documents/[id]" ] && git rm -r frontend/app/\(app\)/@subbar/documents/\[id\]/
```

**Expected files (if they exist):**
- `frontend/app/(app)/documents/[id]/page.tsx`
- `frontend/app/(app)/@header/documents/[id]/page.tsx`
- `frontend/app/(app)/@header/documents/[id]/default.tsx`
- `frontend/app/(app)/@header/documents/[id]/error.tsx`
- `frontend/app/(app)/@subbar/documents/[id]/page.tsx`
- `frontend/app/(app)/@subbar/documents/[id]/default.tsx`

**If routes don't exist:** Skip to Task 2. The routes may have been removed in a previous refactor.

---

## Task 2: Change Document Name from Link to Span with Display Name and Tags

**File:** `frontend/components/documents/columns.tsx`

**Step 2a: Add Badge import (line 1-16)**

Add the Badge import after the existing imports:
```tsx
import { Badge } from "@/components/ui/badge";
```

**Step 2b: Replace the filename cell (approximately lines 94-115)**

**Current code:**
```tsx
cell: ({ row }) => {
  const doc = row.original;
  return (
    <div className="flex items-center gap-2 max-w-full -ml-px">
      <FileTypeIcon mimeType={doc.mime_type} className="shrink-0" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/documents/${doc.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium hover:underline truncate"
          >
            {doc.filename}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Open {doc.filename}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
},
```

**New code:**
```tsx
cell: ({ row }) => {
  const doc = row.original;
  const displayText = doc.display_name || doc.filename;
  return (
    <div className="flex items-center gap-2 max-w-full -ml-px">
      <FileTypeIcon mimeType={doc.mime_type} className="shrink-0" />
      <span className="font-medium truncate" title={displayText}>
        {displayText}
      </span>
      {doc.tags && doc.tags.length > 0 && (
        <div className="flex gap-1 shrink-0">
          {doc.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {doc.tags.length > 2 && (
            <span className="text-xs text-muted-foreground">+{doc.tags.length - 2}</span>
          )}
        </div>
      )}
    </div>
  );
},
```

**Step 2c: Remove Link import (line 3)**

Change from:
```tsx
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
```

To:
```tsx
import { ColumnDef } from "@tanstack/react-table";
```

**Note:** The `Tooltip`, `TooltipContent`, `TooltipTrigger` imports should STAY - they're still used by header checkbox tooltips and sort button tooltips.

---

## Task 3: Update Document Type Definition

**File:** `frontend/types/documents.ts`

**Important:** Verify Phase 1 migration updated the database constraint. Existing 'completed' status documents should have been migrated to 'ocr_complete'.

**Current DocumentStatus type (line 3):**
```tsx
export type DocumentStatus = 'processing' | 'ocr_complete' | 'completed' | 'failed'
```

**New DocumentStatus type (aligned with Phase 3):**
```tsx
export type DocumentStatus = 'uploading' | 'processing' | 'ocr_complete' | 'failed'
```

**Current Document interface (lines 5-14):**
```tsx
export interface Document {
  id: string
  filename: string
  mime_type: string
  file_size_bytes: number
  file_path: string | null
  status: DocumentStatus
  uploaded_at: string
  stacks: StackSummary[]
}
```

**New Document interface:**
```tsx
export interface Document {
  id: string
  filename: string
  mime_type: string
  file_size_bytes: number
  file_path: string | null
  status: DocumentStatus
  uploaded_at: string
  stacks: StackSummary[]
  display_name: string | null    // NEW - AI-generated friendly name
  tags: string[] | null          // NEW - AI-generated tags
  summary: string | null         // NEW - AI-generated summary
}
```

**Add deprecation comment to DocumentWithExtraction (lines 16-22):**
```tsx
/**
 * @deprecated This type was used by /documents/[id] and getDocumentWithExtraction.
 * Both have been removed. Kept for potential reuse in future features.
 */
export interface DocumentWithExtraction extends Document {
  extraction_id: string | null
  extracted_fields: Record<string, unknown> | null
  confidence_scores: Record<string, number> | null
  session_id: string | null
  ocr_raw_text: string | null
}
```

---

## Task 4: Update Selected Document Context

**File:** `frontend/components/documents/selected-document-context.tsx`

**Step 4a: Add new metadata state (after line 64)**

After the extraction state declarations, add:
```tsx
// New metadata fields from documents table
const [displayName, setDisplayNameState] = useState<string | null>(null)
const [tags, setTagsState] = useState<string[] | null>(null)
const [summary, setSummaryState] = useState<string | null>(null)
```

**Step 4b: Add useCallback wrappers (after line 130)**

After `setIsLoadingExtraction`, add:
```tsx
const setDisplayName = useCallback((name: string | null) => {
  setDisplayNameState(name)
}, [])

const setTags = useCallback((newTags: string[] | null) => {
  setTagsState(newTags)
}, [])

const setSummary = useCallback((newSummary: string | null) => {
  setSummaryState(newSummary)
}, [])
```

**CRITICAL:** The `useCallback` wrappers are required. Without them, the context value changes on every render, causing infinite re-render loops.

**Step 4c: Update setSelectedDocId to clear new fields on deselect (lines 89-97)**

Add to the `if (id === null)` block:
```tsx
if (id === null) {
  setFilenameState(null)
  setFilePathState(null)
  setAssignedStacksState([])
  setFileSizeState(null)
  setPageCountState(null)
  setExtractedFieldsState(null)
  setIsLoadingExtractionState(false)
  // Clear new metadata fields
  setDisplayNameState(null)
  setTagsState(null)
  setSummaryState(null)
}
```

**Step 4d: Update SelectedDocumentContextValue interface (lines 20-45)**

Add to the interface:
```tsx
// New metadata fields
displayName: string | null
tags: string[] | null
summary: string | null
setDisplayName: (name: string | null) => void
setTags: (tags: string[] | null) => void
setSummary: (summary: string | null) => void
```

**Step 4e: Update contextValue useMemo (lines 132-164)**

Add to the context value object:
```tsx
const contextValue = useMemo(() => ({
  // ... existing fields ...
  // New metadata fields
  displayName,
  tags,
  summary,
  setDisplayName,
  setTags,
  setSummary,
}), [
  // ... existing deps ...
  displayName,
  tags,
  summary,
  setDisplayName,
  setTags,
  setSummary,
])
```

---

## Task 5: Update Preview Metadata Component

**File:** `frontend/components/preview-panel/preview-metadata.tsx`

**Replace entire file:**
```tsx
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PreviewMetadataProps {
  filename: string
  mimeType: string
  fileSize: number | null
  pageCount: number | null
  displayName: string | null
  tags: string[] | null
  summary: string | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.startsWith('image/')) return 'Image'
  return 'Document'
}

export function PreviewMetadata({
  filename,
  mimeType,
  fileSize,
  pageCount,
  displayName,
  tags,
  summary,
}: PreviewMetadataProps) {
  const fileTypeLabel = getFileTypeLabel(mimeType)
  const title = displayName || filename

  const details: string[] = [fileTypeLabel]
  if (fileSize !== null) details.push(formatFileSize(fileSize))
  if (pageCount !== null && pageCount > 1) details.push(`${pageCount} pages`)

  return (
    <div className="pr-4 py-3 shrink-0 space-y-1">
      {/* Title: display_name or filename fallback */}
      <p className="font-medium text-foreground truncate" title={title}>
        {title}
      </p>

      {/* File details */}
      <p className="text-sm text-muted-foreground">
        {details.join(' \u00B7 ')}
      </p>

      {/* Tags as badges */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Summary with truncation and hover expand */}
      {summary && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-sm text-muted-foreground italic truncate cursor-help">
              "{summary}"
            </p>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm">
            <p>{summary}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
```

**Note:** The separator uses `' \u00B7 '` (middle dot, Unicode U+00B7) not a regular period.

---

## Task 6: Update Preview Panel Props

**File:** `frontend/components/preview-panel/preview-panel.tsx`

**Step 6a: Update MetadataProps interface (lines 17-23)**

Change from:
```tsx
interface MetadataProps {
  mimeType: string;
  filename: string | null;
  fileSize: number | null;
  pageCount: number | null;
  extractedFields: Record<string, unknown> | null;
}
```

To:
```tsx
interface MetadataProps {
  mimeType: string;
  filename: string | null;
  fileSize: number | null;
  pageCount: number | null;
  displayName: string | null;
  tags: string[] | null;
  summary: string | null;
}
```

**Step 6b: Update destructuring (line 33)**

Change from:
```tsx
const { mimeType, filename, fileSize, pageCount, extractedFields } = metadata;
```

To:
```tsx
const { mimeType, filename, fileSize, pageCount, displayName, tags, summary } = metadata;
```

**Step 6c: Remove fieldCount calculation (delete lines 69-72)**

Remove:
```tsx
// Calculate field count for metadata
const fieldCount = extractedFields
  ? Object.keys(extractedFields).length
  : null;
```

**Step 6d: Update PreviewMetadata call (lines 136-142)**

Change from:
```tsx
<PreviewMetadata
  filename={filename}
  mimeType={mimeType}
  fileSize={fileSize}
  pageCount={totalPages > 0 ? totalPages : pageCount}
  fieldCount={fieldCount}
/>
```

To:
```tsx
<PreviewMetadata
  filename={filename}
  mimeType={mimeType}
  fileSize={fileSize}
  pageCount={totalPages > 0 ? totalPages : pageCount}
  displayName={displayName}
  tags={tags}
  summary={summary}
/>
```

---

## Task 7: Update Documents Layout

**File:** `frontend/app/(app)/documents/layout.tsx`

**Step 7a: Update destructuring from useSelectedDocument (lines 19-29)**

Change from:
```tsx
const {
  signedUrl,
  ocrText,
  mimeType,
  selectedDocId,
  signedUrlDocId,
  filename,
  fileSize,
  pageCount,
  extractedFields,
} = useSelectedDocument();
```

To:
```tsx
const {
  signedUrl,
  ocrText,
  mimeType,
  selectedDocId,
  signedUrlDocId,
  filename,
  fileSize,
  pageCount,
  displayName,
  tags,
  summary,
} = useSelectedDocument();
```

**Step 7b: Update metadata prop (lines 85-91)**

Change from:
```tsx
metadata={{
  mimeType,
  filename,
  fileSize,
  pageCount,
  extractedFields,
}}
```

To:
```tsx
metadata={{
  mimeType,
  filename,
  fileSize,
  pageCount,
  displayName,
  tags,
  summary,
}}
```

---

## Task 8: Update Documents Table to Set New Metadata

**Prerequisite:** Task 3 must be complete (Document type must include display_name, tags, summary).

**File:** `frontend/components/documents/documents-table.tsx`

**Step 8a: Add new setters to useSelectedDocument destructuring**

Find the useSelectedDocument destructuring (around lines 49-61) and add:
```tsx
const {
  selectedDocId,
  setSelectedDocId,
  setSignedUrl,
  setSignedUrlDocId,
  setMimeType,
  setOcrText,
  signedUrlDocId,
  setDocumentMetadata,
  setExtractedFields,
  setIsLoadingExtraction,
  setDisplayName,    // NEW
  setTags,           // NEW
  setSummary,        // NEW
} = useSelectedDocument();
```

**Step 8b: Set new metadata when document is selected**

Find the useEffect that handles document selection (around line 163). Update the block that sets metadata:

```tsx
// Set document metadata immediately from local document data
if (selectedDoc) {
  setDocumentMetadata({
    filename: selectedDoc.filename,
    filePath: selectedDoc.file_path,
    assignedStacks: selectedDoc.stacks || [],
    fileSize: selectedDoc.file_size_bytes,
    pageCount: null,
  });
  // NEW: Set metadata fields from document
  setDisplayName(selectedDoc.display_name ?? null);
  setTags(selectedDoc.tags ?? null);
  setSummary(selectedDoc.summary ?? null);
}
```

**Step 8c: Remove extraction query from fetchPreviewData**

In the `fetchPreviewData` function (around lines 180-223), remove the extractions query from `Promise.all`.

**Current code (lines 188-204):**
```tsx
// Fetch signed URL, OCR text, and extraction in parallel
const [urlResult, ocrResult, extractionResult] = await Promise.all([
  selectedDoc?.file_path
    ? supabase.storage
        .from("documents")
        .createSignedUrl(selectedDoc.file_path, 3600)
    : Promise.resolve({ data: null }),
  supabase
    .from("ocr_results")
    .select("raw_text")
    .eq("document_id", selectedDocId)
    .maybeSingle(),
  supabase
    .from("extractions")
    .select("extracted_fields")
    .eq("document_id", selectedDocId)
    .maybeSingle(),
]);
```

**New code:**
```tsx
// Fetch signed URL and OCR text in parallel (metadata comes from document)
const [urlResult, ocrResult] = await Promise.all([
  selectedDoc?.file_path
    ? supabase.storage
        .from("documents")
        .createSignedUrl(selectedDoc.file_path, 3600)
    : Promise.resolve({ data: null }),
  supabase
    .from("ocr_results")
    .select("raw_text")
    .eq("document_id", selectedDocId)
    .maybeSingle(),
]);
```

**Step 8d: Remove setExtractedFields calls**

In the success handler (around line 210), remove:
```tsx
setExtractedFields(extractionResult.data?.extracted_fields ?? null);
```

In the error handler (around line 219), remove:
```tsx
setExtractedFields(null);
```

**Step 8e: Update useEffect dependencies**

Remove `setExtractedFields` from the dependency array (around lines 230-245) since it's no longer used.

---

## Task 9: Update Page Header for Extra Breadcrumb

**File:** `frontend/components/layout/page-header.tsx`

**Step 9a: Update PageHeaderProps interface (lines 50-57)**

Add `extraBreadcrumb` prop:
```tsx
interface PageHeaderProps {
  /** Override the last breadcrumb label (defaults to formatted URL segment) */
  title?: string
  /** Icon component for the last breadcrumb (e.g., file type icon) */
  icon?: ReactNode
  /** Action buttons to render on the right side */
  actions?: ReactNode
  /** Optional extra breadcrumb to append (e.g., selected document) */
  extraBreadcrumb?: {
    label: string
    icon?: ReactNode
  }
}
```

**Step 9b: Update function signature (line 59)**

```tsx
export function PageHeader({ title, icon, actions, extraBreadcrumb }: PageHeaderProps) {
```

**Step 9c: Add extra breadcrumb rendering (after line 117, before closing `</BreadcrumbList>`)**

```tsx
{/* Extra breadcrumb for selected item (e.g., document preview) */}
{extraBreadcrumb && (
  <>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage className="flex items-center gap-1.5">
        {extraBreadcrumb.icon}
        <span className="max-w-[200px] truncate">{extraBreadcrumb.label}</span>
      </BreadcrumbPage>
    </BreadcrumbItem>
  </>
)}
```

---

## Task 10: Update Documents Header with Selected Document

**File:** `frontend/app/(app)/@header/documents/page.tsx`

**Replace entire file:**
```tsx
'use client'

import { PageHeader } from '@/components/layout/page-header'
import { PreviewToggle } from '@/components/documents/preview-toggle'
import { useSelectedDocument } from '@/components/documents/selected-document-context'
import { FileTypeIcon } from '@/components/shared/file-type-icon'

/**
 * Header slot for documents list page.
 * Shows breadcrumb with selected document name when preview is open.
 */
export default function DocumentsHeaderSlot() {
  const { selectedDocId, displayName, filename, mimeType } = useSelectedDocument()

  // Show selected document in breadcrumb when preview is open
  const extraBreadcrumb = selectedDocId
    ? {
        label: displayName || filename || 'Document',
        icon: <FileTypeIcon mimeType={mimeType || 'application/pdf'} className="size-4" />,
      }
    : undefined

  return (
    <PageHeader
      extraBreadcrumb={extraBreadcrumb}
      actions={<PreviewToggle />}
    />
  )
}
```

**Step 10b: Update default.tsx if it exists**

**File:** `frontend/app/(app)/@header/documents/default.tsx`

If this file exists and differs from page.tsx, update it to re-export:
```tsx
export { default } from './page'
```

---

## Task 11: Update Documents Query (if needed)

**File:** `frontend/lib/queries/documents.ts`

Verify that `getDocuments` selects the new columns. If it uses `*` selector, no change needed. If it has explicit column list, add:

```tsx
.select('id, filename, mime_type, file_size_bytes, file_path, status, uploaded_at, display_name, tags, summary')
```

**Also add deprecation comment to getDocumentWithExtraction:**
```tsx
/**
 * @deprecated This query was used by /documents/[id] which has been removed.
 * Kept for potential reuse in future features.
 */
export const getDocumentWithExtraction = cache(async function getDocumentWithExtraction(
```

---

## Task 12: Deprecate Extract Document Flow

### 12a. Remove from Agent Actions

**File:** `frontend/components/agent/agent-actions.tsx`

**Remove this entry from ACTION_CONFIG (if it exists):**
```tsx
'/documents/[id]': [
  {
    id: 're-extract',
    label: 'Re-extract',
    icon: Icons.Refresh,
    flow: { type: 'extract-document', documentId: '', step: 'select' },
    tooltip: 'Re-extract data from this document',
  },
],
```

**Remove route matching logic (if it exists):**
```tsx
if (pathname.startsWith('/documents/') && pathname !== '/documents') {
  return ACTION_CONFIG['/documents/[id]'] || []
}
```

### 12b. Remove from Flow Registry

**File:** `frontend/components/agent/flows/registry.ts`

**Remove import (if it exists):**
```tsx
import { extractFlowMetadata, useExtractFlow, type ExtractFlowStep } from './documents/extract'
```

**Remove registry entry (if it exists):**
```tsx
'extract-document': {
  metadata: extractFlowMetadata,
  useHook: useExtractFlow,
} as FlowRegistration<ExtractFlowStep>,
```

### 12c. Remove from AgentFlow Type

**File:** `frontend/components/agent/stores/agent-store.ts`

**Remove from AgentFlow union (if it exists):**
```tsx
| { type: 'extract-document'; documentId: string; step: string }
```

**Remove from getFlowStatusText (if it exists):**
```tsx
case 'extract-document': return 'Re-extract document'
```

### 12d. Add Deprecation Notice to Flow Files (if they exist)

**File:** `frontend/components/agent/flows/documents/extract/index.ts`

Add deprecation comment at top:
```tsx
/**
 * @deprecated This flow is deprecated as of Documents Redesign (2026-01).
 * Per-document extraction has been removed. Use Stacks for structured data extraction.
 * These files are kept for reference but not registered in the flow system.
 */
```

---

## Task 13: Deprecate Agent API Function

**File:** `frontend/lib/agent-api.ts`

Add deprecation comment to `streamAgentExtraction` function (if it exists):

```tsx
/**
 * @deprecated This function was used for per-document extraction which has been removed.
 * Use Stack-based extraction instead. The extract-document agent flow is deprecated.
 * Kept for reference but may be removed in a future cleanup.
 */
export async function streamAgentExtraction(
```

---

## Task 14: Add Deprecation Comments to Document Detail Components

**Files to add deprecation comments (if they exist):**
- `frontend/components/documents/document-detail-client.tsx`
- `frontend/components/documents/document-detail-sub-bar.tsx`
- `frontend/components/documents/document-detail-filter-context.tsx`
- `frontend/components/documents/document-detail-actions.tsx`
- `frontend/components/documents/extracted-data-table.tsx`
- `frontend/components/documents/extracted-columns.tsx`
- `frontend/components/documents/bulk-delete-fields-dialog.tsx`

Add this comment at top of each file:
```tsx
/**
 * @deprecated This component was used by /documents/[id] which has been removed.
 * Kept for potential reuse in Stack detail views or future features.
 * See: docs/plans/in-progress/documents-redesign/
 */
```

---

## Task 15: Update Documents CLAUDE.md

**File:** `frontend/components/documents/CLAUDE.md`

Update the file list to mark deprecated components:

```markdown
## Files

| File | Description |
|------|-------------|
| `documents-table.tsx` | Main table for `/documents` list (TanStack Table, row click opens preview) |
| `columns.tsx` | Column definitions for documents table (filename with display_name/tags, stacks, date) |
| `documents-filter-context.tsx` | Context for list page: search, date/stack filters, row selection sync |
| `selected-document-context.tsx` | Global context for selected doc ID, signed URL, metadata (includes display_name, tags, summary) |
| `document-detail-client.tsx` | **(deprecated)** Was used by /documents/[id] |
| `document-detail-sub-bar.tsx` | **(deprecated)** Was used by /documents/[id] |
| `document-detail-filter-context.tsx` | **(deprecated)** Was used by /documents/[id] |
| `document-detail-actions.tsx` | **(deprecated)** Was used by /documents/[id] |
| `extracted-data-table.tsx` | **(deprecated)** Was used by /documents/[id] |
| `extracted-columns.tsx` | **(deprecated)** Was used by /documents/[id] |
| `export-dropdown.tsx` | Export extraction data as CSV/JSON with download |
| `stacks-dropdown.tsx` | Assign/unassign document to stacks via picker |
| `delete-dialog.tsx` | Single document delete with AlertDialog |
| `bulk-delete-dialog.tsx` | Multi-document delete from list selection |
| `bulk-delete-fields-dialog.tsx` | **(deprecated)** Was used by /documents/[id] |
| `preview-toggle.tsx` | Toggle button for preview panel visibility |
```

---

## Task 16: Verify Build

After all changes, run:

```bash
cd frontend && npm run build
```

Expected: Build succeeds with no import errors or type errors.

**Common issues to check:**
1. Broken imports referencing deleted files
2. Type errors from removed props (fieldCount, extractedFields)
3. Missing route fallbacks (default.tsx files)
4. Badge import missing from columns.tsx or preview-metadata.tsx

---

## Task 17: Manual Testing Checklist

Test in browser after build succeeds:

- [ ] Navigate to `/documents` - page loads without errors
- [ ] Click a document row - row becomes selected, preview panel opens
- [ ] Click document name - same behavior as clicking row (no navigation)
- [ ] Document list shows display_name (or filename if null) for each document
- [ ] Document list shows first 2 tags as badges, "+N" for additional tags
- [ ] Breadcrumb shows "Documents" when no document selected
- [ ] Breadcrumb shows "Documents > [document name]" when document selected
- [ ] Breadcrumb uses display_name if available, falls back to filename
- [ ] Breadcrumb updates when clicking different documents
- [ ] Preview panel shows metadata WITHOUT "X fields" or "Not extracted"
- [ ] Preview panel shows display_name (or filename if null) as title
- [ ] Preview panel shows all tags as badges (if present)
- [ ] Preview panel shows summary with hover expand (if present)
- [ ] Try to navigate to `/documents/[any-id]` directly - should 404
- [ ] Agent card on documents page shows only "Upload" and "Create Stack" actions

---

## Summary

| Task | Action | Files |
|------|--------|-------|
| 1 | Delete | `/documents/[id]/`, `@header/documents/[id]/`, `@subbar/documents/[id]/` |
| 2 | Modify | `columns.tsx` - Link to span with display_name and tags |
| 3 | Modify | `types/documents.ts` - Update Document interface |
| 4 | Modify | `selected-document-context.tsx` - Add new metadata state |
| 5 | Modify | `preview-metadata.tsx` - Show displayName, tags, summary |
| 6 | Modify | `preview-panel.tsx` - Update MetadataProps interface |
| 7 | Modify | `documents/layout.tsx` - Pass new metadata props |
| 8 | Modify | `documents-table.tsx` - Set new metadata, remove extractions query |
| 9 | Modify | `page-header.tsx` - Add extraBreadcrumb prop |
| 10 | Modify | `@header/documents/page.tsx` - Show selected document in breadcrumb |
| 11 | Modify | `lib/queries/documents.ts` - Verify columns, deprecate old query |
| 12 | Remove | Extract flow from agent system (if exists) |
| 13 | Deprecate | `streamAgentExtraction` in agent-api.ts |
| 14 | Deprecate | Document detail components (add comments) |
| 15 | Update | `components/documents/CLAUDE.md` |
| 16 | Verify | `npm run build` |
| 17 | Test | Manual browser testing |

---

## Rollback Plan

If issues arise, revert the commit:
```bash
git revert HEAD
```

All deleted files are tracked in git and can be restored.

---

## Key Architecture Notes

### Status Values (Phase 3 Alignment)

The document status values are now:
- `uploading` - File being uploaded to storage
- `processing` - OCR running on document
- `ocr_complete` - OCR finished, metadata generated
- `failed` - Processing failed

The old `completed` status has been removed.

### Metadata Source

Document metadata (`display_name`, `tags`, `summary`) comes from the `documents` table, not a separate query. These fields are populated by the backend during the upload flow (Phase 2.1) and are available immediately when the document is selected from the list.

### No Separate Extraction View

Per-document extraction has been removed. Structured data extraction now happens at the Stack level. The preview panel shows document metadata (AI-generated summary of the document), not extraction results.

### Breadcrumb Enhancement

When a document is selected in the list, the header breadcrumb shows "Documents > [document name]" to provide context about what is being previewed. This replaces the UX previously provided by the `/documents/[id]` route.
