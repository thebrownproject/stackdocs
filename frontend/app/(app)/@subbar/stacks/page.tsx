'use client'

import Link from 'next/link'
import { SubBar } from '@/components/layout/sub-bar'
import { SearchFilterButton } from '@/components/layout/search-filter-button'
import { FilterPill } from '@/components/layout/filter-pill'
import { Button } from '@/components/ui/button'
import { useStacksFilter } from '@/components/stacks/stacks-filter-context'
import * as Icons from '@/components/icons'

/**
 * SubBar for stacks list page.
 * Renders filter button with search and "New Stack" button.
 * Consumes filter state from StacksFilterContext (shared with StacksList).
 */
export default function StacksSubBar() {
  const { filterValue, setFilterValue } = useStacksFilter()

  return (
    <SubBar
      left={
        <>
          <SearchFilterButton
            value={filterValue}
            onChange={setFilterValue}
            placeholder="Search stacks..."
          />
          {filterValue && (
            <FilterPill
              icon={<Icons.Search className="size-full" />}
              label={`"${filterValue}"`}
              onRemove={() => setFilterValue('')}
            />
          )}
        </>
      }
      right={
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
          <Link href="/stacks/new">
            <Icons.Plus className="size-3.5" />
            New Stack
          </Link>
        </Button>
      }
    />
  )
}
