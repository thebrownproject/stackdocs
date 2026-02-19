import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { DocumentDetailSubBar } from '@/components/documents/document-detail-sub-bar'

interface DocumentDetailSubBarPageProps {
  params: Promise<{ id: string }>
}

/**
 * Server component for document detail SubBar.
 * Fetches document data (cached) and renders the client SubBar component.
 * Uses getDocumentWithExtraction which is already cached and deduped with the main page.
 */
export default async function DocumentDetailSubBarPage({ params }: DocumentDetailSubBarPageProps) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  // Fallback to empty values if document not found (shouldn't happen in normal flow)
  const filename = document?.filename ?? ''
  const extractedFields = document?.extracted_fields ?? null
  const assignedStacks = document?.stacks ?? []
  const filePath = document?.file_path ?? null

  return (
    <DocumentDetailSubBar
      documentId={id}
      assignedStacks={assignedStacks}
      filename={filename}
      extractedFields={extractedFields}
      filePath={filePath}
    />
  )
}
