"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import * as Icons from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileTypeIcon } from "@/components/shared/file-type-icon";
import { StackBadges } from "@/components/shared/stack-badges";
import { formatRelativeDate } from "@/lib/format";
import type { Document } from "@/types/documents";

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <Icons.ArrowUp className="ml-2 size-3" />;
  if (isSorted === "desc") return <Icons.ArrowDown className="ml-2 size-3" />;
  return (
    <Icons.ChevronsUpDown className="ml-2 size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
  );
}

export const columns: ColumnDef<Document>[] = [
  {
    id: "select",
    header: ({ table }) => {
      const isAllSelected = table.getIsAllPageRowsSelected();
      const isSomeSelected = table.getIsSomePageRowsSelected();
      const tooltipText = isAllSelected ? "Deselect all" : "Select all";
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
      );
    },
    cell: ({ row }) => {
      const isSelected = row.getIsSelected();
      const tooltipText = isSelected ? "Deselect row" : "Select row";
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
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "filename",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      const tooltipText = isSorted === "asc" ? "Order Z-A" : "Order A-Z";
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(isSorted === "asc")}
              className="-ml-3 group font-normal h-auto py-0"
            >
              Name
              <SortIcon isSorted={isSorted} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{tooltipText}</TooltipContent>
        </Tooltip>
      );
    },
    cell: ({ row }) => {
      const doc = row.original;
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
      );
    },
  },
  {
    accessorKey: "stacks",
    header: "Stacks",
    cell: ({ row }) => <StackBadges stacks={row.original.stacks} />,
    enableSorting: false,
  },
  {
    accessorKey: "uploaded_at",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      const tooltipText = isSorted === "asc" ? "Order newest first" : "Order oldest first";
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(isSorted === "asc")}
              className="group font-normal h-auto py-0"
            >
              <SortIcon isSorted={isSorted} />
              Date
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{tooltipText}</TooltipContent>
        </Tooltip>
      );
    },
    cell: ({ row }) => (
      <div className="text-right text-muted-foreground pr-6">
        {formatRelativeDate(row.original.uploaded_at)}
      </div>
    ),
  },
];
