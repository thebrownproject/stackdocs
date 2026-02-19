# Stacks Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **Prerequisite**: Complete `2025-12-29-agent-ui-refactor.md` first. Both plans modify `app/(app)/layout.tsx`.

**Goal:** Establish type definitions, database queries, and sidebar integration for the Stacks feature.

**Architecture:** Types in `frontend/types/`, queries in `frontend/lib/queries/`, sidebar fetches stacks dynamically from Supabase.

**Tech Stack:** TypeScript, Supabase JS client, Next.js 16 App Router

---

## Task 1: Create Stack Type Definitions

**Files:**
- Create: `frontend/types/stacks.ts`

**Step 1: Write the type definitions**

```typescript
// frontend/types/stacks.ts

export type StackStatus = 'active' | 'archived'
export type TableStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Stack {
  id: string
  name: string
  description: string | null
  status: StackStatus
  created_at: string
  updated_at: string
}

export interface StackWithCounts extends Stack {
  document_count: number
  table_count: number
}

export interface StackDocument {
  id: string
  stack_id: string
  document_id: string
  added_at: string
  document: {
    id: string
    filename: string
    mime_type: string
    status: string
    uploaded_at: string
  }
}

export interface StackTableColumn {
  name: string
  description?: string
  type?: 'text' | 'number' | 'date' | 'currency'
}

export interface StackTable {
  id: string
  stack_id: string
  name: string
  mode: 'auto' | 'custom'
  custom_columns: string[] | null
  columns: StackTableColumn[] | null
  session_id: string | null
  status: TableStatus
  created_at: string
  updated_at: string
}

export interface StackTableRow {
  id: string
  table_id: string
  document_id: string
  row_data: Record<string, unknown>
  confidence_scores: Record<string, number> | null
  created_at: string
  updated_at: string
  document: {
    id: string
    filename: string
  }
}

export interface StackWithDetails extends Stack {
  documents: StackDocument[]
  tables: StackTable[]
}
```

**Step 2: Commit**

```bash
git add frontend/types/stacks.ts
git commit -m "feat(stacks): add type definitions for stacks feature"
```

---

## Task 2: Create Stacks Query Functions

**Files:**
- Create: `frontend/lib/queries/stacks.ts`

**Step 1: Write the query functions**

```typescript
// frontend/lib/queries/stacks.ts

import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type {
  Stack,
  StackWithCounts,
  StackWithDetails,
  StackTable,
  StackTableRow,
  StackDocument,
} from '@/types/stacks'

/**
 * Get all stacks for the current user with document and table counts.
 */
export async function getStacksWithCounts(): Promise<StackWithCounts[]> {
  const supabase = await createServerSupabaseClient()

  const { data: stacks, error } = await supabase
    .from('stacks')
    .select(`
      id, name, description, status, created_at, updated_at,
      stack_documents(count),
      stack_tables(count)
    `)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching stacks:', error)
    return []
  }

  return (stacks || []).map((stack) => ({
    id: stack.id,
    name: stack.name,
    description: stack.description,
    status: stack.status,
    created_at: stack.created_at,
    updated_at: stack.updated_at,
    document_count: (stack.stack_documents as { count: number }[])?.[0]?.count ?? 0,
    table_count: (stack.stack_tables as { count: number }[])?.[0]?.count ?? 0,
  }))
}

/**
 * Get a single stack with all documents and tables.
 */
export const getStackWithDetails = cache(async function(
  stackId: string
): Promise<StackWithDetails | null> {
  const supabase = await createServerSupabaseClient()

  const { data: stack, error: stackError } = await supabase
    .from('stacks')
    .select('*')
    .eq('id', stackId)
    .single()

  if (stackError || !stack) {
    console.error('Error fetching stack:', stackError)
    return null
  }

  const { data: stackDocs } = await supabase
    .from('stack_documents')
    .select(`
      id, stack_id, document_id, added_at,
      documents (id, filename, mime_type, status, uploaded_at)
    `)
    .eq('stack_id', stackId)
    .order('added_at', { ascending: false })

  const { data: tables } = await supabase
    .from('stack_tables')
    .select('*')
    .eq('stack_id', stackId)
    .order('created_at', { ascending: true })

  const documents: StackDocument[] = (stackDocs || []).map((sd) => ({
    id: sd.id,
    stack_id: sd.stack_id,
    document_id: sd.document_id,
    added_at: sd.added_at,
    document: sd.documents as StackDocument['document'],
  }))

  return { ...stack, documents, tables: tables || [] }
})

/**
 * Get table rows for a specific stack table.
 */
export const getStackTableRows = cache(async function(
  tableId: string
): Promise<StackTableRow[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('stack_table_rows')
    .select(`
      id, table_id, document_id, row_data, confidence_scores, created_at, updated_at,
      documents (id, filename)
    `)
    .eq('table_id', tableId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching table rows:', error)
    return []
  }

  return (data || []).map((row) => ({
    ...row,
    document: row.documents as StackTableRow['document'],
  }))
})

/**
 * Get stacks for sidebar (minimal data).
 */
export async function getStacksForSidebar(): Promise<Pick<Stack, 'id' | 'name'>[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('stacks')
    .select('id, name')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching stacks for sidebar:', error)
    return []
  }

  return data || []
}
```

