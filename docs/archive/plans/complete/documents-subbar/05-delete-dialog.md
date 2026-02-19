# Phase 5: Delete Dialog

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add delete confirmation dialog for single document deletion.

**Architecture:** AlertDialog with Supabase delete operation (DB + Storage).

**Tech Stack:** shadcn/ui AlertDialog, Supabase JS, Sonner toast

---

## Task 12: Create Delete Dialog Component

**Files:**
- Create: `frontend/components/documents/delete-dialog.tsx`

**Step 1: Create the delete confirmation dialog**

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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ActionButton } from '@/components/layout/action-button'
import * as Icons from '@/components/icons'

interface DeleteDialogProps {
  documentId: string
  filename: string
  filePath: string | null
}

export function DeleteDialog({ documentId, filename, filePath }: DeleteDialogProps) {
  const supabase = useSupabase()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      // Step 1: Delete from database (cascades to related tables)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (deleteError) throw deleteError

      // Step 2: Delete from storage (best effort)
      if (filePath) {
        const { error: storageError } = await supabase
          .storage
          .from('documents')
          .remove([filePath])

        if (storageError) {
          console.error('Storage cleanup failed:', storageError)
          // Don't throw - DB deletion succeeded
        }
      }

      toast.success('Document deleted')
      setOpen(false)
      router.push('/documents')
      router.refresh()
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete document')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <ActionButton icon={<Icons.Trash />} tooltip="Delete document">
          Delete
        </ActionButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete document?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{filename}</strong> and all its extracted data.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault()  // Prevent default close - we control via setOpen
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
git add frontend/components/documents/delete-dialog.tsx
git commit -m "feat: add delete confirmation dialog with Supabase operations"
```

---

## Task 12: Wire Up Delete in Document Detail Actions

**Files:**
- Modify: `frontend/components/documents/document-detail-actions.tsx`

> **Note:** The server component and SubBar props were already updated in Task 9 (Phase 4) with
> the UNIFIED interface that includes all fields needed for Stack toggle, Export, AND Delete.
> This task only adds the DeleteDialog to DocumentDetailActions.

**Step 1: Add DeleteDialog to DocumentDetailActions**

Update the component from Task 9 to include DeleteDialog:

```tsx
// frontend/components/documents/document-detail-actions.tsx
'use client'

import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { ExportDropdown } from '@/components/documents/export-dropdown'
import { DeleteDialog } from '@/components/documents/delete-dialog'
import { ActionButton } from '@/components/layout/action-button'
import * as Icons from '@/components/icons'
import type { StackSummary } from '@/types/stacks'

// UNIFIED interface (defined in Task 9) - includes all props for all actions
interface DocumentDetailActionsProps {
  documentId: string                              // For Delete, Stack toggle
  filename: string                                // For Export, Delete
  filePath: string | null                         // For Delete (storage cleanup)
  extractedFields: Record<string, unknown> | null // For Export
  assignedStacks: StackSummary[]                  // For Stack toggle
  allStacks: StackSummary[]                       // For Stack toggle
}

export function DocumentDetailActions({
  documentId,
  filename,
  filePath,
  extractedFields,
  assignedStacks,
  allStacks,
}: DocumentDetailActionsProps) {
  return (
    <>
      <StacksDropdown
        documentId={documentId}
        assignedStacks={assignedStacks}
        allStacks={allStacks}
      />
      <ActionButton icon={<Icons.Edit />} tooltip="Edit document and extractions">
        Edit
      </ActionButton>
      <ExportDropdown filename={filename} extractedFields={extractedFields} />
      <DeleteDialog documentId={documentId} filename={filename} filePath={filePath} />
    </>
  )
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/app/(app)/@subbar/documents/[id]/page.tsx frontend/components/documents/document-detail-sub-bar.tsx frontend/components/documents/document-detail-actions.tsx
git commit -m "feat: wire up delete dialog in document detail"
```
