import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import * as Icons from '@/components/icons'
import { getStackWithDetails } from '@/lib/queries/stacks'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StackDetailHeader({ params }: PageProps) {
  const { id } = await params
  const stack = await getStackWithDetails(id)
  if (!stack) notFound()

  return <PageHeader title={stack.name} icon={<Icons.FileStack className="size-4" />} />
}
