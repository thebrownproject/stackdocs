import { getDocumentsWithStacks } from '@/lib/queries/documents'
import { DocumentsTable } from '@/components/documents/documents-table'

export default async function DocumentsPage() {
  const documents = await getDocumentsWithStacks()

  return <DocumentsTable documents={documents} />
}
