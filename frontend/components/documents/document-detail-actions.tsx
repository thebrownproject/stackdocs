'use client'

import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { ExportDropdown } from '@/components/documents/export-dropdown'
import { DeleteDialog } from '@/components/documents/delete-dialog'
import { ActionButton } from '@/components/layout/action-button'
import * as Icons from '@/components/icons'

interface DocumentDetailActionsProps {
  documentId: string
  assignedStacks: Array<{ id: string; name: string }>
  filename: string
  extractedFields: Record<string, unknown> | null
  filePath: string | null
}

export function DocumentDetailActions({
  documentId,
  assignedStacks,
  filename,
  extractedFields,
  filePath,
}: DocumentDetailActionsProps) {
  return (
    <>
      <StacksDropdown documentId={documentId} assignedStacks={assignedStacks} />
      <ActionButton icon={<Icons.Edit />} tooltip="Edit document and extractions">
        Edit
      </ActionButton>
      <ExportDropdown filename={filename} extractedFields={extractedFields} />
      <DeleteDialog documentId={documentId} filename={filename} filePath={filePath} />
    </>
  )
}
