import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { DocumentDetailClient } from '@/components/documents/document-detail-client'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  if (!document) {
    notFound()
  }

  // Signed URL fetched client-side for faster navigation
  return <DocumentDetailClient initialDocument={document} initialSignedUrl={null} />
}
