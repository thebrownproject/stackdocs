'use client'

import { useState, useRef, useEffect } from 'react'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useStacks } from '@/hooks/use-stacks'
import * as Icons from '@/components/icons'

interface StackPickerContentProps {
  /** Called when a stack is selected */
  onSelectStack: (stackId: string, stackName: string) => void
  /** Stack IDs to show as checked (for toggle behavior) */
  selectedStackIds?: Set<string>
  /** Whether the parent container is open (for auto-focus) */
  isOpen: boolean
  /** Whether to show the stack icon next to each item */
  showStackIcon?: boolean
}

export function StackPickerContent({
  onSelectStack,
  selectedStackIds,
  isOpen,
  showStackIcon = true,
}: StackPickerContentProps) {
  const { stacks, loading } = useStacks()
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus search input when parent opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    } else {
      setSearchTerm('')
    }
  }, [isOpen])

  // Filter stacks by search term
  const filteredStacks = stacks.filter((stack) =>
    stack.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <>
      {/* Search input */}
      <div className="px-2 py-1">
        <Input
          ref={inputRef}
          placeholder="Search stacks..."
          aria-label="Search stacks"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="h-5 text-sm border-0 shadow-none focus-visible:ring-0 pl-0.5 pr-0 bg-transparent dark:bg-transparent"
        />
      </div>
      <DropdownMenuSeparator />

      {/* Stack list */}
      {loading ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          Loading...
        </div>
      ) : filteredStacks.length > 0 ? (
        filteredStacks.map((stack) => (
          <DropdownMenuItem
            key={stack.id}
            onSelect={(e) => {
              e.preventDefault()
              onSelectStack(stack.id, stack.name)
            }}
            className="group/item gap-2"
          >
            {selectedStackIds && (
              <Checkbox
                checked={selectedStackIds.has(stack.id)}
                className="pointer-events-none opacity-0 group-hover/item:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
              />
            )}
            {showStackIcon && <Icons.Stack className="size-4" />}
            <span className="flex-1">{stack.name}</span>
          </DropdownMenuItem>
        ))
      ) : searchTerm ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          No matching stacks
        </div>
      ) : (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">
          No stacks available
        </div>
      )}
    </>
  )
}

/** Hook to check if stacks are available (for conditional rendering) */
export function useStacksAvailable() {
  const { stacks, loading } = useStacks()
  return { hasStacks: stacks.length > 0, loading }
}
