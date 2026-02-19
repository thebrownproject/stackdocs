'use client'

import Link from 'next/link'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FileTypeIcon } from '@/components/shared/file-type-icon'
import { Badge } from '@/components/ui/badge'
import * as Icons from '@/components/icons'
import { formatRelativeDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StackDocument } from '@/types/stacks'
import { useState, useEffect } from 'react'

interface StackDocumentsTabProps {
  documents: StackDocument[]
  stackId: string // Reserved for future "Add Document" action
  searchFilter: string
  onSelectionChange?: (count: number) => void
}

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc') return <Icons.ArrowUp className="ml-2 size-3" />
  if (isSorted === 'desc') return <Icons.ArrowDown className="ml-2 size-3" />
  return (
    <Icons.ChevronsUpDown className="ml-2 size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
  )
}

const columns: ColumnDef<StackDocument>[] = [
  {
    id: 'select',
    header: ({ table }) => {
      const isAllSelected = table.getIsAllPageRowsSelected()
      const isSomeSelected = table.getIsSomePageRowsSelected()
      const tooltipText = isAllSelected ? 'Deselect all' : 'Select all'
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex h-full items-center">
              <Checkbox
                checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
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
      const tooltipText = isSelected ? 'Deselect row' : 'Select row'
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
  },
  {
    accessorKey: 'document.filename',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      const tooltipText = isSorted === 'asc' ? 'Order Z-A' : 'Order A-Z'
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(isSorted === 'asc')}
              className="-ml-3 group font-normal h-auto py-0"
            >
              Name
              <SortIcon isSorted={isSorted} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{tooltipText}</TooltipContent>
        </Tooltip>
      )
    },
    cell: ({ row }) => {
      const doc = row.original.document
      return (
        <div className="flex items-center gap-2 max-w-full -ml-px">
          <FileTypeIcon mimeType={doc.mime_type} className="shrink-0" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/documents/${doc.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium hover:underline truncate"
              >
                {doc.filename}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Open {doc.filename}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      return rowA.original.document.filename.localeCompare(rowB.original.document.filename)
    },
  },
  {
    accessorKey: 'document.status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.document.status === 'completed' ? 'secondary' : 'outline'
        }
      >
        {row.original.document.status}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'added_at',
    header: ({ column }) => {
      const isSorted = column.getIsSorted()
      const tooltipText = isSorted === 'asc' ? 'Order newest first' : 'Order oldest first'
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(isSorted === 'asc')}
              className="group font-normal h-auto py-0"
            >
              <SortIcon isSorted={isSorted} />
              Added
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{tooltipText}</TooltipContent>
        </Tooltip>
      )
    },
    cell: ({ row }) => (
      <div className="text-right text-muted-foreground pr-6">
        {formatRelativeDate(row.original.added_at)}
      </div>
    ),
  },
]

// _stackId reserved for future "Add Document" action
export function StackDocumentsTab({ documents, stackId: _stackId, searchFilter, onSelectionChange }: StackDocumentsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState({})

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: (row, _, filterValue) => {
      return row.original.document.filename
        .toLowerCase()
        .includes(filterValue.toLowerCase())
    },
    state: {
      globalFilter: searchFilter,
      sorting,
      rowSelection,
    },
  })

  // Notify parent of selection changes
  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  useEffect(() => {
    onSelectionChange?.(selectedCount)
  }, [selectedCount, onSelectionChange])

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="rounded-full bg-muted/50 p-4 mb-4">
          <Icons.Files className="size-8 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium">No documents in this stack</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add documents to start extracting data
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="bg-muted/30 hover:bg-muted/30 group/header"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-9 text-sm font-normal text-muted-foreground",
                    header.column.id === 'select' && "w-4",
                    header.column.id === 'added_at' && "w-24 text-right pr-5"
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="h-12 hover:bg-muted/30 group/row"
                data-state={row.getIsSelected() && 'selected'}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "py-3",
                      cell.column.id === 'select' && "w-4",
                      cell.column.id === 'document.filename' && "max-w-0",
                      cell.column.id === 'added_at' && "w-24"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <p className="text-sm text-muted-foreground">
                  No documents match your search
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
