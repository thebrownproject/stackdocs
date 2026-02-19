"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  useReactTable,
  ExpandedState,
  RowSelectionState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { extractedColumns } from "./extracted-columns";
import { transformExtractedFields } from "@/lib/transform-extracted-fields";
import { useDocumentDetailFilter } from "@/components/documents/document-detail-filter-context";

interface ExtractedDataTableProps {
  fields: Record<string, unknown> | null;
  confidenceScores: Record<string, number> | null;
  changedFields?: Set<string>;
  searchFilter?: string;
}

export function ExtractedDataTable({
  fields,
  confidenceScores,
  changedFields = new Set(),
  searchFilter = "",
}: ExtractedDataTableProps) {
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Bidirectional selection sync with context
  const { setSelectedFieldIds, registerResetRowSelection } = useDocumentDetailFilter();

  // Register the reset callback on mount so context can clear table selection
  React.useEffect(() => {
    registerResetRowSelection(() => setRowSelection({}));
  }, [registerResetRowSelection]);

  const data = React.useMemo(
    () => transformExtractedFields(fields, confidenceScores),
    [fields, confidenceScores]
  );

  const table = useReactTable({
    data,
    columns: extractedColumns,
    enableRowSelection: (row) => row.original.depth === 0,
    onRowSelectionChange: setRowSelection,
    state: {
      expanded,
      globalFilter: searchFilter,
      rowSelection,
    },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const fieldName = row.original.field?.toLowerCase() ?? "";
      return fieldName.includes(filterValue.toLowerCase());
    },
  });

  // Sync selection to context when it changes
  React.useEffect(() => {
    const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);
    setSelectedFieldIds(selectedIds);
  }, [rowSelection, setSelectedFieldIds, table]);

  if (!fields || Object.keys(fields).length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No data extracted</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <Table className="table-fixed">
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
                    header.column.id === "select" && "w-6",
                    header.column.id === "field" && "w-[33%]"
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
        <TableBody className="[&_tr:last-child]:border-b">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              // Check if this row or its parent is in changedFields
              const rootId = row.original.id.split("-")[0];
              const isChanged = changedFields.has(rootId);

              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "h-12 hover:bg-muted/30 transition-colors group/row",
                    row.getCanExpand() && "cursor-pointer",
                    isChanged && "animate-highlight-fade"
                  )}
                  onClick={() => {
                    if (row.getCanExpand()) {
                      row.toggleExpanded();
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-3 whitespace-normal",
                        cell.column.id === "select" && "w-4",
                        cell.column.id === "field" && "w-[33%]"
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={extractedColumns.length}
                className="h-24 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  No data extracted
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
