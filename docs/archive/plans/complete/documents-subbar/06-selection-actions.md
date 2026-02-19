# Phase 6: Selection Actions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable bulk delete for selected documents in the documents list.

**Architecture:** Context tracks selectedIds + a registered callback to reset table selection. SelectionActions triggers BulkDeleteDialog, which calls clearSelection on complete. Bidirectional sync: table → context (selection changes), context → table (clear after delete).

**Tech Stack:** React Context, shadcn/ui AlertDialog, Supabase JS, Sonner toast

---

## Task 15: Create Bulk Delete Dialog

**Files:**
- Create: `frontend/components/documents/bulk-delete-dialog.tsx`

**Step 1: Create dialog for bulk document deletion**

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

interface BulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentIds: string[]
  onComplete: () => void
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  documentIds,
  onComplete,
}: BulkDeleteDialogProps) {
  const supabase = useSupabase()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const count = documentIds.length

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      // Step 1: Get file paths before deletion
      const { data: docs, error: fetchError } = await supabase
        .from('documents')
        .select('id, file_path')
        .in('id', documentIds)

      if (fetchError) throw fetchError

      // Step 2: Delete from database (cascades to related tables)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .in('id', documentIds)

      if (deleteError) throw deleteError

      // Step 3: Delete from storage (best effort)
      const filePaths = (docs || [])
        .map(d => d.file_path)
        .filter((p): p is string => p !== null)

      if (filePaths.length > 0) {
        const { error: storageError } = await supabase
          .storage
          .from('documents')
          .remove(filePaths)

        if (storageError) {
          console.error('Storage cleanup failed:', storageError)
        }
      }

      toast.success(`${count} document${count === 1 ? '' : 's'} deleted`)
      onOpenChange(false)
      onComplete()
      router.refresh()
    } catch (error) {
      console.error('Bulk delete failed:', error)
      toast.error('Failed to delete documents')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {count} document{count === 1 ? '' : 's'}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the selected document{count === 1 ? '' : 's'} and all extracted data.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault()  // Prevent default close - we control via onOpenChange
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

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/components/documents/bulk-delete-dialog.tsx
git commit -m "feat: add bulk delete dialog for multiple documents"
```

---

## Task 15: Wire Up SelectionActions in Documents List

**Files:**
- Modify: `frontend/components/documents/documents-filter-context.tsx`
- Modify: `frontend/components/layout/selection-actions.tsx`
- Modify: `frontend/app/(app)/@subbar/documents/page.tsx`

**Step 1: Update DocumentsFilterContext with selectedIds and bidirectional sync**

Replace `selectedCount` with `selectedIds` (derive count from length). Add callback registration for table to provide its `setRowSelection` function, enabling context to clear table selection.

> **Note:** The `RowSelectionState` type is NOT needed in this file - we only store `string[]` IDs.
> The type is only used in the table component.

```tsx
'use client'

import { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from 'react'

/**
 * Context for sharing filter and selection state between
 * the DocumentsSubBar (parallel route) and DocumentsTable (page).
 *
 * Bidirectional selection sync:
 * - Table → Context: Table calls setSelectedIds when selection changes
 * - Context → Table: clearSelection calls registered resetRowSelection callback
 */
interface DocumentsFilterContextValue {
  // Search filter for filename column
  filterValue: string
  setFilterValue: (value: string) => void
  // Selection state (IDs stored, count derived)
  selectedIds: string[]
  selectedCount: number  // Derived from selectedIds.length
  setSelectedIds: (ids: string[]) => void
  // Table registers its setRowSelection so context can clear it
  registerResetRowSelection: (reset: () => void) => void
  // Clears both context state AND table rowSelection
  clearSelection: () => void
}

const DocumentsFilterContext = createContext<DocumentsFilterContextValue | null>(null)

export function DocumentsFilterProvider({ children }: { children: ReactNode }) {
  const [filterValue, setFilterValueState] = useState('')
  const [selectedIds, setSelectedIdsState] = useState<string[]>([])

  // Ref to hold the table's reset function (avoids re-renders)
  const resetRowSelectionRef = useRef<(() => void) | null>(null)

  const setFilterValue = useCallback((value: string) => {
    setFilterValueState(value)
  }, [])

  const setSelectedIds = useCallback((ids: string[]) => {
    setSelectedIdsState(ids)
  }, [])

  const registerResetRowSelection = useCallback((reset: () => void) => {
    resetRowSelectionRef.current = reset
  }, [])

  const clearSelection = useCallback(() => {
    // Clear context state
    setSelectedIdsState([])
    // Clear table's rowSelection state via registered callback
    if (resetRowSelectionRef.current) {
      resetRowSelectionRef.current()
    }
  }, [])

  // Derive selectedCount from selectedIds
  const selectedCount = selectedIds.length

  const contextValue = useMemo(() => ({
    filterValue,
    setFilterValue,
    selectedIds,
    selectedCount,
    setSelectedIds,
    registerResetRowSelection,
    clearSelection,
  }), [filterValue, setFilterValue, selectedIds, selectedCount, setSelectedIds, registerResetRowSelection, clearSelection])

  return (
    <DocumentsFilterContext.Provider value={contextValue}>
      {children}
    </DocumentsFilterContext.Provider>
  )
}

export function useDocumentsFilter() {
  const context = useContext(DocumentsFilterContext)
  if (!context) {
    throw new Error('useDocumentsFilter must be used within DocumentsFilterProvider')
  }
  return context
}
```

**Step 2: Update SelectionActions to enable Delete**

**Breaking Change:** The `SelectionActionsProps` interface changes:
- `onDelete?: () => void` is REMOVED (delete is now handled internally via BulkDeleteDialog)
- `selectedIds: string[]` is ADDED (required for delete operation)
- `onClearSelection: () => void` is ADDED (required to clear selection after delete)

Remove `disabled` from Delete menu item, add state for dialog:

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

interface SelectionActionsProps {
  selectedCount: number
  selectedIds: string[]
  onClearSelection: () => void
  onAddToStack?: () => void  // PLACEHOLDER: Not implemented yet (see Deferred Work in main plan)
}

export function SelectionActions({
  selectedCount,
  selectedIds,
  onClearSelection,
  onAddToStack,
}: SelectionActionsProps) {
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
            <TooltipContent side="bottom">Bulk operations</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
            {/* Add to Stack: disabled placeholder - see Deferred Work in main plan */}
            <DropdownMenuItem onClick={onAddToStack} disabled>
              <Icons.FolderPlus className="mr-2 size-4" />
              Add to Stack
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Icons.Trash className="mr-2 size-4" />
              Delete
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
    </>
  )
}
```

**Step 3: Update DocumentsSubBar to pass selectedIds**

```tsx
const { filterValue, setFilterValue, selectedCount, selectedIds, clearSelection } = useDocumentsFilter()

<SelectionActions
  selectedCount={selectedCount}
  selectedIds={selectedIds}
  onClearSelection={clearSelection}
/>
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/components/documents/documents-filter-context.tsx frontend/components/layout/selection-actions.tsx frontend/app/(app)/@subbar/documents/page.tsx
git commit -m "feat: enable bulk delete in selection actions with bidirectional sync"
```

---

## Task 15: Sync Table Selection with Context

**Files:**
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Register reset callback and sync selection to context**

The table registers its reset function with context on mount, and syncs selected IDs whenever selection changes. Key points:
- Derive values outside useEffect (don't include `table` in dependencies - it's recreated each render)
- Use `setRowSelection` wrapped in a callback for the registration
- Remove the old `setSelectedCount` call (now derived from `selectedIds.length`)

```tsx
// Get context functions
const { filterValue, setSelectedIds, registerResetRowSelection } = useDocumentsFilter()

// Register the reset callback on mount
React.useEffect(() => {
  registerResetRowSelection(() => setRowSelection({}))
}, [registerResetRowSelection])

// Derive selected IDs outside the effect (stable reference pattern)
const selectedRows = table.getFilteredSelectedRowModel().rows
const selectedIdsList = React.useMemo(
  () => selectedRows.map(row => row.original.id),
  [selectedRows]
)

// Sync selection to context when it changes
React.useEffect(() => {
  setSelectedIds(selectedIdsList)
}, [selectedIdsList, setSelectedIds])
```

**Step 2: Remove old setSelectedCount effect**

Delete this existing code (no longer needed - count is derived):

```tsx
// DELETE THIS:
const tableSelectedCount = table.getFilteredSelectedRowModel().rows.length
React.useEffect(() => {
  setSelectedCount(tableSelectedCount)
}, [tableSelectedCount, setSelectedCount])
```

**Step 3: Update context destructuring**

Change from:
```tsx
const { filterValue, setSelectedCount } = useDocumentsFilter()
```

To:
```tsx
const { filterValue, setSelectedIds, registerResetRowSelection } = useDocumentsFilter()
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/components/documents/documents-table.tsx
git commit -m "feat: sync table selection with context using bidirectional callback pattern"
```
