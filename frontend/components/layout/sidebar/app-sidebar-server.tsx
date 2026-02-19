import { getStacksForSidebar } from '@/lib/queries/stacks'
import { AppSidebarClient } from './app-sidebar-client'

export async function AppSidebar(
  props: Omit<React.ComponentProps<typeof AppSidebarClient>, 'stacks'>
) {
  const stacks = await getStacksForSidebar()
  return <AppSidebarClient stacks={stacks} {...props} />
}
