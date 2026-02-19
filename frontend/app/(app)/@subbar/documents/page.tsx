'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterBar } from '@/components/layout/filter-bar'
import { SelectionActions } from '@/components/layout/selection-actions'
import { Separator } from '@/components/ui/separator'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'
import { useSelectedDocument } from '@/components/documents/selected-document-context'
import { usePreviewPanel } from '@/components/preview-panel/preview-panel-context'
import { DocumentDetailActions } from '@/components/documents/document-detail-actions'
import { useStacks } from '@/hooks/use-stacks'

/**
 * SubBar for documents list page.
 * Renders filter bar, selection actions, and document actions when previewed.
 * Search is now integrated into FilterButton dropdown.
 *
 * Right side states:
 * 1. No selection, no preview -> Empty (Upload is in sidebar)
 * 2. Checkboxes selected -> SelectionActions
 * 3. Document previewed (panel visible) -> DocumentDetailActions (Stacks, Edit, Export, Delete)
 * 4. Both selection AND preview -> SelectionActions | separator | DocumentDetailActions
 *
 * Note: Document actions only show when preview panel is visible (not collapsed).
 */
export default function DocumentsSubBar() {
  const { selectedCount, selectedIds, clearSelection } = useDocumentsFilter()
  const {
    selectedDocId,
    filename,
    filePath,
    assignedStacks,
    extractedFields,
  } = useSelectedDocument()
  const { isCollapsed } = usePreviewPanel()
  const { stacks } = useStacks()

  // Document actions only show when preview panel is visible
  const showDocumentActions = selectedDocId && filename && !isCollapsed

  return (
    <SubBar
      left={<FilterBar stacks={stacks} />}
      right={
        <div className="flex items-center gap-2">
          {/* Selection actions (when checkboxes selected) */}
          {selectedCount > 0 && (
            <SelectionActions
              selectedCount={selectedCount}
              selectedIds={selectedIds}
              onClearSelection={clearSelection}
            />
          )}

          {/* Separator when both selection and preview visible */}
          {selectedCount > 0 && showDocumentActions && (
            <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
          )}

          {/* Document actions (when preview panel is visible) */}
          {showDocumentActions && (
            <DocumentDetailActions
              documentId={selectedDocId}
              assignedStacks={assignedStacks}
              filename={filename}
              extractedFields={extractedFields}
              filePath={filePath}
            />
          )}
        </div>
      }
    />
  )
}
