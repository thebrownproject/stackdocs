# Stack Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **Prerequisite**: Complete `01-foundation.md` first. This plan depends on the types and queries defined there.

> **Note**: Ensure `01-foundation.md` Task 4 includes the `Table` icon export: `export { IconTable2 as Table } from '@tabler/icons-react'`

**Goal:** Create stacks list page and stack detail page with Documents/Tables tabs.

**Architecture:** Server components for data fetching, client components for interactivity. Uses parallel routes for headers like documents pages.

**Tech Stack:** Next.js 16 App Router, TanStack Table, shadcn/ui

---

## Task 1: Create Stacks List Page

**Files:**
- Modify: `frontend/app/(app)/stacks/page.tsx`

**Step 1: Implement stacks list page**

```typescript
// frontend/app/(app)/stacks/page.tsx
import Link from 'next/link'
import { getStacksWithCounts } from '@/lib/queries/stacks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import * as Icons from '@/components/icons'

export default async function StacksPage() {
  const stacks = await getStacksWithCounts()

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4">
        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm text-muted-foreground">
            {stacks.length} stack{stacks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 mr-2">
          <Link
            href="/stacks/new"
            className="inline-flex items-center gap-2 rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
          >
            <Icons.Plus className="size-4" />
            New Stack
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {stacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-4">
              <Icons.Stack className="size-8 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium">No stacks yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Create a stack to group related documents and extract data in bulk
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stacks.map((stack) => (
              <Link key={stack.id} href={`/stacks/${stack.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icons.Stack className="size-5 text-muted-foreground" />
                      <CardTitle className="text-base">{stack.name}</CardTitle>
                    </div>
                    {stack.description && (
                      <CardDescription className="line-clamp-2">
                        {stack.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Icons.Files className="size-4" />
                        <span>{stack.document_count} docs</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icons.Table className="size-4" />
                        <span>{stack.table_count} tables</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/app/(app)/stacks/page.tsx
git commit -m "feat(stacks): implement stacks list page"
```

---

## Task 2: Create Stack Header Parallel Routes

**Files:**
- Create: `frontend/app/(app)/@header/stacks/page.tsx`
- Create: `frontend/app/(app)/@header/stacks/default.tsx`
- Create: `frontend/app/(app)/@header/stacks/[id]/page.tsx`
- Create: `frontend/app/(app)/@header/stacks/[id]/default.tsx`

> **Note**: Uses existing `PageHeader` component which auto-generates breadcrumbs from pathname. This matches the pattern in `@header/documents/`.

**Step 1: Create stacks list header**

```typescript
// frontend/app/(app)/@header/stacks/page.tsx
import { PageHeader } from '@/components/layout/page-header'

export default function StacksHeader() {
  return <PageHeader />
}
```

**Step 2: Create default export**

```typescript
// frontend/app/(app)/@header/stacks/default.tsx
import { PageHeader } from '@/components/layout/page-header'

export default function StacksHeaderDefault() {
  return <PageHeader />
}
```

**Step 3: Create stack detail header**

```typescript
// frontend/app/(app)/@header/stacks/[id]/page.tsx
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

  return <PageHeader title={stack.name} icon={<Icons.Stack className="size-4" />} />
}
```

**Step 4: Create detail default**

```typescript
// frontend/app/(app)/@header/stacks/[id]/default.tsx
export { default } from './page'
```

**Step 5: Commit**

```bash
git add frontend/app/(app)/@header/stacks/
git commit -m "feat(stacks): add header parallel routes"
```

---

## Task 3: Create Stack Detail Page

**Files:**
- Create: `frontend/app/(app)/stacks/[id]/page.tsx`

**Step 1: Implement stack detail server component**

```typescript
// frontend/app/(app)/stacks/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getStackWithDetails, getStackTableRows } from '@/lib/queries/stacks'
import { StackDetailClient } from '@/components/stacks/stack-detail-client'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; table?: string }>
}

export default async function StackDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { tab, table: tableId } = await searchParams

  const stack = await getStackWithDetails(id)
  if (!stack) notFound()

  let tableRows = null
  const activeTable = tableId ? stack.tables.find(t => t.id === tableId) : null

  if (activeTable) {
    tableRows = await getStackTableRows(activeTable.id)
  }

  return (
    <StackDetailClient
      stack={stack}
      activeTab={tab || 'documents'}
      activeTable={activeTable}
      tableRows={tableRows}
    />
  )
}
```

**Step 2: Commit**

```bash
git add frontend/app/(app)/stacks/[id]/page.tsx
git commit -m "feat(stacks): create stack detail page"
```

---

## Task 4: Create Stack Detail Client Component

**Files:**
- Create: `frontend/components/stacks/stack-detail-client.tsx`

> **Note**: This component imports `StackTableView` which is defined in `03-stack-tables.md`. Until that plan is executed, the table view will not render.

**Step 1: Implement client component with tabs**

```typescript
// frontend/components/stacks/stack-detail-client.tsx
'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SubBar } from '@/components/layout/sub-bar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { StackDocumentsTab } from './stack-documents-tab'
import { StackTableView } from './stack-table-view' // Defined in 03-stack-tables.md
import * as Icons from '@/components/icons'
import type { StackWithDetails, StackTable, StackTableRow } from '@/types/stacks'

