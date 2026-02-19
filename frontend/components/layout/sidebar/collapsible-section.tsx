"use client"

import * as Icons from "@/components/icons"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function CollapsibleSection({
  title,
  defaultOpen,
  action,
  children,
  className = "pt-0",
}: CollapsibleSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarGroup className={className}>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center justify-between hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors cursor-pointer">
            <span className="flex items-center">
              {title}
              <Icons.ChevronRight className="ml-1 size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </span>
            {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
