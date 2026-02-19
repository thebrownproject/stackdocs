# Phase 7: Selection & Preview Actions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve selection actions and preview panel UX across documents pages.

**Architecture:**
- Field deletion on document detail follows similar pattern to bulk document delete, but updates extraction JSON in `extractions` table
- Document detail `SelectionActions` is repurposed for field-specific operations (no Add to Stack)
- Documents list `SelectionActions` gets working Add to Stack via stack picker dialog
- Preview panel gets action buttons matching document detail subbar pattern

**Tech Stack:** React Context, shadcn/ui AlertDialog/Dialog, Supabase JS, Sonner toast

---

## Task 17: Field Deletion on Document Detail

**Files:**
- Create: `frontend/components/documents/bulk-delete-fields-dialog.tsx`
- Modify: `frontend/components/documents/document-detail-filter-context.tsx`
- Modify: `frontend/components/documents/extracted-data-table.tsx`
- Modify: `frontend/components/documents/document-detail-sub-bar.tsx`

**Step 1: Update DocumentDetailFilterContext with selectedFieldIds**

Upgrade context from just storing count to storing field IDs (like documents-filter-context). This enables the delete operation to know which fields to remove.

```tsx
'use client'

import { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from 'react'

/**
 * Context for sharing filter and selection state between
 * the DocumentDetailSubBar (parallel route) and ExtractedDataTable (page).
 *
 * Bidirectional selection sync:
 * - Table -> Context: Table calls setSelectedFieldIds when selection changes
 * - Context -> Table: clearFieldSelection calls registered resetRowSelection callback
 */
interface DocumentDetailFilterContextValue {
  // Search filter for field names
  fieldSearch: string
  setFieldSearch: (value: string) => void
  // Selection state (IDs stored, count derived)
  selectedFieldIds: string[]
  selectedFieldCount: number  // Derived from selectedFieldIds.length
  setSelectedFieldIds: (ids: string[]) => void
  // Table registers its setRowSelection so context can clear it
  registerResetRowSelection: (reset: () => void) => void
  // Clears both context state AND table rowSelection
  clearFieldSelection: () => void
}

const DocumentDetailFilterContext = createContext<DocumentDetailFilterContextValue | null>(null)

export function DocumentDetailFilterProvider({ children }: { children: ReactNode }) {
  const [fieldSearch, setFieldSearchState] = useState('')
  const [selectedFieldIds, setSelectedFieldIdsState] = useState<string[]>([])

  // Ref to hold the table's reset function (avoids re-renders)
  const resetRowSelectionRef = useRef<(() => void) | null>(null)

  const setFieldSearch = useCallback((value: string) => {
    setFieldSearchState(value)
  }, [])

  const setSelectedFieldIds = useCallback((ids: string[]) => {
    setSelectedFieldIdsState(ids)
  }, [])

  const registerResetRowSelection = useCallback((reset: () => void) => {
    resetRowSelectionRef.current = reset
  }, [])

  const clearFieldSelection = useCallback(() => {
    // Clear context state
    setSelectedFieldIdsState([])
    // Clear table's rowSelection state via registered callback
    if (resetRowSelectionRef.current) {
      resetRowSelectionRef.current()
    }
  }, [])

  // Derive selectedFieldCount from selectedFieldIds
  const selectedFieldCount = selectedFieldIds.length

  const contextValue = useMemo(() => ({
    fieldSearch,
    setFieldSearch,
    selectedFieldIds,
    selectedFieldCount,
    setSelectedFieldIds,
    registerResetRowSelection,
    clearFieldSelection,
  }), [fieldSearch, setFieldSearch, selectedFieldIds, selectedFieldCount, setSelectedFieldIds, registerResetRowSelection, clearFieldSelection])

  return (
    <DocumentDetailFilterContext.Provider value={contextValue}>
      {children}
    </DocumentDetailFilterContext.Provider>
  )
}

export function useDocumentDetailFilter() {
  const context = useContext(DocumentDetailFilterContext)
  if (!context) {
    throw new Error('useDocumentDetailFilter must be used within DocumentDetailFilterProvider')
  }
  return context
}
```

**Step 2: Create BulkDeleteFieldsDialog**

This dialog removes selected fields from the extraction JSON.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSupabase } from '@/hooks/use-supabase'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface BulkDeleteFieldsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
  fieldIds: string[]  // Field paths like "vendor_name", "line_items.0.description"
  extractedFields: Record<string, unknown> | null
  onComplete: () => void
}

