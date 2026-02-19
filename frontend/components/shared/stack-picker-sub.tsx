'use client'

import { useState } from 'react'
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { StackPickerContent, useStacksAvailable } from './stack-picker-content'
import * as Icons from '@/components/icons'

interface StackPickerSubProps {
  /** Called when a stack is selected */
  onSelectStack: (stackId: string, stackName: string) => void
  /** Stack IDs to show as checked (for toggle behavior) */
  selectedStackIds?: Set<string>
  /** Custom trigger label */
  triggerLabel?: string
  /** Disable the submenu trigger */
  disabled?: boolean
}

export function StackPickerSub({
  onSelectStack,
  selectedStackIds,
  triggerLabel = 'Add to Stack',
  disabled = false,
}: StackPickerSubProps) {
  const { hasStacks, loading } = useStacksAvailable()
  const [subOpen, setSubOpen] = useState(false)

  // Don't render if no stacks exist
  if (!loading && !hasStacks) {
    return (
      <DropdownMenuItem disabled className="gap-2">
        <Icons.FolderPlus className="size-4" />
        <span>No stacks available</span>
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuSub open={subOpen} onOpenChange={setSubOpen}>
      <DropdownMenuSubTrigger disabled={disabled} className="gap-2">
        <Icons.FolderPlus className="size-4" />
        <span>{triggerLabel}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-48">
        <StackPickerContent
          onSelectStack={onSelectStack}
          selectedStackIds={selectedStackIds}
          isOpen={subOpen}
          showStackIcon={true}
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
