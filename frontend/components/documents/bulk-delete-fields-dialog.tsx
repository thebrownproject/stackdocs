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