export function BulkDeleteFieldsDialog({
  open,
  onOpenChange,
  documentId,
  fieldIds,
  extractedFields,
  onComplete,
}: BulkDeleteFieldsDialogProps) {
  const supabase = useSupabase()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const count = fieldIds.length

  const handleDelete = async () => {
    if (!extractedFields) return

    setIsDeleting(true)

    try {
      // Create a deep copy of the extracted fields
      const updatedFields = JSON.parse(JSON.stringify(extractedFields))

      // Remove each selected field
      // Field IDs are either simple keys like "vendor_name" or nested paths like "line_items"
      // For now, handle top-level fields (nested field deletion is complex)
      for (const fieldId of fieldIds) {
        // Extract the root field name (before any "-" used for row identification)
        const rootField = fieldId.split('-')[0]
        if (rootField in updatedFields) {
          delete updatedFields[rootField]
        }
      }

      // Update the extraction in database
      const { error } = await supabase
        .from('extractions')
        .update({ extracted_fields: updatedFields })
        .eq('document_id', documentId)

      if (error) throw error

      toast.success(`${count} field${count === 1 ? '' : 's'} deleted`)
      onOpenChange(false)
      onComplete()
      router.refresh()
    } catch (error) {
      console.error('Field deletion failed:', error)
      toast.error('Failed to delete fields')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {count} field{count === 1 ? '' : 's'}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the selected field{count === 1 ? '' : 's'} from the extracted data.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault()
              await handleDelete()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Step 3: Update ExtractedDataTable to sync with context**

Add bidirectional selection sync (register reset callback, sync selected IDs to context).

In `extracted-data-table.tsx`, update imports and add sync logic:

```tsx
// Add to imports
import { useDocumentDetailFilter } from '@/components/documents/document-detail-filter-context'

// Replace onSelectionChange prop with context usage
// Inside the component:
const { setSelectedFieldIds, registerResetRowSelection } = useDocumentDetailFilter()

// Register the reset callback on mount
React.useEffect(() => {
  registerResetRowSelection(() => setRowSelection({}))
}, [registerResetRowSelection])

// Sync selection to context when it changes
React.useEffect(() => {
  const selectedIds = Object.keys(rowSelection).filter(key => rowSelection[key])
  setSelectedFieldIds(selectedIds)
}, [rowSelection, setSelectedFieldIds])
```

Remove the `onSelectionChange` prop and its usage since context handles this now.

**Step 4: Update DocumentDetailSubBar to wire up field delete**

Pass necessary data to enable field deletion:

```tsx
// In document-detail-sub-bar.tsx, update to use new context shape and pass data for field delete
const {
  fieldSearch,
  setFieldSearch,
  selectedFieldCount,
  selectedFieldIds,
  clearFieldSelection
} = useDocumentDetailFilter()

// Create a FieldSelectionActions component or inline the logic
// Show delete option only (no Add to Stack for fields)
```

**Step 5: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add frontend/components/documents/bulk-delete-fields-dialog.tsx frontend/components/documents/document-detail-filter-context.tsx frontend/components/documents/extracted-data-table.tsx frontend/components/documents/document-detail-sub-bar.tsx
git commit -m "feat: add field deletion for document detail selection"
```

---

## Task 18: Clean Up Document Detail SelectionActions

**Files:**
- Create: `frontend/components/documents/field-selection-actions.tsx`
- Modify: `frontend/components/documents/document-detail-sub-bar.tsx`

**Step 1: Create FieldSelectionActions component**

This is a simpler version of SelectionActions specifically for field selection - only shows Delete, not Add to Stack.

```tsx
'use client'

import { useState } from 'react'
import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BulkDeleteFieldsDialog } from '@/components/documents/bulk-delete-fields-dialog'

interface FieldSelectionActionsProps {
  selectedCount: number
  selectedIds: string[]
  documentId: string
  extractedFields: Record<string, unknown> | null
  onClearSelection: () => void
}

export function FieldSelectionActions({
  selectedCount,
  selectedIds,
  documentId,
  extractedFields,
  onClearSelection,
}: FieldSelectionActionsProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  if (selectedCount === 0) return null

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {selectedCount} selected
        </span>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <ActionButton icon={<Icons.ChevronDown />}>
                  Actions
                </ActionButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Field operations</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="gap-2"
            >
              <Icons.Trash className="size-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <BulkDeleteFieldsDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        documentId={documentId}
        fieldIds={selectedIds}
        extractedFields={extractedFields}
        onComplete={onClearSelection}
      />
    </>
  )
}
```

**Step 2: Update DocumentDetailSubBar to use FieldSelectionActions**

Replace `SelectionActions` import with `FieldSelectionActions`:

```tsx
// In document-detail-sub-bar.tsx
import { FieldSelectionActions } from '@/components/documents/field-selection-actions'

// ... in the component:
const {
  fieldSearch,
  setFieldSearch,
  selectedFieldCount,
  selectedFieldIds,
  clearFieldSelection
} = useDocumentDetailFilter()

// Replace SelectionActions with FieldSelectionActions
<FieldSelectionActions
  selectedCount={selectedFieldCount}
  selectedIds={selectedFieldIds}
  documentId={documentId}
  extractedFields={extractedFields}
  onClearSelection={clearFieldSelection}
/>
```

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/components/documents/field-selection-actions.tsx frontend/components/documents/document-detail-sub-bar.tsx
git commit -m "feat: create FieldSelectionActions for document detail (delete only)"
```

---

## Task 19: Add to Stack for Documents List

**Files:**
- Create: `frontend/components/documents/stack-picker-dialog.tsx`
- Modify: `frontend/components/layout/selection-actions.tsx`

**Step 1: Create StackPickerDialog component**

A dialog that lets users select a stack to add documents to. Follows patterns from `stacks-dropdown.tsx`.

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useStacks } from '@/hooks/use-stacks'
import { useSupabase } from '@/hooks/use-supabase'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'

