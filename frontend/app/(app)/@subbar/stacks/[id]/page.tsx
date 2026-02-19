import { getStackWithDetails } from '@/lib/queries/stacks'
import { StackDetailSubBar } from '@/components/stacks/stack-detail-sub-bar'

interface StackDetailSubBarPageProps {
  params: Promise<{ id: string }>
}

/**
 * Server component for stack detail SubBar.
 * Fetches stack data (cached) and renders the client SubBar component.
 */
export default async function StackDetailSubBarPage({ params }: StackDetailSubBarPageProps) {
  const { id } = await params
  const stack = await getStackWithDetails(id)

  if (!stack) {
    return null
  }

  return <StackDetailSubBar tables={stack.tables} stackId={id} />
}
