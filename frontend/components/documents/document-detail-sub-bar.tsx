'use client'

import { useState } from 'react'
import { SubBar } from '@/components/layout/sub-bar'
import { ActionButton } from '@/components/layout/action-button'
import { SearchFilterButton } from '@/components/layout/search-filter-button'
import { FilterPill } from '@/components/layout/filter-pill'
import { Separator } from '@/components/ui/separator'
import { DocumentDetailActions } from '@/components/documents/document-detail-actions'
import { BulkDeleteFieldsDialog } from '@/components/documents/bulk-delete-fields-dialog'
import { useDocumentDetailFilter } from '@/components/documents/document-detail-filter-context'
import * as Icons from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { StackSummary } from '@/types/stacks'

interface DocumentDetailSubBarProps {
  documentId: string
  assignedStacks: StackSummary[]
  filename: string
  extractedFields: Record<string, unknown> | null
  filePath: string | null
}

/**
 * Client component for document detail SubBar.
 * Receives server-fetched data (assignedStacks, filename, extractedFields) as props.
 * Uses context for client-side state (fieldSearch, selectedFieldIds).
 */
export function DocumentDetailSubBar({
  documentId,
  assignedStacks,
  filename,
  extractedFields,
  filePath,
}: DocumentDetailSubBarProps) {
  const {
    fieldSearch,
    setFieldSearch,
    selectedFieldCount,
    selectedFieldIds,
    clearFieldSelection
  } = useDocumentDetailFilter()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  return (
    <>
      <SubBar
        left={
          <>
            <SearchFilterButton
              value={fieldSearch}
              onChange={setFieldSearch}
              placeholder="Search fields..."
            />
            {fieldSearch && (
              <FilterPill
                icon={<Icons.Search className="size-full" />}
                label={`"${fieldSearch}"`}
                onRemove={() => setFieldSearch('')}
              />
            )}
          </>
        }
        right={
          <>
            {/* Field Selection Actions - only shows delete (no Add to Stack for fields) */}
            {selectedFieldCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {selectedFieldCount} selected
                </span>
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <ActionButton icon={<Icons.ChevronDown />}>
                          Actions
                        </ActionButton>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Bulk operations</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={selectedFieldIds.length === 0}
                      className="gap-2"
                    >
                      <Icons.Trash className="size-4" />
                      <span>Delete {selectedFieldCount === 1 ? 'field' : 'fields'}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {/* Separator when both field selection and document actions are shown */}
            {selectedFieldCount > 0 && (
              <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
            )}
            <DocumentDetailActions
              documentId={documentId}
              assignedStacks={assignedStacks}
              filename={filename}
              extractedFields={extractedFields}
              filePath={filePath}
            />
          </>
        }
      />

      <BulkDeleteFieldsDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        documentId={documentId}
        fieldIds={selectedFieldIds}
        extractedFields={extractedFields}
        onComplete={clearFieldSelection}
      />
    </>
  )
}
