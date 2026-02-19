"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as Icons from "@/components/icons"
import { CollapsibleSection } from "./collapsible-section"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { StackSummary } from "@/types/stacks"

export function NavProjects({ stacks }: { stacks: StackSummary[] }) {
  const pathname = usePathname()

  const createAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/stacks/new"
          className="opacity-0 group-hover/collapsible:opacity-100 block p-1 hover:bg-sidebar-accent rounded transition-opacity"
        >
          <Icons.Plus className="size-4 text-muted-foreground hover:text-foreground" />
          <span className="sr-only">Create stack</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">Create stack</TooltipContent>
    </Tooltip>
  )

  return (
    <CollapsibleSection
      title="Recent Stacks"
      defaultOpen
      action={createAction}
      className="group-data-[collapsible=icon]:hidden pt-0"
    >
      <SidebarMenu>
        {stacks.map((stack) => (
          <SidebarMenuItem key={stack.id}>
            <SidebarMenuButton
              asChild
              className={cn("gap-1.5", pathname === `/stacks/${stack.id}` && "bg-sidebar-accent")}
            >
              <Link href={`/stacks/${stack.id}`}>
                <Icons.FileStack className="size-4" />
                <span className="truncate">{stack.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}

        {stacks.length === 0 && (
          <SidebarMenuItem>
            <span className="text-xs text-muted-foreground px-2 py-1">No stacks yet</span>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </CollapsibleSection>
  )
}