**Step 2: Commit**

```bash
git add frontend/lib/queries/stacks.ts
git commit -m "feat(stacks): add Supabase query functions"
```

---

## Task 3: Update Sidebar to Show Stacks Dynamically

**Files:**
- Modify: `frontend/components/layout/sidebar/nav-projects.tsx`

**Step 1: Update nav-projects to accept stacks prop and show + button on hover**

```typescript
// frontend/components/layout/sidebar/nav-projects.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as Icons from "@/components/icons"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface StackItem {
  id: string
  name: string
}

export function NavProjects({ stacks }: { stacks: StackItem[] }) {
  const pathname = usePathname()

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="group-data-[collapsible=icon]:hidden pt-0">
        <SidebarGroupLabel asChild>
          <div className="flex w-full items-center justify-between">
            <CollapsibleTrigger className="flex items-center hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors cursor-pointer px-2 py-1 -ml-2">
              Stacks
              <Icons.ChevronRight className="ml-1 size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/stacks/new"
                  className="opacity-0 group-hover/collapsible:opacity-100 p-1 hover:bg-sidebar-accent rounded-md transition-all"
                >
                  <Icons.Plus className="size-4 text-muted-foreground hover:text-foreground" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Create stack</TooltipContent>
            </Tooltip>
          </div>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={cn("gap-1.5", pathname === "/stacks" && "bg-sidebar-accent")}
                >
                  <Link href="/stacks">
                    <Icons.LayersLinked className="size-4" />
                    <span>All Stacks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {stacks.map((stack) => (
                <SidebarMenuItem key={stack.id}>
                  <SidebarMenuButton
                    asChild
                    className={cn("gap-1.5", pathname === `/stacks/${stack.id}` && "bg-sidebar-accent")}
                  >
                    <Link href={`/stacks/${stack.id}`}>
                      <Icons.Stack className="size-4" />
                      <span className="truncate">{stack.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {stacks.length === 0 && (
                <SidebarMenuItem>
                  <span className="text-xs text-muted-foreground px-2 py-1">
                    No stacks yet
                  </span>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
```

**Step 2: Create server wrapper for sidebar**

Create `frontend/components/layout/sidebar/app-sidebar-server.tsx`:

```typescript
import { getStacksForSidebar } from '@/lib/queries/stacks'
import { AppSidebarClient } from './app-sidebar-client'

export async function AppSidebar(props: React.ComponentProps<typeof AppSidebarClient>) {
  const stacks = await getStacksForSidebar()
  return <AppSidebarClient stacks={stacks} {...props} />
}
```

**Step 3: Create app-sidebar-client.tsx**

Rename `app-sidebar.tsx` to `app-sidebar-client.tsx` and update to accept stacks prop:

```typescript
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
          title: 'Extractions',
          url: '/extractions',
          icon: Icons.LayersLinked,
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
```

**Step 4: Update layout.tsx import**

```typescript
// frontend/app/(app)/layout.tsx
// Change:
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
// To:
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar-server"
```

**Step 5: Commit**

```bash
git add frontend/components/layout/sidebar/
git commit -m "feat(stacks): dynamic sidebar with stacks from database"
```

---

## Task 4: Add Plus Icon to Icons Barrel

**Files:**
- Modify: `frontend/components/icons/index.ts`

**Step 1: Add icons (Stack already exists as IconStack2)**

```typescript
export { IconPlus as Plus } from '@tabler/icons-react'
export { IconTable2 as Table } from '@tabler/icons-react'
export { IconClock as Clock } from '@tabler/icons-react'
```

**Step 2: Commit**

```bash
git add frontend/components/icons/index.ts
git commit -m "feat(icons): add Plus, Table, Clock icon exports"
```

---

## Task 5: Create Types Barrel Export

**Files:**
- Create: `frontend/types/index.ts`

**Step 1: Create barrel export file**

```typescript
export * from './documents'
export * from './stacks'
export * from './upload'
```

**Step 2: Commit**

```bash
git add frontend/types/index.ts
git commit -m "feat(types): add stacks to barrel export"
```

---

## Task 6: Extract Shared Format Utility

**Files:**
- Create: `frontend/lib/format.ts`
- Modify: `frontend/components/documents/columns.tsx`

**Step 1: Create shared format utility**

```typescript
// frontend/lib/format.ts

/**
 * Format a date string as a relative date (Today, Yesterday, X days ago, or date).
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
```

**Step 2: Update documents columns to use shared utility**

```typescript
// frontend/components/documents/columns.tsx
// Replace the local formatRelativeDate function with:
import { formatRelativeDate } from '@/lib/format'

// Delete the local function definition (lines 17-24)
```

**Step 3: Commit**

```bash
git add frontend/lib/format.ts frontend/components/documents/columns.tsx
git commit -m "refactor: extract formatRelativeDate to shared utility"
```
