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
