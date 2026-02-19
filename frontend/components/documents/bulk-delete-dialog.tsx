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
