"use client"

import type { Icon } from "@/components/icons"
import Link from "next/link"
import { CollapsibleSection } from "./collapsible-section"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon: Icon
  isActive?: boolean
  items?: {
    title: string
    url: string
    icon?: Icon
  }[]
}

export function NavMain({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map((item) => (
        <CollapsibleSection key={item.title} title={item.title} defaultOpen={item.isActive}>
          <SidebarMenu>
            {item.items?.map((subItem) => (
              <SidebarMenuItem key={subItem.title}>
                <SidebarMenuButton asChild className="gap-1.5">
                  <Link href={subItem.url}>
                    {subItem.icon && <subItem.icon className="size-4" />}
                    <span>{subItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsibleSection>
      ))}
    </>
  )
}
