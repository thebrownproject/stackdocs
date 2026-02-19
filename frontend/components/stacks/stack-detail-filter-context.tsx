'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

/**
 * Context for sharing filter and selection state between
 * the StackDetailSubBar (parallel route) and stack detail page content.
 */
interface StackDetailFilterContextValue {
  // Search filter for document names within the stack
  searchFilter: string
  setSearchFilter: (value: string) => void
  // Count of selected documents in the stack
  selectedDocCount: number
  setSelectedDocCount: (count: number) => void
}

const StackDetailFilterContext = createContext<StackDetailFilterContextValue | null>(null)

export function StackDetailFilterProvider({ children }: { children: ReactNode }) {
  const [searchFilter, setSearchFilterState] = useState('')
  const [selectedDocCount, setSelectedDocCountState] = useState(0)

  const setSearchFilter = useCallback((value: string) => {
    setSearchFilterState(value)
  }, [])

  const setSelectedDocCount = useCallback((count: number) => {
    setSelectedDocCountState(count)
  }, [])

  const contextValue = useMemo(() => ({
    searchFilter,
    setSearchFilter,
    selectedDocCount,
    setSelectedDocCount,
  }), [searchFilter, setSearchFilter, selectedDocCount, setSelectedDocCount])

  return (
    <StackDetailFilterContext.Provider value={contextValue}>
      {children}
    </StackDetailFilterContext.Provider>
  )
}

export function useStackDetailFilter() {
  const context = useContext(StackDetailFilterContext)
  if (!context) {
    throw new Error('useStackDetailFilter must be used within StackDetailFilterProvider')
  }
  return context
}
