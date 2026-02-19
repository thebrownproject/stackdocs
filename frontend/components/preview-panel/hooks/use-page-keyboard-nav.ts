import { useEffect, useCallback } from 'react'

interface UsePageKeyboardNavOptions {
  enabled: boolean
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

/**
 * Hook for keyboard navigation between PDF pages.
 * ArrowLeft = previous page, ArrowRight = next page.
 * Automatically skips when user is typing in an input or textarea.
 */
export function usePageKeyboardNav({
  enabled,
  currentPage,
  totalPages,
  onPageChange,
}: UsePageKeyboardNavOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't navigate pages when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!enabled || totalPages <= 1) return

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        onPageChange(currentPage - 1)
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        onPageChange(currentPage + 1)
      }
    },
    [enabled, currentPage, totalPages, onPageChange]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