interface StackDetailClientProps {
  stack: StackWithDetails
  activeTab: string
  activeTable: StackTable | null
  tableRows: StackTableRow[] | null
}

const MAX_VISIBLE_TABS = 3

export function StackDetailClient({
  stack, activeTab, activeTable, tableRows,
}: StackDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchFilter, setSearchFilter] = React.useState('')

  React.useEffect(() => {
    localStorage.setItem(`stack-${stack.id}-view`, activeTab)
  }, [stack.id, activeTab])

  const handleTabChange = (tab: string, tableId?: string) => {
    setSearchFilter('') // Reset search when changing tabs
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    if (tableId) params.set('table', tableId)
    else params.delete('table')
    router.push(`/stacks/${stack.id}?${params.toString()}`)
  }

  const visibleTables = stack.tables.slice(0, MAX_VISIBLE_TABS)
  const overflowTables = stack.tables.slice(MAX_VISIBLE_TABS)
  const isDocumentsActive = activeTab === 'documents'
  const isTableActive = activeTab === 'table' && activeTable

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <SubBar
        left={
          <div className="flex items-center gap-1">
            <Button
              variant={isDocumentsActive ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleTabChange('documents')}
              className="gap-1.5"
            >
              <Icons.Files className="size-4" />
              Docs
            </Button>

            {visibleTables.map((table) => (
              <Button
                key={table.id}
                variant={activeTable?.id === table.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange('table', table.id)}
                className="gap-1.5 max-w-[120px]"
              >
                <Icons.Table className="size-4" />
                <span className="truncate">{table.name}</span>
              </Button>
            ))}

            {overflowTables.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <Icons.ChevronDown className="size-4" />
                    {overflowTables.length} more
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {overflowTables.map((table) => (
                    <DropdownMenuItem
                      key={table.id}
                      onClick={() => handleTabChange('table', table.id)}
                    >
                      <Icons.Table className="size-4 mr-2" />
                      {table.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <Icons.Plus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create table</TooltipContent>
            </Tooltip>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <ExpandableSearch
              value={searchFilter}
              onChange={setSearchFilter}
              placeholder={isDocumentsActive ? 'Search documents...' : 'Search table...'}
            />
            {isDocumentsActive && (
              <Button variant="outline" size="sm" className="gap-1.5">
                <Icons.Plus className="size-4" />
                Add Document
              </Button>
            )}
            {isTableActive && (
              <Button variant="outline" size="sm" className="gap-1.5">
                <Icons.Download className="size-4" />
                Export CSV
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {isDocumentsActive && (
          <StackDocumentsTab
            documents={stack.documents}
            stackId={stack.id}
            searchFilter={searchFilter}
          />
        )}
        {isTableActive && tableRows && (
          <StackTableView
            table={activeTable}
            rows={tableRows}
            searchFilter={searchFilter}
          />
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/stack-detail-client.tsx
git commit -m "feat(stacks): create stack detail client with tabs"
```

---

## Task 5: Create Stack Documents Tab

**Files:**
- Create: `frontend/components/stacks/stack-documents-tab.tsx`

**Step 1: Implement documents tab**

```typescript
// frontend/components/stacks/stack-documents-tab.tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, useReactTable,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileTypeIcon } from '@/components/shared/file-type-icon'
import { Badge } from '@/components/ui/badge'
import * as Icons from '@/components/icons'
import { formatRelativeDate } from '@/lib/format'
import type { StackDocument } from '@/types/stacks'

interface StackDocumentsTabProps {
  documents: StackDocument[]
  stackId: string // Reserved for future "Add Document" action
  searchFilter: string
}

const columns: ColumnDef<StackDocument>[] = [
  {
    accessorKey: 'document.filename',
    header: 'Name',
    cell: ({ row }) => {
      const doc = row.original.document
      return (
        <div className="flex items-center gap-2">
          <FileTypeIcon mimeType={doc.mime_type} className="shrink-0" />
          <Link href={`/documents/${doc.id}`} className="font-medium hover:underline truncate">
            {doc.filename}
          </Link>
        </div>
      )
    },
  },
  {
    accessorKey: 'document.status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.document.status === 'completed' ? 'secondary' : 'outline'}>
        {row.original.document.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'added_at',
    header: 'Added',
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatRelativeDate(row.original.added_at)}</span>
    ),
  },
]

export function StackDocumentsTab({ documents, stackId, searchFilter }: StackDocumentsTabProps) {
  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _, filterValue) => {
      return row.original.document.filename.toLowerCase().includes(filterValue.toLowerCase())
    },
    state: { globalFilter: searchFilter },
  })

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="rounded-full bg-muted/50 p-4 mb-4">
          <Icons.Files className="size-8 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium">No documents in this stack</p>
        <p className="text-xs text-muted-foreground mt-1">Add documents to start extracting data</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="h-9 text-sm font-normal text-muted-foreground">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="h-12 hover:bg-muted/30">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <p className="text-sm text-muted-foreground">No documents match your search</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/stack-documents-tab.tsx
git commit -m "feat(stacks): create documents tab component"
```
