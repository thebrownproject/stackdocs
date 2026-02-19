'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import { useSupabase } from '@/hooks/use-supabase'

interface DeleteDialogProps {
  documentId: string
  filename: string
  filePath: string | null
}

export function DeleteDialog({ documentId, filename, filePath }: DeleteDialogProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const supabase = useSupabase()

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    setIsDeleting(true)

    try {
      // Delete from documents table (cascades to related tables)
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (dbError) {
        throw dbError
      }

      // Delete from storage bucket (best effort - log error but don't fail)
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([filePath])

        if (storageError) {
          console.error('Failed to delete file from storage:', storageError)
        }
      }

      toast.success('Document deleted')
      setOpen(false)
      router.push('/documents')
      router.refresh()
    } catch (error) {
      console.error('Failed to delete document:', error)
      toast.error('Failed to delete document')
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
          <AlertDialogTitle>Delete &ldquo;{filename}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this document and all its extracted
            data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
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
