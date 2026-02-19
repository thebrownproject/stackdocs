'use client'

import { useState, useRef, useEffect } from 'react'
import { ActionButton } from '@/components/layout/action-button'
import { Input } from '@/components/ui/input'
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
import * as Icons from '@/components/icons'

interface SearchFilterButtonProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/**
 * Generic search filter dropdown button.
 * Opens a dropdown with a search input, auto-focuses on open,
 * closes on Enter key. Used for simple search-only filtering.
 *
 * For complex multi-filter menus (date, stacks), see FilterButton.
 */
export function SearchFilterButton({
  value,
  onChange,
  placeholder = 'Search...',
}: SearchFilterButtonProps) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input after dropdown opens. setTimeout(0) defers focus
  // until after Radix finishes rendering the dropdown content.
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ActionButton icon={<Icons.Filter />}>
              {value ? <span className="sr-only">Filter (active)</span> : 'Filter'}
            </ActionButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Filter</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="w-52"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-2 py-1">
          <Input
            ref={inputRef}
            placeholder={placeholder}
            aria-label={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') {
                setOpen(false)
              }
            }}
            className="h-5 text-sm border-0 shadow-none focus-visible:ring-0 pl-0.5 pr-0 bg-transparent dark:bg-transparent"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
