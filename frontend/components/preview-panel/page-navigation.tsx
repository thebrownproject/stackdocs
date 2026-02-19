'use client'

import { Button } from '@/components/ui/button'
import * as Icons from '@/components/icons'
import { usePreviewContentSafe } from './preview-content-context'
import { cn } from '@/lib/utils'

const noop = () => {}

interface PageNavigationProps {
  /** When provided, uses props instead of context (for use outside provider) */
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  variant?: 'overlay' | 'default'
  className?: string
}

/**
 * Page navigation controls for PDF viewing.
 * Uses PreviewContentContext by default, or accepts props for use outside the provider.
 */
export function PageNavigation({
  currentPage: currentPageProp,
  totalPages: totalPagesProp,
  onPageChange: onPageChangeProp,
  variant = 'default',
  className,
}: PageNavigationProps) {
  // Use context when props not provided (inside provider)
  // Use props when provided (outside provider, e.g. in ExpandModal)
  const context = usePreviewContentSafe()
  const currentPage = currentPageProp ?? context?.currentPage ?? 1
  const totalPages = totalPagesProp ?? context?.totalPages ?? 0
  const onPageChange = onPageChangeProp ?? context?.setCurrentPage ?? noop

  const isOverlay = variant === 'overlay'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        variant={isOverlay ? 'ghost' : 'outline'}
        size="icon"
        className={cn(
          'size-8',
          isOverlay && 'text-white hover:bg-white/20 hover:text-white'
        )}
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        <Icons.ChevronLeft className="size-4" />
      </Button>

      <span
        className={cn(
          'text-sm tabular-nums min-w-[4rem] text-center',
          isOverlay ? 'text-white' : 'text-muted-foreground'
        )}
      >
        {currentPage} / {totalPages}
      </span>

      <Button
        variant={isOverlay ? 'ghost' : 'outline'}
        size="icon"
        className={cn(
          'size-8',
          isOverlay && 'text-white hover:bg-white/20 hover:text-white'
        )}
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        <Icons.ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
