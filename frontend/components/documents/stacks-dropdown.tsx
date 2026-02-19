'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ActionButton } from '@/components/layout/action-button'
import { StackPickerContent, useStacksAvailable } from '@/components/shared/stack-picker-content'
import { useSupabase } from '@/hooks/use-supabase'
import type { StackSummary } from '@/types/stacks'
import * as Icons from '@/components/icons'

interface StacksDropdownProps {
  documentId: string
  assignedStacks: StackSummary[]
}

export function StacksDropdown({
  documentId,
  assignedStacks,
}: StacksDropdownProps) {
  const router = useRouter()
  const supabase = useSupabase()
  const { hasStacks, loading } = useStacksAvailable()
  const assignedIds = new Set(assignedStacks.map((s) => s.id))
  const [open, setOpen] = useState(false)

  const handleToggleStack = async (stackId: string, stackName: string) => {
    const shouldAssign = !assignedIds.has(stackId)
    try {
      if (shouldAssign) {
        const { error } = await supabase
          .from('stack_documents')
          .insert({ document_id: documentId, stack_id: stackId })
        if (error) throw error
        toast.success(`Added to "${stackName}"`)
      } else {
        // Junction table delete requires BOTH conditions
        const { error } = await supabase
          .from('stack_documents')
          .delete()
          .eq('document_id', documentId)
          .eq('stack_id', stackId)
        if (error) throw error
        toast.success(`Removed from "${stackName}"`)
      }
      router.refresh()
    } catch (error) {
      console.error('Stack toggle failed:', error)
      toast.error(shouldAssign ? 'Failed to add to stack' : 'Failed to remove from stack')
    }
  }

  // Button display logic
  const getDisplayText = () => {
    if (assignedStacks.length === 0) return 'No stacks'
    if (assignedStacks.length === 1) return assignedStacks[0].name
    return `${assignedStacks.length} Stacks`
  }

  // Tooltip text based on assignment state
  const getTooltipText = () => {
    if (assignedStacks.length === 0) return 'Assign to stacks'
    if (assignedStacks.length === 1) return `Assigned to ${assignedStacks[0].name}`
    return `Assigned to ${assignedStacks.map((s) => s.name).join(', ')}`
  }

  // No stacks exist and none assigned - show disabled ActionButton
  if (!hasStacks && assignedStacks.length === 0 && !loading) {
    return (
      <ActionButton icon={<Icons.Stack />} disabled>
        No stacks
      </ActionButton>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ActionButton icon={<Icons.Stack />}>
              {getDisplayText()}
            </ActionButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{getTooltipText()}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        <StackPickerContent
          onSelectStack={handleToggleStack}
          selectedStackIds={assignedIds}
          isOpen={open}
          showStackIcon={false}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
