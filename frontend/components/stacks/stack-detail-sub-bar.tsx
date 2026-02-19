'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SubBar } from '@/components/layout/sub-bar'
import { ActionButton } from '@/components/layout/action-button'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SearchFilterButton } from '@/components/layout/search-filter-button'
import { FilterPill } from '@/components/layout/filter-pill'
import { Separator } from '@/components/ui/separator'
import { SelectionActions } from '@/components/layout/selection-actions'
import { useStackDetailFilter } from '@/components/stacks/stack-detail-filter-context'
import * as Icons from '@/components/icons'
import type { StackTable } from '@/types/stacks'

interface StackDetailSubBarProps {
  tables: StackTable[]
  stackId: string
}

const MAX_VISIBLE_TABS = 3

/**
 * SubBar for stack detail page.
 * Renders tab navigation (Docs + tables), search, selection actions, and context-sensitive actions.
 * Consumes filter state from StackDetailFilterContext (shared with stack detail content).
 */
export function StackDetailSubBar({ tables, stackId }: StackDetailSubBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { searchFilter, setSearchFilter, selectedDocCount } = useStackDetailFilter()

  // Determine active tab from URL
  const activeTab = searchParams.get('tab') || 'documents'
  const activeTableId = searchParams.get('table')

  const handleTabChange = (tab: string, tableId?: string) => {
    setSearchFilter('') // Reset search when changing tabs
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    if (tableId) {
      params.set('table', tableId)
    } else {
      params.delete('table')
    }
    router.push(`/stacks/${stackId}?${params.toString()}`)
  }

  const visibleTables = tables.slice(0, MAX_VISIBLE_TABS)
  const overflowTables = tables.slice(MAX_VISIBLE_TABS)
  const isDocumentsActive = activeTab === 'documents'
  const isTableActive = activeTab === 'table' && activeTableId

  return (
    <SubBar
      left={
        <div className="flex items-center gap-1">
          <ActionButton
            icon={<Icons.Files />}
            onClick={() => handleTabChange('documents')}
            className={isDocumentsActive ? 'text-foreground' : 'text-muted-foreground'}
          >
            Docs
          </ActionButton>

          {visibleTables.map((table) => (
            <ActionButton
              key={table.id}
              icon={<Icons.Table />}
              onClick={() => handleTabChange('table', table.id)}
              className={
                activeTableId === table.id
                  ? 'text-foreground max-w-[120px]'
                  : 'text-muted-foreground max-w-[120px]'
              }
            >
              <span className="truncate">{table.name}</span>
            </ActionButton>
          ))}

          {overflowTables.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <Icons.ChevronDown className="size-4" />
                  {overflowTables.length} more
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {overflowTables.map((table) => (
                  <DropdownMenuItem
                    key={table.id}
                    onClick={() => handleTabChange('table', table.id)}
                  >
                    <Icons.Table className="size-4 mr-2" />
                    {table.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <ActionButton
            icon={<Icons.Plus />}
            tooltip="Create table"
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            <span className="sr-only">Create table</span>
          </ActionButton>

          <Separator
            orientation="vertical"
            className="mx-1 data-[orientation=vertical]:h-4"
          />

          <SearchFilterButton
            value={searchFilter}
            onChange={setSearchFilter}
            placeholder={isDocumentsActive ? 'Search documents...' : 'Search table...'}
          />
          {searchFilter && (
            <FilterPill
              icon={<Icons.Search className="size-full" />}
              label={`"${searchFilter}"`}
              onRemove={() => setSearchFilter('')}
            />
          )}
        </div>
      }
      right={
        <div className="flex items-center gap-2">
          {isDocumentsActive && (
            <SelectionActions
              selectedCount={selectedDocCount}
              selectedIds={[]}  // Stack document selection doesn't wire up bulk delete yet
              onClearSelection={() => {}}  // No-op (not wired up)
            />
          )}
          {isDocumentsActive && (
            <ActionButton icon={<Icons.Plus />} tooltip="Add documents" className="mr-2">
              Add
            </ActionButton>
          )}
          {isTableActive && (
            <ActionButton icon={<Icons.Download />} tooltip="Export as CSV" className="mr-2">
              Export CSV
            </ActionButton>
          )}
        </div>
      }
    />
  )
}
