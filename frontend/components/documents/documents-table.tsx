"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ColumnFiltersState,
  SortingState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { getDateRangeBounds, isDateInRange } from "@/lib/date";
import { columns } from "./columns";
import { usePreviewPanel } from "@/components/preview-panel/preview-panel-context";
import { useSelectedDocument } from "./selected-document-context";
import { useDocumentsFilter } from "./documents-filter-context";
import type { Document } from "@/types/documents";
import * as Icons from "@/components/icons";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/layout/action-button";
import { useAgentStore, initialUploadData } from "@/components/agent";

interface DocumentsTableProps {
  documents: Document[];
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Auth for Supabase client
  const { getToken } = useAuth();

  // Shared state from contexts
  const {
    selectedDocId,
    setSelectedDocId,
    setSignedUrl,
    setSignedUrlDocId,
    setMimeType,
    setOcrText,
    signedUrlDocId,
    setDocumentMetadata,
    setExtractedFields,
    setIsLoadingExtraction,
  } = useSelectedDocument();
  const { panelRef, isCollapsed } = usePreviewPanel();
  const {
    filterValue,
    setSelectedIds,
    registerResetRowSelection,
    dateRange,
    stackFilter,
    clearFilters,
  } = useDocumentsFilter();
  const openFlow = useAgentStore((state) => state.openFlow);

  // Apply date and stack filters to documents
  const filteredDocuments = React.useMemo(() => {
    let result = documents;

    // Apply date filter
    if (dateRange !== "all") {
      const [start, end] = getDateRangeBounds(dateRange);
      result = result.filter((doc) =>
        isDateInRange(new Date(doc.uploaded_at), start, end)
      );
    }

    // Apply stack filter (if any selected)
    if (stackFilter.size > 0) {
      result = result.filter((doc) =>
        doc.stacks.some((stack) => stackFilter.has(stack.id))
      );
    }

    return result;
  }, [documents, dateRange, stackFilter]);

  // Create table first so we can use it in effects
  const table = useReactTable({
    data: filteredDocuments,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  });

  // Find selected document from documents array
  const selectedDoc = React.useMemo(() => {
    if (!selectedDocId) return null;
    return documents.find((d) => d.id === selectedDocId) ?? null;
  }, [selectedDocId, documents]);

  // Sync filter value from context to table column filters
  React.useEffect(() => {
    setColumnFilters((prev) => {
      const other = prev.filter((f) => f.id !== "filename");
      if (filterValue) {
        return [...other, { id: "filename", value: filterValue }];
      }
      return other;
    });
  }, [filterValue]);

  // Register reset function so context can clear table selection (bidirectional sync)
  React.useEffect(() => {
    registerResetRowSelection(() => setRowSelection({}));
  }, [registerResetRowSelection]);

  // Derive selected IDs with stable reference (only changes when selection changes)
  const selectedIdsList = React.useMemo(
    () => table.getFilteredSelectedRowModel().rows.map((row) => row.original.id),
    [table.getFilteredSelectedRowModel().rows]
  );

  // Sync selection to context when it changes
  React.useEffect(() => {
    setSelectedIds(selectedIdsList);
  }, [selectedIdsList, setSelectedIds]);

