"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import * as Icons from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarHeader, SidebarMenuButton } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GlobalSearchDialog } from "@/components/layout/global-search-dialog"
import { useAgentStore, initialUploadData } from "@/components/agent"

export function SidebarHeaderMenu() {
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const openFlow = useAgentStore((state) => state.openFlow)

  return (
    <>
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <SidebarHeader className="h-[47px] flex flex-row items-center justify-between gap-2 px-2 py-0">
        {/* Logo + Name + Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="flex-1 h-8 gap-1.5 data-[state=open]:bg-sidebar-accent">
                  <Icons.Stack className="size-6" />
                  <span className="font-semibold">Stackdocs</span>
                  <Icons.ChevronDown className="size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Workspace settings
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem disabled>
              <Icons.Settings className="size-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="#">
                <Icons.Lifebuoy className="size-4" />
                <span>Support</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="#">
                <Icons.Send className="size-4" />
                <span>Feedback</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Icons.Sun className="size-4 dark:hidden" />
                <Icons.Moon className="size-4 hidden dark:block" />
                <span>Theme</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Icons.DeviceDesktop className="size-4" />
                  <span>Auto</span>
                  {theme === "system" && <Icons.Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Icons.Sun className="size-4" />
                  <span>Light</span>
                  {theme === "light" && <Icons.Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Icons.Moon className="size-4" />
                  <span>Dark</span>
                  {theme === "dark" && <Icons.Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setSearchOpen(true)}
              >
                <Icons.Search className="size-4" />
                <span className="sr-only">Search</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Search (⌘K)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })}
              >
                <Icons.Upload className="size-4" />
                <span className="sr-only">Upload</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Upload document</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
    </>
  )
}
