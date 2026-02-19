interface PreviewMetadataProps {
  filename: string
  mimeType: string
  fileSize: number | null
  pageCount: number | null
  fieldCount: number | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.startsWith('image/')) return 'Image'
  return 'Document'
}

export function PreviewMetadata({
  filename,
  mimeType,
  fileSize,
  pageCount,
  fieldCount,
}: PreviewMetadataProps) {
  const fileTypeLabel = getFileTypeLabel(mimeType)

  const details: string[] = [fileTypeLabel]
  if (fileSize !== null) details.push(formatFileSize(fileSize))
  if (pageCount !== null && pageCount > 1) details.push(`${pageCount} pages`)
  if (fieldCount !== null) {
    details.push(`${fieldCount} fields`)
  } else {
    details.push('Not extracted')
  }

  return (
    <div className="pr-4 py-3 shrink-0">
      <p className="font-medium text-foreground truncate" title={filename}>
        {filename}
      </p>
      <p className="text-sm text-muted-foreground">
        {details.join(' · ')}
      </p>
    </div>
  )
}
