'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import { StackPickerSub } from '@/components/shared/stack-picker-sub'
import { useSupabase } from '@/hooks/use-supabase'

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
  const router = useRouter()
  const supabase = useSupabase()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  if (selectedCount === 0) return null

  const handleAddToStack = async (stackId: string, stackName: string) => {
    try {
      // Upsert all selected documents to the stack (ignore duplicates)
      const { error } = await supabase.from('stack_documents').upsert(
        selectedIds.map((documentId) => ({
          document_id: documentId,
          stack_id: stackId,
        })),
        { onConflict: 'document_id,stack_id', ignoreDuplicates: true }
      )

      if (error) throw error

      toast.success(
        `Added ${selectedCount} ${selectedCount === 1 ? 'document' : 'documents'} to "${stackName}"`
      )
      onClearSelection()
      router.refresh()
    } catch (error) {
      console.error('Failed to add documents to stack:', error)
      toast.error('Failed to add documents to stack')
    }
  }

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
            <StackPickerSub onSelectStack={handleAddToStack} />
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
    </>
  )
}
