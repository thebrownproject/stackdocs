'use client'

import { useEffect } from 'react'
import { StackDocumentsTab } from './stack-documents-tab'
import { StackTableView } from './stack-table-view'
import { useStackDetailFilter } from './stack-detail-filter-context'
import type { StackWithDetails, StackTable, StackTableRow } from '@/types/stacks'

interface StackDetailClientProps {
  stack: StackWithDetails
  activeTab: string
  activeTable: StackTable | null
  tableRows: StackTableRow[] | null
}

/**
 * Stack detail content area.
 * Renders either StackDocumentsTab or StackTableView based on activeTab.
 * SubBar is now rendered via @subbar parallel route.
 */
export function StackDetailClient({
  stack,
  activeTab,
  activeTable,
  tableRows,
}: StackDetailClientProps) {
  const { searchFilter, setSelectedDocCount } = useStackDetailFilter()

  // Persist active tab to localStorage for next visit
  useEffect(() => {
    localStorage.setItem(`stack-${stack.id}-view`, activeTab)
  }, [stack.id, activeTab])

  const isDocumentsActive = activeTab === 'documents'
  const isTableActive = activeTab === 'table' && activeTable

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-hidden">
        {isDocumentsActive && (
          <StackDocumentsTab
            documents={stack.documents}
            stackId={stack.id}
            searchFilter={searchFilter}
            onSelectionChange={setSelectedDocCount}
          />
        )}
        {isTableActive && tableRows && (
          <StackTableView
            table={activeTable}
            rows={tableRows}
            searchFilter={searchFilter}
          />
        )}
      </div>
    </div>
  )
}
