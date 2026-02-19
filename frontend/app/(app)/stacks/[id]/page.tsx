import { notFound } from 'next/navigation'
import { getStackWithDetails, getStackTableRows } from '@/lib/queries/stacks'
import { StackDetailClient } from '@/components/stacks/stack-detail-client'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; table?: string }>
}

export default async function StackDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { tab, table: tableId } = await searchParams

  const stack = await getStackWithDetails(id)
  if (!stack) notFound()

  let tableRows = null
  const activeTable = tableId ? stack.tables.find(t => t.id === tableId) ?? null : null

  if (activeTable) {
    tableRows = await getStackTableRows(activeTable.id)
  }

  return (
    <StackDetailClient
      stack={stack}
      activeTab={tab || 'documents'}
      activeTable={activeTable}
      tableRows={tableRows}
    />
  )
}
