// frontend/components/layout/sidebar/app-sidebar-client.tsx
'use client'

import * as React from 'react'
import * as Icons from '@/components/icons'
import { UserButton } from '@clerk/nextjs'
import { NavMain } from '@/components/layout/sidebar/nav-main'
import { NavProjects } from '@/components/layout/sidebar/nav-projects'
import { SidebarHeaderMenu } from '@/components/layout/sidebar/sidebar-header-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const data = {
  navMain: [
    {
      title: 'Workspace',
      url: '#',
      icon: Icons.Stack,
      isActive: true,
      items: [
        {
          title: 'Documents',
          url: '/documents',
          icon: Icons.Files,
        },
        {
          title: 'Stacks',
          url: '/stacks',
          icon: Icons.Stack3,
        },
      ],
    },
  ],
}

interface AppSidebarClientProps extends React.ComponentProps<typeof Sidebar> {
  stacks: { id: string; name: string }[]
}

export function AppSidebarClient({ stacks, ...props }: AppSidebarClientProps) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeaderMenu />
      <SidebarContent className="gap-0">
        <NavMain items={data.navMain} />
        <NavProjects stacks={stacks} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <UserButton
                    showName
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        rootBox: 'w-full',
                        userButtonTrigger:
                          'w-full h-8 justify-start px-2 rounded-md hover:bg-sidebar-accent transition-colors cursor-default',
                        userButtonBox: 'flex-row-reverse gap-0',
                        avatarBox: 'size-6 rounded-full',
                        userButtonOuterIdentifier: 'text-sm',
                      },
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">Account settings</TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
