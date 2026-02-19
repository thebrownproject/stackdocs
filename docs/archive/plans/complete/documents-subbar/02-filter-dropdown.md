# Phase 2: Filter Dropdown

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement filter dropdown with date range and status filters for documents list.

**Architecture:** Filter state managed in DocumentsFilterContext, consumed by FilterButton and DocumentsTable.

**Tech Stack:** React Context, shadcn/ui DropdownMenu

---

## Task 2: Extend DocumentsFilterContext with Filter State

**Files:**
- Modify: `frontend/components/documents/documents-filter-context.tsx`

**Step 1: Add filter state types and values**

```tsx
// Import existing type at top of file:
import type { DocumentStatus } from '@/types/documents'

// Add new type for date range:
export type DateRangeFilter = 'all' | 'today' | 'yesterday' | 'last7' | 'last30'

// Add to interface DocumentsFilterContextValue:
// Date range filter
dateRange: DateRangeFilter
setDateRange: (value: DateRangeFilter) => void
// Status filter (multi-select, reuses existing DocumentStatus type)
statusFilter: Set<DocumentStatus>
setStatusFilter: (value: Set<DocumentStatus>) => void
toggleStatusFilter: (status: DocumentStatus) => void
// Active filter count for badge
activeFilterCount: number
// Clear all filters
clearFilters: () => void

// NOTE: Stack filter (stackFilter, setStackFilter, toggleStackFilter) is DEFERRED.
// See "Deferred Work" in main plan - requires stacks list in documents context.
```

**Step 2: Implement the state and callbacks in provider**

Add useState hooks for each filter, memoized callbacks, and compute `activeFilterCount` based on non-default values.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/components/documents/documents-filter-context.tsx
git commit -m "feat: add filter state to DocumentsFilterContext"
```

---

## Task 3: Implement Filter Dropdown UI

**Files:**
- Modify: `frontend/components/layout/filter-button.tsx`

**Step 1: Replace placeholder with full filter dropdown**

```tsx
'use client'

import * as React from 'react'
import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'

const DATE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
] as const

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Extracted' },
  { value: 'processing', label: 'Processing' },
  { value: 'ocr_complete', label: 'OCR Complete' },
  { value: 'failed', label: 'Failed' },
] as const

export function FilterButton() {
  const {
    dateRange,
    setDateRange,
    statusFilter,
    toggleStatusFilter,
    activeFilterCount,
    clearFilters,
  } = useDocumentsFilter()

  const label = activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <ActionButton icon={<Icons.Filter />}>
              {label}
            </ActionButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Filter documents</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuLabel>Date</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
          {DATE_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={statusFilter.has(opt.value)}
            onCheckedChange={() => toggleStatusFilter(opt.value)}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}

        {activeFilterCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={clearFilters}
              className="text-muted-foreground"
            >
              Clear all filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/components/layout/filter-button.tsx
git commit -m "feat: implement filter dropdown with date and status filters"
```

---

## Task 4: Create Date Boundary Utilities

**Files:**
- Create: `frontend/lib/date.ts`

**Why:** Date boundary logic will be reused in Stacks pages for filtering. Extract to shared utility.

**Step 1: Create date utility file**

```tsx
// frontend/lib/date.ts

/**
 * Get the start of today (midnight local time).
 */
export function getStartOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Get a date N days ago from start of today.
 */
export function getDaysAgo(days: number): Date {
  return new Date(getStartOfToday().getTime() - days * 24 * 60 * 60 * 1000)
}

/**
 * Get date range boundaries for common filter options.
 * Returns [startDate, endDate] where endDate is exclusive.
 */
export function getDateRangeBounds(
  range: 'today' | 'yesterday' | 'last7' | 'last30'
): [Date, Date | null] {
  const startOfToday = getStartOfToday()

  switch (range) {
    case 'today':
      return [startOfToday, null] // null = no upper bound
    case 'yesterday':
      return [getDaysAgo(1), startOfToday] // yesterday only, excludes today
    case 'last7':
      return [getDaysAgo(7), null]
    case 'last30':
      return [getDaysAgo(30), null]
  }
}

/**
 * Check if a date falls within a range.
 * @param date - Date to check
 * @param start - Start of range (inclusive)
 * @param end - End of range (exclusive), or null for no upper bound
 */
export function isDateInRange(date: Date, start: Date, end: Date | null): boolean {
  if (date < start) return false
  if (end && date >= end) return false
  return true
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/lib/date.ts
git commit -m "feat: add date boundary utilities for filtering"
```

---

## Task 5: Apply Filters to Documents Table

**Files:**
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Add filter logic using date utilities**

Import `useDocumentsFilter` and the new date utilities. Filter documents using `useMemo` for performance.

```tsx
import { getDateRangeBounds, isDateInRange } from '@/lib/date'

const { dateRange, statusFilter } = useDocumentsFilter()

const filteredDocuments = useMemo(() => {
  let result = documents

  // Apply date filter
  if (dateRange !== 'all') {
    const [start, end] = getDateRangeBounds(dateRange)
    result = result.filter((doc) => isDateInRange(new Date(doc.uploaded_at), start, end))
  }

  // Apply status filter (if any selected)
  if (statusFilter.size > 0) {
    result = result.filter((doc) => statusFilter.has(doc.status))
  }

  return result
}, [documents, dateRange, statusFilter])
```

**Step 2: Use filteredDocuments in table**

Pass `filteredDocuments` to the table instead of `documents`.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/components/documents/documents-table.tsx
git commit -m "feat: apply filter state to documents table"
```