interface StackPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentIds: string[]
  onComplete: () => void
}

export function StackPickerDialog({
  open,
  onOpenChange,
  documentIds,
  onComplete,
}: StackPickerDialogProps) {
  const router = useRouter()
  const supabase = useSupabase()
  const { stacks, loading } = useStacks()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const documentCount = documentIds.length

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchTerm('')
      setSelectedStackId(null)
      // Focus search input after dialog opens
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Filter stacks by search term
  const filteredStacks = stacks.filter((stack) =>
    stack.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddToStack = async () => {
    if (!selectedStackId) return

    setIsAdding(true)

    try {
      const selectedStack = stacks.find((s) => s.id === selectedStackId)

      // Create junction table entries for all selected documents
      // Use upsert to avoid errors if already assigned
      const entries = documentIds.map((docId) => ({
        document_id: docId,
        stack_id: selectedStackId,
      }))

      const { error } = await supabase
        .from('stack_documents')
        .upsert(entries, { onConflict: 'document_id,stack_id' })

      if (error) throw error

      toast.success(
        `Added ${documentCount} document${documentCount === 1 ? '' : 's'} to "${selectedStack?.name}"`
      )
      onOpenChange(false)
      onComplete()
      router.refresh()
    } catch (error) {
      console.error('Add to stack failed:', error)
      toast.error('Failed to add documents to stack')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Stack</DialogTitle>
          <DialogDescription>
            Select a stack to add {documentCount} document{documentCount === 1 ? '' : 's'} to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <Input
            ref={inputRef}
            placeholder="Search stacks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* Stack list */}
          <ScrollArea className="h-[200px] rounded-md border">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Icons.Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredStacks.length > 0 ? (
              <div className="p-2 space-y-1">
                {filteredStacks.map((stack) => (
                  <button
                    key={stack.id}
                    onClick={() => setSelectedStackId(stack.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                      'hover:bg-muted/50',
                      selectedStackId === stack.id && 'bg-muted'
                    )}
                  >
                    <Icons.Stack className="size-4 text-muted-foreground" />
                    <span className="flex-1 text-left">{stack.name}</span>
                    {selectedStackId === stack.id && (
                      <Icons.Check className="size-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            ) : searchTerm ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">No matching stacks</p>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">No stacks available</p>
              </div>
            )}
          </ScrollArea>

          {/* Action buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddToStack}
              disabled={!selectedStackId || isAdding}
            >
              {isAdding ? 'Adding...' : 'Add to Stack'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Wire up Add to Stack in SelectionActions**

Update `selection-actions.tsx` to enable the Add to Stack menu item:

```tsx
'use client'

import { useState } from 'react'
import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BulkDeleteDialog } from '@/components/documents/bulk-delete-dialog'
import { StackPickerDialog } from '@/components/documents/stack-picker-dialog'

interface SelectionActionsProps {
  selectedCount: number
  selectedIds: string[]
  onClearSelection: () => void
}

export function SelectionActions({
  selectedCount,
  selectedIds,
  onClearSelection,
}: SelectionActionsProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [stackPickerOpen, setStackPickerOpen] = useState(false)

  if (selectedCount === 0) return null

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {selectedCount} selected
        </span>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <ActionButton icon={<Icons.ChevronDown />}>
                  Actions
                </ActionButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bulk operations</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem
              onClick={() => setStackPickerOpen(true)}
              className="gap-2"
            >
              <Icons.FolderPlus className="size-4" />
              <span>Add to Stack</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              disabled={selectedIds.length === 0}
              className="gap-2"
            >
              <Icons.Trash className="size-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <BulkDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        documentIds={selectedIds}
        onComplete={onClearSelection}
      />

      <StackPickerDialog
        open={stackPickerOpen}
        onOpenChange={setStackPickerOpen}
        documentIds={selectedIds}
        onComplete={onClearSelection}
      />
    </>
  )
}
```

**Step 3: Remove onAddToStack prop**

The `onAddToStack` prop is no longer needed since dialog is handled internally.

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/components/documents/stack-picker-dialog.tsx frontend/components/layout/selection-actions.tsx
git commit -m "feat: enable Add to Stack for bulk document selection"
```

---

## Task 20: Document Preview Panel Actions

**Files:**
- Create: `frontend/components/documents/preview-panel-actions.tsx`
- Modify: `frontend/components/documents/preview-panel.tsx`

**Step 1: Create PreviewPanelActions component**

Actions shown when previewing a document from the list. Matches document detail subbar actions.

```tsx
'use client'

import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { ExportDropdown } from '@/components/documents/export-dropdown'
import { DeleteDialog } from '@/components/documents/delete-dialog'
import { ActionButton } from '@/components/layout/action-button'
import * as Icons from '@/components/icons'
import type { StackSummary } from '@/types/stacks'

interface PreviewPanelActionsProps {
  documentId: string
  assignedStacks: StackSummary[]
  filename: string
  extractedFields: Record<string, unknown> | null
  filePath: string | null
}

export function PreviewPanelActions({
  documentId,
  assignedStacks,
  filename,
  extractedFields,
  filePath,
}: PreviewPanelActionsProps) {
  return (
    <div className="flex items-center gap-1">
      <StacksDropdown documentId={documentId} assignedStacks={assignedStacks} />
      <ActionButton icon={<Icons.Edit />} tooltip="Edit document and extractions">
        Edit
      </ActionButton>
      <ExportDropdown filename={filename} extractedFields={extractedFields} />
      <DeleteDialog documentId={documentId} filename={filename} filePath={filePath} />
    </div>
  )
}
```

**Step 2: Update PreviewPanel to accept and render actions**

The `PreviewPanel` component needs to receive document data and display actions in its header.

First, check the current context/props structure. The preview panel may need additional props passed from parent, or data can be fetched via context.

Update `preview-panel.tsx`:

```tsx
// Add props for document data
interface PreviewPanelProps {
  pdfUrl: string | null
  ocrText: string | null
  mimeType: string
  // New props for actions
  documentId?: string
  assignedStacks?: StackSummary[]
  filename?: string
  extractedFields?: Record<string, unknown> | null
  filePath?: string | null
  isLoadingExtraction?: boolean  // For Export button loading state
}

// In the header area, add actions if document data is provided:
<div className="flex h-[40.5px] shrink-0 items-center px-4 border-b justify-between">
  <TabsList className="h-7 p-0.5 bg-muted/50">
    {/* ... existing tabs ... */}
  </TabsList>

  {documentId && (
    <PreviewPanelActions
      documentId={documentId}
      assignedStacks={assignedStacks || []}
      filename={filename || ''}
      extractedFields={extractedFields || null}
      filePath={filePath || null}
    />
  )}
</div>
```

**Step 3: Expand SelectedDocumentContext for document metadata**

The `SelectedDocumentContext` already tracks `selectedDocId`, `signedUrl`, `mimeType`, `ocrText`. Expand it to include document metadata needed for preview actions.

**Files:**
- Modify: `frontend/components/documents/selected-document-context.tsx`
- Modify: `frontend/components/documents/documents-table.tsx`
- Modify: `frontend/app/(app)/documents/layout.tsx`

**3a. Add types and new fields to SelectedDocumentContext:**

```tsx
// New type for batched metadata
interface DocumentMetadata {
  filename: string
  filePath: string | null
  assignedStacks: Array<{ id: string; name: string }>
  extractedFields: Record<string, unknown> | null
}

interface SelectedDocumentContextValue {
  // Existing fields...
  selectedDocId: string | null
  signedUrl: string | null
  mimeType: string
  ocrText: string | null

  // New fields for preview actions
  filename: string | null
  filePath: string | null
  assignedStacks: Array<{ id: string; name: string }> | null
  extractedFields: Record<string, unknown> | null  // Fetched async, initially null
  isLoadingExtraction: boolean  // Distinguish "loading" from "no extraction"

  // Batched setter (reduces re-renders vs 4 separate setters)
  setDocumentMetadata: (metadata: DocumentMetadata) => void
  setExtractedFields: (fields: Record<string, unknown> | null) => void
  setIsLoadingExtraction: (loading: boolean) => void
}
```

**3b. Update documents-table.tsx row click handler:**

When a row is clicked, set available metadata immediately, then fetch extraction in parallel with signed URL:

```tsx
const handleRowClick = async (row: Row<Document>) => {
  const doc = row.original

  // Immediate: set ID and available metadata (from Document type)
  setSelectedDocId(doc.id)
  setDocumentMetadata({
    filename: doc.filename,
    filePath: doc.file_path,
    assignedStacks: doc.stacks,
    extractedFields: null, // Will be fetched async
  })
  setIsLoadingExtraction(true)

  // Parallel fetches (no extra latency)
  const [urlResult, extractionResult] = await Promise.all([
    fetchSignedUrl(doc.id, doc.file_path),  // Existing
    fetchExtraction(doc.id),                 // New helper
  ])

  setSignedUrl(urlResult)
  setExtractedFields(extractionResult)
  setIsLoadingExtraction(false)
}

// New helper function for client-side extraction fetch
async function fetchExtraction(documentId: string): Promise<Record<string, unknown> | null> {
  const supabase = await createClerkSupabaseClient(getToken)
  const { data } = await supabase
    .from('extractions')
    .select('extracted_fields')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.extracted_fields ?? null
}
```

**3c. Update documents/layout.tsx to pass context data to PreviewPanel:**

```tsx
// Read from context
const {
  signedUrl, ocrText, mimeType, selectedDocId, signedUrlDocId,
  filename, filePath, assignedStacks, extractedFields, isLoadingExtraction
} = useSelectedDocument()

// Pass to PreviewPanel
<PreviewPanel
  pdfUrl={effectivePdfUrl}
  ocrText={effectiveOcrText}
  mimeType={mimeType}
  documentId={selectedDocId ?? undefined}
  filename={filename ?? undefined}
  filePath={filePath}
  assignedStacks={assignedStacks ?? undefined}
  extractedFields={extractedFields}
  isLoadingExtraction={isLoadingExtraction}
/>
```

**3d. Update PreviewPanel to handle loading state:**

```tsx
// In PreviewPanelActions, disable Export while loading
<ExportDropdown
  filename={filename}
  extractedFields={extractedFields}
  disabled={isLoadingExtraction}
/>
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/components/documents/preview-panel-actions.tsx frontend/components/documents/preview-panel.tsx
git commit -m "feat: add action buttons to document preview panel"
```

---

## Task 21: Remove Upload Button from Documents Page

**Files:**
- Modify: `frontend/app/(app)/@subbar/documents/page.tsx`

**Step 1: Remove Upload ActionButton**

The Upload button is already in the sidebar (always accessible), so it's redundant in the documents subbar. Remove it.

```tsx
// In documents/page.tsx, remove:
import { useAgentStore, initialUploadData } from '@/components/agent'

// Remove the openFlow line:
const openFlow = useAgentStore((state) => state.openFlow)

// Remove the ActionButton from the right side:
<ActionButton
  icon={<Icons.Upload />}
  onClick={() => openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })}
>
  Upload
</ActionButton>
```

The final `right` prop should just be:

```tsx
right={
  <SelectionActions
    selectedCount={selectedCount}
    selectedIds={selectedIds}
    onClearSelection={clearSelection}
  />
}
```

**Step 2: Clean up unused imports**

Remove `useAgentStore` and `initialUploadData` imports if no longer used.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/app/(app)/@subbar/documents/page.tsx
git commit -m "refactor: remove redundant Upload button from documents subbar"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 17 | Field deletion on document detail | `bulk-delete-fields-dialog.tsx`, context, table, subbar |
| 18 | Create FieldSelectionActions (no Add to Stack) | `field-selection-actions.tsx`, subbar |
| 19 | Add to Stack for documents list | `stack-picker-dialog.tsx`, `selection-actions.tsx` |
| 20 | Preview panel action buttons | `preview-panel-actions.tsx`, `preview-panel.tsx` |
| 21 | Remove Upload button from documents subbar | `@subbar/documents/page.tsx` |
