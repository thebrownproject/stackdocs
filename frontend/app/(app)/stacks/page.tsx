import { getStacksWithCounts } from '@/lib/queries/stacks'
import { StacksList } from '@/components/stacks/stacks-list'

export default async function StacksPage() {
  const stacks = await getStacksWithCounts()

  return <StacksList stacks={stacks} />
}
