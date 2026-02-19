# Stack Tables Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **Prerequisite**: Complete `01-foundation.md` first. This plan depends on the types defined there.

**Goal:** Create the table view component with dynamic columns, "not extracted" indicator, and CSV export.

**Architecture:** TanStack Table with columns generated from `stack_tables.columns` schema. Rows show extraction status per document. Column definitions are separated into their own file following the existing `documents/columns.tsx` pattern.

**Tech Stack:** TanStack Table v8, shadcn/ui

---

## Task 1: Create Stack Table Column Definitions

**Files:**
- Create: `frontend/components/stacks/stack-table-columns.tsx`

**Step 1: Create column definitions file with SortIcon helper and ConfidenceDot**

> **Pattern note**: This follows the column definition pattern from `frontend/components/documents/columns.tsx` and reuses the `ConfidenceDot` pattern from `frontend/components/documents/extracted-columns.tsx`.

```typescript
// frontend/components/stacks/stack-table-columns.tsx
"use client"

import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import * as Icons from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { StackTableRow, StackTableColumn } from "@/types/stacks"

/**
 * SortIcon helper - matches pattern from documents/columns.tsx
 */
function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <Icons.ArrowUp className="ml-2 size-3" />
  if (isSorted === "desc") return <Icons.ArrowDown className="ml-2 size-3" />
  return (
    <Icons.ChevronsUpDown className="ml-2 size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
  )
}

/**
 * ConfidenceDot - color-coded confidence indicator
 * Matches pattern from documents/extracted-columns.tsx
 */
function ConfidenceDot({ confidence }: { confidence?: number }) {
  // No confidence data - show neutral gray dot (no tooltip)
  if (confidence === undefined) {
    return (
      <div className="size-2.5 rounded-full shrink-0 mr-0.5 bg-muted-foreground/30" />
    )
  }

  const percentage = Math.round(confidence * 100)
  const colorClass =
    percentage >= 90
      ? "bg-emerald-500"
      : percentage >= 70
      ? "bg-amber-500"
      : "bg-red-500"

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className={cn("size-2.5 rounded-full shrink-0 mr-0.5", colorClass)} />
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{percentage}% confidence</p>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Select column - matches pattern from documents/columns.tsx
 */
const selectColumn: ColumnDef<StackTableRow> = {
  id: "select",
  header: ({ table }) => {
    const isAllSelected = table.getIsAllPageRowsSelected()
    const isSomeSelected = table.getIsSomePageRowsSelected()
    const tooltipText = isAllSelected ? "Deselect all" : "Select all"
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex h-full items-center">
            <Checkbox
              checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
              className="opacity-0 group-hover/header:opacity-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100 transition-opacity"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">{tooltipText}</TooltipContent>
      </Tooltip>
    )
  },
  cell: ({ row }) => {
    const isSelected = row.getIsSelected()
    const tooltipText = isSelected ? "Deselect row" : "Select row"
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex h-full items-center">
            <Checkbox
              checked={isSelected}
              disabled={!row.getCanSelect()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover/row:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">{tooltipText}</TooltipContent>
      </Tooltip>
    )
  },
  enableSorting: false,
  enableHiding: false,
}

/**
 * Document column - links to document detail page
 */
const documentColumn: ColumnDef<StackTableRow> = {
  id: "document",
  accessorKey: "document.filename",
  header: ({ column }) => {
    const isSorted = column.getIsSorted()
    const tooltipText = isSorted === "asc" ? "Order Z-A" : "Order A-Z"
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(isSorted === "asc")}
            className="-ml-3 group font-normal h-auto py-0"
          >
            Document
            <SortIcon isSorted={isSorted} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{tooltipText}</TooltipContent>
      </Tooltip>
    )
  },
  cell: ({ row }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/documents/${row.original.document_id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium hover:underline truncate max-w-[200px] block"
        >
          {row.original.document.filename}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>Open {row.original.document.filename}</p>
      </TooltipContent>
    </Tooltip>
  ),
}

/**
 * Creates dynamic columns from the stack table schema.
 * Returns column definitions including select, document, and data columns.
 */
export function createStackTableColumns(
  schema: StackTableColumn[] | null
): ColumnDef<StackTableRow>[] {
  const baseColumns: ColumnDef<StackTableRow>[] = [selectColumn, documentColumn]

  if (!schema || schema.length === 0) {
    return baseColumns
  }

  const dataColumns: ColumnDef<StackTableRow>[] = schema.map((col) => ({
    id: col.name,
    accessorFn: (row) => row.row_data?.[col.name] ?? null,
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      const tooltipText = isSorted === "asc" ? "Order Z-A" : "Order A-Z"
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(isSorted === "asc")}
              className="-ml-3 group font-normal h-auto py-0"
            >
              {col.name}
              <SortIcon isSorted={isSorted} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{tooltipText}</TooltipContent>
        </Tooltip>
      )
    },
    cell: ({ row }) => {
      const value = row.original.row_data?.[col.name] ?? null
      const confidence = row.original.confidence_scores?.[col.name]

      if (value === null || value === undefined) {
        return <span className="text-muted-foreground italic">—</span>
      }

      return (
        <div className="flex items-center gap-1.5">
          <ConfidenceDot confidence={confidence} />
          <span className="truncate max-w-[200px]">{String(value)}</span>
        </div>
      )
    },
  }))

  return [...baseColumns, ...dataColumns]
}
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/stack-table-columns.tsx
git commit -m "feat(stacks): create stack table column definitions"
```

