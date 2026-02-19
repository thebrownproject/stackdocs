import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'

interface FileTypeIconProps {
  mimeType: string
  className?: string
}

export function FileTypeIcon({ mimeType, className }: FileTypeIconProps) {
  const iconClass = cn('size-4', className)

  if (mimeType === 'application/pdf') {
    return <Icons.FileTypePdf className={iconClass} />
  }

  if (mimeType.startsWith('image/')) {
    return <Icons.Image className={iconClass} />
  }

  return <Icons.FileText className={iconClass} />
}
