'use client'

import * as Icons from '@/components/icons'
import { FilterPill } from '@/components/layout/filter-pill'
import { FilterButton } from '@/components/layout/filter-button'
import { useDocumentsFilter, type DateRangeFilter } from '@/components/documents/documents-filter-context'
import type { StackSummary } from '@/types/stacks'

const DATE_LABELS: Record<Exclude<DateRangeFilter, 'all'>, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: '7 days',
  last30: '30 days',
}

interface FilterBarProps {
  stacks: StackSummary[]
}

export function FilterBar({ stacks }: FilterBarProps) {
  const { dateRange, stackFilter, filterValue, setFilterValue, clearDateFilter, clearStackFilter } = useDocumentsFilter()

  // Map stack IDs to names for pills
  const stackMap = new Map(stacks.map((s) => [s.id, s.name]))

  return (
    <div className="flex items-center gap-2">
      {/* Filter dropdown */}
      <FilterButton stacks={stacks} />

      {/* Search pill */}
      {filterValue && (
        <FilterPill
          icon={<Icons.Search className="size-full" />}
          label={`"${filterValue}"`}
          onRemove={() => setFilterValue('')}
        />
      )}

      {/* Date pill */}
      {dateRange !== 'all' && (
        <FilterPill
          icon={<Icons.Calendar className="size-full" />}
          label={DATE_LABELS[dateRange]}
          onRemove={clearDateFilter}
        />
      )}

      {/* Stack pills */}
      {Array.from(stackFilter).map((stackId) => (
        <FilterPill
          key={stackId}
          icon={<Icons.Stack className="size-full" />}
          label={stackMap.get(stackId) ?? 'Unknown'}
          onRemove={() => clearStackFilter(stackId)}
        />
      ))}
    </div>
  )
}
