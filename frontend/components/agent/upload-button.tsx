// frontend/components/agent/upload-button.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useAgentStore, initialUploadData } from './stores/agent-store'

export function UploadButton() {
  const openFlow = useAgentStore((s) => s.openFlow)

  const handleClick = () => {
    openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })
  }

  return (
    <Button size="sm" onClick={handleClick}>
      <Icons.Upload className="size-4 mr-1.5" />
      Upload
    </Button>
  )
}
