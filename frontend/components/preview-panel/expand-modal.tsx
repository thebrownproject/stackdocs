'use client'

import dynamic from 'next/dynamic'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { PageNavigation } from './page-navigation'
import { TextContent } from './text-content'
import { usePageKeyboardNav } from './hooks/use-page-keyboard-nav'
import * as Icons from '@/components/icons'

// Dynamic import to avoid SSR issues with react-pdf
// Loading is handled inside PdfContent itself
const PdfContent = dynamic(
  () => import('./pdf-content').then((mod) => ({ default: mod.PdfContent })),
  { ssr: false }
)

interface ExpandModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfUrl: string | null
  activeTab: 'pdf' | 'text'
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onPdfLoad: (info: { numPages: number }) => void
  ocrText: string | null
  filename: string
  onDownload: () => void
}

export function ExpandModal({
  open,
  onOpenChange,
  pdfUrl,
  activeTab,
  currentPage,
  totalPages,
  onPageChange,
  onPdfLoad,
  ocrText,
  filename,
  onDownload,
}: ExpandModalProps) {
  // Keyboard navigation for pages (ArrowLeft/Right)
  usePageKeyboardNav({
    enabled: open && activeTab === 'pdf',
    currentPage,
    totalPages,
    onPageChange,
  })

  const isPdf = activeTab === 'pdf'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col gap-0 p-0">
        {/* Visually hidden but accessible title - using Radix VisuallyHidden
            for better cross-browser support vs Tailwind sr-only */}
        <VisuallyHidden asChild>
          <DialogTitle>Document Preview</DialogTitle>
        </VisuallyHidden>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-t-lg bg-muted m-4 mb-0">
          {isPdf ? (
            <PdfContent
              key={pdfUrl}
              url={pdfUrl}
              currentPage={currentPage}
              onLoadSuccess={onPdfLoad}
            />
          ) : (
            <TextContent text={ocrText} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm font-medium truncate max-w-[200px]" title={filename}>
            {filename}
          </span>

          {isPdf && totalPages > 1 && (
            <PageNavigation
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              variant="default"
            />
          )}

          {activeTab === 'pdf' && pdfUrl && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Icons.Download className="size-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
