import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { PageHeader } from '@/components/layout/page-header'
import { PreviewToggle } from '@/components/documents/preview-toggle'
import { FileTypeIcon } from '@/components/shared/file-type-icon'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Header slot for document detail page.
 * Uses same cached query as page for deduplication.
 */
export default async function DocumentHeaderSlot({ params }: PageProps) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  if (!document) {
    notFound()
  }

  return (
    <PageHeader
      title={document.filename}
      icon={<FileTypeIcon mimeType={document.mime_type} />}
      actions={<PreviewToggle />}
    />
  )
}
