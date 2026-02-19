'use client'

import { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from 'react'

// Date range filter options
export type DateRangeFilter = 'all' | 'today' | 'yesterday' | 'last7' | 'last30'

/**
 * Context for sharing filter and selection state between
 * the DocumentsSubBar (parallel route) and DocumentsTable (page).
 *
 * Bidirectional selection sync:
 * - Table → Context: Table calls setSelectedIds when selection changes
 * - Context → Table: clearSelection calls registered resetRowSelection callback
 */
interface DocumentsFilterContextValue {
  // Search filter for filename column
  filterValue: string
  setFilterValue: (value: string) => void
  // Selection state (IDs stored, count derived)
  selectedIds: string[]
  selectedCount: number  // Derived from selectedIds.length
  setSelectedIds: (ids: string[]) => void
  // Table registers its setRowSelection so context can clear it
  registerResetRowSelection: (reset: () => void) => void
  // Clears both context state AND table rowSelection
  clearSelection: () => void
  // Date range filter
  dateRange: DateRangeFilter
  setDateRange: (value: DateRangeFilter) => void
  // Stack filter (multi-select by stack ID)
  stackFilter: Set<string>
  toggleStackFilter: (stackId: string) => void
  // Active filter count for badge
  activeFilterCount: number
  // Clear individual filters
  clearDateFilter: () => void
  clearStackFilter: (stackId: string) => void
  // Clear all filters
  clearFilters: () => void
}

const DocumentsFilterContext = createContext<DocumentsFilterContextValue | null>(null)

export function DocumentsFilterProvider({ children }: { children: ReactNode }) {
  const [filterValue, setFilterValueState] = useState('')
  const [selectedIds, setSelectedIdsState] = useState<string[]>([])
  const [dateRange, setDateRangeState] = useState<DateRangeFilter>('all')
  const [stackFilter, setStackFilterState] = useState<Set<string>>(new Set())

  // Ref to hold the table's reset function (avoids re-renders)
  const resetRowSelectionRef = useRef<(() => void) | null>(null)

  const setFilterValue = useCallback((value: string) => {
    setFilterValueState(value)
  }, [])

  const setSelectedIds = useCallback((ids: string[]) => {
    setSelectedIdsState(ids)
  }, [])

  const registerResetRowSelection = useCallback((reset: () => void) => {
    resetRowSelectionRef.current = reset
  }, [])

  const clearSelection = useCallback(() => {
    // Clear context state
    setSelectedIdsState([])
    // Clear table's rowSelection state via registered callback
    if (resetRowSelectionRef.current) {
      resetRowSelectionRef.current()
    }
  }, [])

  // Derive selectedCount from selectedIds
  const selectedCount = selectedIds.length

  const setDateRange = useCallback((value: DateRangeFilter) => {
    setDateRangeState(value)
  }, [])

  const toggleStackFilter = useCallback((stackId: string) => {
    setStackFilterState((prev) => {
      const next = new Set(prev)
      if (next.has(stackId)) {
        next.delete(stackId)
      } else {
        next.add(stackId)
      }
      return next
    })
  }, [])

  const clearDateFilter = useCallback(() => {
    setDateRangeState('all')
  }, [])

  const clearStackFilter = useCallback((stackId: string) => {
    setStackFilterState((prev) => {
      const next = new Set(prev)
      next.delete(stackId)
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setFilterValueState('')
    setDateRangeState('all')
    setStackFilterState(new Set())
  }, [])

  // Count active filters (non-default values)
  // Stack filter counts each selected stack as one filter
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterValue) count += 1
    if (dateRange !== 'all') count += 1
    count += stackFilter.size
    return count
  }, [filterValue, dateRange, stackFilter])

  const contextValue = useMemo(() => ({
    filterValue,
    setFilterValue,
    selectedIds,
    selectedCount,
    setSelectedIds,
    registerResetRowSelection,
    clearSelection,
    dateRange,
    setDateRange,
    stackFilter,
    toggleStackFilter,
    activeFilterCount,
    clearDateFilter,
    clearStackFilter,
    clearFilters,
  }), [
    filterValue,
    setFilterValue,
    selectedIds,
    selectedCount,
    setSelectedIds,
    registerResetRowSelection,
    clearSelection,
    dateRange,
    setDateRange,
    stackFilter,
    toggleStackFilter,
    activeFilterCount,
    clearDateFilter,
    clearStackFilter,
    clearFilters,
  ])

  return (
    <DocumentsFilterContext.Provider value={contextValue}>
      {children}
    </DocumentsFilterContext.Provider>
  )
}

export function useDocumentsFilter() {
  const context = useContext(DocumentsFilterContext)
  if (!context) {
    throw new Error('useDocumentsFilter must be used within DocumentsFilterProvider')
  }
  return context
}
