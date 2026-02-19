'use client'

import { Button } from '@/components/ui/button'

/**
 * Error boundary for document header slot.
 * Gracefully degrades if header data fails to load.
 */
export default function HeaderError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{error.message || 'Failed to load header'}</span>
      <Button variant="ghost" size="sm" onClick={reset} className="h-6 px-2 text-xs">
        Retry
      </Button>
    </div>
  )
}
