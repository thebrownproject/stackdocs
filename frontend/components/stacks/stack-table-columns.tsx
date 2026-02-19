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
