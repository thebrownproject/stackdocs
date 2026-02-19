// frontend/components/agent/flows/documents/upload/steps/upload-processing.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { DocumentStatus } from '@/hooks/use-document-realtime'

interface UploadProcessingProps {
  documentStatus: DocumentStatus | null
  hasMetadata: boolean
  onRetry: () => void
  isRetrying: boolean
}

const statusMessages: Record<DocumentStatus, string> = {
  uploading: 'Uploading document...',
  processing: 'Extracting text...',
  ocr_complete: 'Generating metadata...',
  failed: 'Processing failed',
}

export function UploadProcessing({
  documentStatus,
  hasMetadata,
  onRetry,
  isRetrying,
}: UploadProcessingProps) {
  // Determine what to show
  const isFailed = documentStatus === 'failed'

  // Get message - show "Generating metadata..." when OCR complete but no metadata yet
  const message = documentStatus
    ? (documentStatus === 'ocr_complete' && !hasMetadata)
      ? 'Generating metadata...'
      : statusMessages[documentStatus]
    : 'Starting upload...'

  if (isFailed) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Icons.AlertCircle className="size-4 shrink-0" />
          <span>Document processing failed. Please try again.</span>
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <Icons.Loader2 className="size-4 animate-spin mr-2" />
                Retrying...
              </>
            ) : (
              <>
                <Icons.Refresh className="size-4 mr-2" />
                Retry
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Check if upload step is complete (status is beyond 'uploading')
  const uploadComplete = documentStatus && ['processing', 'ocr_complete', 'failed'].includes(documentStatus)

  // Normal processing state
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span>{message}</span>
      </div>

      {/* Progress indicators */}
      <div className="space-y-1.5">
        {/* Upload step */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {uploadComplete ? (
            <Icons.Check className="size-3.5 text-green-500 shrink-0" />
          ) : (
            <Icons.Circle className="size-3.5 shrink-0" />
          )}
          <span>Upload file</span>
        </div>

        {/* OCR step */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {documentStatus === 'ocr_complete' ? (
            <Icons.Check className="size-3.5 text-green-500 shrink-0" />
          ) : (
            <Icons.Circle className="size-3.5 shrink-0" />
          )}
          <span>Extract text</span>
        </div>

        {/* Metadata step */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {hasMetadata ? (
            <Icons.Check className="size-3.5 text-green-500 shrink-0" />
          ) : (
            <Icons.Circle className="size-3.5 shrink-0" />
          )}
          <span>Generate metadata</span>
        </div>
      </div>
    </div>
  )
}
