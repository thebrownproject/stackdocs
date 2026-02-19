'use client'

import { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from 'react'

/**
 * Context for sharing filter and selection state between
 * the DocumentDetailSubBar (parallel route) and ExtractedDataTable (page).
 *
 * Bidirectional selection sync:
 * - Table -> Context: Table calls setSelectedFieldIds when selection changes
 * - Context -> Table: clearFieldSelection calls registered resetRowSelection callback
 */
interface DocumentDetailFilterContextValue {
  // Search filter for field names
  fieldSearch: string
  setFieldSearch: (value: string) => void
  // Selection state (IDs stored, count derived)
  selectedFieldIds: string[]
  selectedFieldCount: number  // Derived from selectedFieldIds.length
  setSelectedFieldIds: (ids: string[]) => void
  // Table registers its setRowSelection so context can clear it
  registerResetRowSelection: (reset: () => void) => void
  // Clears both context state AND table rowSelection
  clearFieldSelection: () => void
}

const DocumentDetailFilterContext = createContext<DocumentDetailFilterContextValue | null>(null)

export function DocumentDetailFilterProvider({ children }: { children: ReactNode }) {
  const [fieldSearch, setFieldSearchState] = useState('')
  const [selectedFieldIds, setSelectedFieldIdsState] = useState<string[]>([])

  // Ref to hold the table's reset function (avoids re-renders)
  const resetRowSelectionRef = useRef<(() => void) | null>(null)

  const setFieldSearch = useCallback((value: string) => {
    setFieldSearchState(value)
  }, [])

  const setSelectedFieldIds = useCallback((ids: string[]) => {
    setSelectedFieldIdsState(ids)
  }, [])

  const registerResetRowSelection = useCallback((reset: () => void) => {
    resetRowSelectionRef.current = reset
  }, [])

  const clearFieldSelection = useCallback(() => {
    // Clear context state
    setSelectedFieldIdsState([])
    // Clear table's rowSelection state via registered callback
    if (resetRowSelectionRef.current) {
      resetRowSelectionRef.current()
    }
  }, [])

  // Derive selectedFieldCount from selectedFieldIds
  const selectedFieldCount = selectedFieldIds.length

  const contextValue = useMemo(() => ({
    fieldSearch,
    setFieldSearch,
    selectedFieldIds,
    selectedFieldCount,
    setSelectedFieldIds,
    registerResetRowSelection,
    clearFieldSelection,
  }), [fieldSearch, setFieldSearch, selectedFieldIds, selectedFieldCount, setSelectedFieldIds, registerResetRowSelection, clearFieldSelection])

  return (
    <DocumentDetailFilterContext.Provider value={contextValue}>
      {children}
    </DocumentDetailFilterContext.Provider>
  )
}

export function useDocumentDetailFilter() {
  const context = useContext(DocumentDetailFilterContext)
  if (!context) {
    throw new Error('useDocumentDetailFilter must be used within DocumentDetailFilterProvider')
  }
  return context
}
