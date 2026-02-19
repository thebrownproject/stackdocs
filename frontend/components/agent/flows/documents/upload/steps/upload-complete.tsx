// frontend/components/agent/flows/documents/upload/steps/upload-complete.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'

interface UploadCompleteProps {
  documentName: string
  onDone: () => void
  onUploadAnother: () => void
}

export function UploadComplete({
  documentName,
  onDone,
  onUploadAnother,
}: UploadCompleteProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Check className="size-4 text-green-500" />
        <span>Document saved: {documentName}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onUploadAnother}>
          Upload Another
        </Button>
        <Button onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}