---

## Task 2: Create Stack Table View Component

**Files:**
- Create: `frontend/components/stacks/stack-table-view.tsx`

**Step 1: Implement table view using imported columns**

```typescript
// frontend/components/stacks/stack-table-view.tsx
'use client'

import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  RowSelectionState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { createStackTableColumns } from './stack-table-columns'
import type { StackTable, StackTableRow } from '@/types/stacks'

interface StackTableViewProps {
  table: StackTable
  rows: StackTableRow[]
  searchFilter: string
}

export function StackTableView({ table: tableSchema, rows, searchFilter }: StackTableViewProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const columns = React.useMemo(
    () => createStackTableColumns(tableSchema.columns),
    [tableSchema.columns]
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    globalFilterFn: (row, _, filterValue) => {
      const filename = row.original.document.filename.toLowerCase()
      const rowData = JSON.stringify(row.original.row_data).toLowerCase()
      return filename.includes(filterValue.toLowerCase()) || rowData.includes(filterValue.toLowerCase())
    },
    state: {
      sorting,
      rowSelection,
      globalFilter: searchFilter,
    },
  })

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="rounded-full bg-muted/50 p-4 mb-4">
          <Icons.Table className="size-8 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium">No data extracted yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add documents and extract data to populate this table
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30 group/header">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-9 text-sm font-normal text-muted-foreground",
                    header.column.id === "select" && "w-4"
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-b">
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              className="h-12 hover:bg-muted/30 transition-colors group/row"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    "py-3",
                    cell.column.id === "select" && "w-4"
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/stack-table-view.tsx
git commit -m "feat(stacks): create table view with dynamic columns"
```

---

## Task 3: Add "Not Extracted" Indicator

**Files:**
- Modify: `frontend/components/stacks/stack-table-view.tsx`
- Modify: `frontend/components/stacks/stack-detail-client.tsx`

**Step 1: Update stack-table-view.tsx with pending indicator**

Replace the entire file with (adds `Button`, `StackDocument` imports and pending row):