  // Fetch signed URL, OCR text, and extraction when selected document changes
  // Uses signedUrlDocId to avoid re-fetching for the same document
  React.useEffect(() => {
    if (!selectedDocId) {
      setSignedUrl(null);
      setSignedUrlDocId(null);
      setMimeType("");
      setOcrText(null);
      return;
    }

    // Set mime type immediately from local document data
    if (selectedDoc?.mime_type) {
      setMimeType(selectedDoc.mime_type);
    }

    // Set document metadata immediately from local document data
    if (selectedDoc) {
      setDocumentMetadata({
        filename: selectedDoc.filename,
        filePath: selectedDoc.file_path,
        assignedStacks: selectedDoc.stacks || [],
        fileSize: selectedDoc.file_size_bytes,
        pageCount: null,  // Set when PDF loads in preview panel
      });
    }

    // Skip fetch if we already have a signed URL for this document
    if (signedUrlDocId === selectedDocId) {
      return;
    }

    let isCancelled = false;

    const fetchPreviewData = async () => {
      try {
        const supabase = createClerkSupabaseClient(getToken);

        // Start loading extraction
        setIsLoadingExtraction(true);

        // Fetch signed URL, OCR text, and extraction in parallel
        const [urlResult, ocrResult, extractionResult] = await Promise.all([
          selectedDoc?.file_path
            ? supabase.storage
                .from("documents")
                .createSignedUrl(selectedDoc.file_path, 3600)
            : Promise.resolve({ data: null }),
          supabase
            .from("ocr_results")
            .select("raw_text")
            .eq("document_id", selectedDocId)
            .maybeSingle(),
          supabase
            .from("extractions")
            .select("extracted_fields")
            .eq("document_id", selectedDocId)
            .maybeSingle(),
        ]);

        if (!isCancelled) {
          setSignedUrl(urlResult.data?.signedUrl ?? null);
          setSignedUrlDocId(selectedDocId);
          setOcrText(ocrResult.data?.raw_text ?? null);
          setExtractedFields(extractionResult.data?.extracted_fields ?? null);
          setIsLoadingExtraction(false);
        }
      } catch (error) {
        console.error("Failed to fetch preview data:", error);
        if (!isCancelled) {
          setSignedUrl(null);
          setSignedUrlDocId(null);
          setOcrText(null);
          setExtractedFields(null);
          setIsLoadingExtraction(false);
        }
      }
    };

    fetchPreviewData();

    return () => {
      isCancelled = true;
    };
  }, [
    selectedDocId,
    selectedDoc?.file_path,
    selectedDoc?.mime_type,
    selectedDoc?.filename,
    selectedDoc?.stacks,
    signedUrlDocId,
    getToken,
    setSignedUrl,
    setSignedUrlDocId,
    setMimeType,
    setOcrText,
    setDocumentMetadata,
    setExtractedFields,
    setIsLoadingExtraction,
  ]);

  // Note: We intentionally do NOT clear selection when preview collapses
  // This allows the user to toggle preview and see the same document again

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Documents table - SubBar rendered by @subbar parallel route */}
      <div className="flex-1 overflow-auto">
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
                      header.column.id === "select" && "w-4",
                      header.column.id === "uploaded_at" &&
                        "w-24 text-right pr-5"
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "h-12 hover:bg-muted/30 transition-colors duration-150 group/row",
                    selectedDocId === row.original.id &&
                      !isCollapsed &&
                      "bg-muted/50"
                  )}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => {
                    if (selectedDocId === row.original.id) {
                      // Same row clicked - toggle the panel
                      if (panelRef.current?.isCollapsed()) {
                        panelRef.current?.expand();
                      } else {
                        panelRef.current?.collapse();
                      }
                    } else {
                      // Different row clicked - select and ensure panel is open
                      setSelectedDocId(row.original.id);
                      if (panelRef.current?.isCollapsed()) {
                        panelRef.current?.expand();
                      }
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-3",
                        cell.column.id === "select" && "w-4",
                        cell.column.id === "filename" && "max-w-0",
                        cell.column.id === "stacks" && "max-w-0",
                        cell.column.id === "uploaded_at" && "w-24"
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : documents.length === 0 ? (
              // Truly empty - no documents uploaded
              <TableRow className="hover:bg-transparent !border-0">
                <TableCell colSpan={columns.length} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
                    <Icons.Files className="size-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      No documents uploaded
                    </p>
                    <ActionButton
                      icon={<Icons.Upload />}
                      onClick={() =>
                        openFlow({
                          type: "upload",
                          step: "dropzone",
                          data: initialUploadData,
                        })
                      }
                    >
                      Upload
                    </ActionButton>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Has documents but filtered to zero
              <TableRow className="hover:bg-transparent !border-0">
                <TableCell colSpan={columns.length} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
                    <Icons.FilterExclamation className="size-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No results for current filters</p>
                    <ActionButton icon={<Icons.FilterX />} onClick={clearFilters}>
                      Clear
                    </ActionButton>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
