'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

/**
 * Context for sharing filter state between
 * the StacksSubBar (parallel route) and StacksList (page).
 */
interface StacksFilterContextValue {
  // Search filter for stack name column
  filterValue: string
  setFilterValue: (value: string) => void
}

const StacksFilterContext = createContext<StacksFilterContextValue | null>(null)

export function StacksFilterProvider({ children }: { children: ReactNode }) {
  const [filterValue, setFilterValueState] = useState('')

  const setFilterValue = useCallback((value: string) => {
    setFilterValueState(value)
  }, [])

  const contextValue = useMemo(() => ({
    filterValue,
    setFilterValue,
  }), [filterValue, setFilterValue])

  return (
    <StacksFilterContext.Provider value={contextValue}>
      {children}
    </StacksFilterContext.Provider>
  )
}

export function useStacksFilter() {
  const context = useContext(StacksFilterContext)
  if (!context) {
    throw new Error('useStacksFilter must be used within StacksFilterProvider')
  }
  return context
}