```typescript
// frontend/components/stacks/stack-table-view.tsx
'use client'

import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  RowSelectionState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { createStackTableColumns } from './stack-table-columns'
import type { StackTable, StackTableRow, StackDocument } from '@/types/stacks'

interface StackTableViewProps {
  table: StackTable
  rows: StackTableRow[]
  pendingDocuments?: StackDocument[]
  searchFilter: string
  onExtractPending?: () => void
}

export function StackTableView({
  table: tableSchema,
  rows,
  pendingDocuments,
  searchFilter,
  onExtractPending,
}: StackTableViewProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const columns = React.useMemo(
    () => createStackTableColumns(tableSchema.columns),
    [tableSchema.columns]
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    globalFilterFn: (row, _, filterValue) => {
      const filename = row.original.document.filename.toLowerCase()
      const rowData = JSON.stringify(row.original.row_data).toLowerCase()
      return filename.includes(filterValue.toLowerCase()) || rowData.includes(filterValue.toLowerCase())
    },
    state: {
      sorting,
      rowSelection,
      globalFilter: searchFilter,
    },
  })

  const hasPending = pendingDocuments && pendingDocuments.length > 0

  if (rows.length === 0 && !hasPending) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="rounded-full bg-muted/50 p-4 mb-4">
          <Icons.Table className="size-8 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium">No data extracted yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add documents and extract data to populate this table
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30 group/header">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-9 text-sm font-normal text-muted-foreground",
                    header.column.id === "select" && "w-4"
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-b">
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              className="h-12 hover:bg-muted/30 transition-colors group/row"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    "py-3",
                    cell.column.id === "select" && "w-4"
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {hasPending && (
            <TableRow className="bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10">
              <TableCell colSpan={columns.length} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Icons.Clock className="size-4" />
                    <span className="text-sm">
                      {pendingDocuments.length} document{pendingDocuments.length !== 1 ? 's' : ''} pending extraction
                    </span>
                  </div>
                  {onExtractPending && (
                    <Button size="sm" variant="outline" onClick={onExtractPending}>
                      Extract Now
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Update stack-detail-client.tsx to pass pendingDocuments**

In `stack-detail-client.tsx`, add the pending documents calculation and pass to StackTableView:

```typescript
// Add inside StackDetailClient component, after activeTable/tableRows declarations:
const pendingDocuments = React.useMemo(() => {
  if (!activeTable || !tableRows) return []
  const documentsInTable = new Set(tableRows.map(r => r.document_id))
  return stack.documents.filter(d => !documentsInTable.has(d.document_id))
}, [activeTable, tableRows, stack.documents])

// Update the StackTableView call to include pendingDocuments:
{isTableActive && tableRows && (
  <StackTableView
    table={activeTable}
    rows={tableRows}
    pendingDocuments={pendingDocuments}
    searchFilter={searchFilter}
  />
)}
```

**Step 3: Commit**

```bash
git add frontend/components/stacks/stack-table-view.tsx frontend/components/stacks/stack-detail-client.tsx
git commit -m "feat(stacks): add pending extraction indicator"
```

---

## Task 4: Add CSV Export Functionality

**Files:**
- Create: `frontend/lib/export-csv.ts`
- Modify: `frontend/components/stacks/stack-detail-client.tsx`

**Step 1: Create CSV export utility**

```typescript
// frontend/lib/export-csv.ts

import type { StackTableRow, StackTableColumn } from '@/types/stacks'

export function exportTableToCsv(
  tableName: string,
  columns: StackTableColumn[],
  rows: StackTableRow[]
): void {
  // Build header row
  const headers = ['Document', ...columns.map(c => c.name)]

  // Build data rows
  const dataRows = rows.map(row => {
    const values = [
      row.document.filename,
      ...columns.map(col => {
        const value = row.row_data?.[col.name] ?? null
        if (value === null || value === undefined) return ''
        if (typeof value === 'object') return JSON.stringify(value)
        return String(value)
      })
    ]
    return values
  })

  // Combine and escape for CSV
  const csvContent = [headers, ...dataRows]
    .map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma/quote/newline
      const escaped = String(cell).replace(/"/g, '""')
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped}"`
      }
      return escaped
    }).join(','))
    .join('\n')

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${tableName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

**Step 2: Wire up export button**

```typescript
// In stack-detail-client.tsx, update the Export button
{isTableActive && (
  <Button
    variant="outline"
    size="sm"
    className="gap-1.5"
    onClick={() => {
      if (activeTable?.columns && tableRows) {
        exportTableToCsv(activeTable.name, activeTable.columns, tableRows)
      }
    }}
  >
    <Icons.Download className="size-4" />
    Export CSV
  </Button>
)}
```

**Step 3: Commit**

```bash
git add frontend/lib/export-csv.ts frontend/components/stacks/stack-detail-client.tsx
git commit -m "feat(stacks): add CSV export functionality"
```

---

## Task 5: Create Stacks Component Index

**Files:**
- Create: `frontend/components/stacks/index.ts`

**Step 1: Create barrel export**

```typescript
// frontend/components/stacks/index.ts
export { StackDetailClient } from './stack-detail-client'
export { StackDocumentsTab } from './stack-documents-tab'
export { StackTableView } from './stack-table-view'
export { createStackTableColumns } from './stack-table-columns'
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/index.ts
git commit -m "feat(stacks): add component barrel export"
```
