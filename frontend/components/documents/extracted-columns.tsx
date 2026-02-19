"use client";

import { ColumnDef } from "@tanstack/react-table";
import * as Icons from "@/components/icons";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ExtractedFieldRow } from "@/lib/transform-extracted-fields";

function ConfidenceDot({ confidence }: { confidence?: number }) {
  // No confidence data - show neutral gray dot (no tooltip)
  if (confidence === undefined) {
    return (
      <div className="size-2.5 rounded-full shrink-0 mr-0.5 bg-muted-foreground/30" />
    );
  }

  const percentage = Math.round(confidence * 100);
  const colorClass =
    percentage >= 90
      ? "bg-emerald-500"
      : percentage >= 70
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className={cn("size-2.5 rounded-full shrink-0 mr-0.5", colorClass)} />
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{percentage}% confidence</p>
      </TooltipContent>
    </Tooltip>
  );
}

export const extractedColumns: ColumnDef<ExtractedFieldRow>[] = [
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
      // Don't render checkbox for child rows
      if (row.original.depth > 0) {
        return null;
      }

      const isSelected = row.getIsSelected();
      const tooltipText = isSelected ? "Deselect row" : "Select row";
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex h-full items-center">
              <Checkbox
                checked={isSelected}
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
    accessorKey: "field",
    header: () => <span className="text-muted-foreground">Field</span>,
    cell: ({ row }) => {
      const depth = row.original.depth;
      const canExpand = row.getCanExpand();
      const isExpanded = row.getIsExpanded();
      const confidence = row.original.confidence;

      return (
        <div className="flex items-center gap-2">
          {/* Indicator: chevron for expandable, confidence dot for leaf */}
          {canExpand ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    row.toggleExpanded();
                  }}
                  className="py-0.5 pl-0.5 -ml-1 -mr-0 hover:bg-muted rounded shrink-0"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <Icons.ChevronDown className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Icons.ChevronRight className="size-3.5 text-muted-foreground" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isExpanded ? "Collapse" : "Expand"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <ConfidenceDot confidence={confidence} />
          )}
          <span
            className={cn(
              depth === 0 ? "font-medium" : "text-muted-foreground"
            )}
          >
            {row.original.field}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "displayValue",
    header: () => <span className="text-muted-foreground">Value</span>,
    cell: ({ row }) => {
      const { displayValue, dataShape } = row.original;

      // For string arrays shown inline
      if (dataShape === "string-array" && row.original.depth > 0) {
        return (
          <span className="text-sm text-muted-foreground">{displayValue}</span>
        );
      }

      // For primitives (currency, numbers, etc.)
      if (dataShape === "primitive") {
        const isCurrency =
          typeof displayValue === "string" &&
          /^\$?[\d,]+\.?\d*$/.test(displayValue);
        return (
          <span
            className={cn(
              "text-sm",
              isCurrency ? "font-mono tabular-nums" : ""
            )}
          >
            {displayValue || "—"}
          </span>
        );
      }

      // Summary for expandable rows
      return (
        <span className="text-sm text-muted-foreground">{displayValue}</span>
      );
    },
  },
];
