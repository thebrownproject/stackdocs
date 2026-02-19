import { PageHeader } from '@/components/layout/page-header'
import { PreviewToggle } from '@/components/documents/preview-toggle'

/**
 * Header slot for documents list page.
 * Shows breadcrumb with preview toggle action.
 */
export default function DocumentsHeaderSlot() {
  return <PageHeader actions={<PreviewToggle />} />
}
