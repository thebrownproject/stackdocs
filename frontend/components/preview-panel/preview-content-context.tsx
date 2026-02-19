'use client'

import { createContext, useContext, useMemo, ReactNode, Dispatch, SetStateAction } from 'react'

interface PreviewContentContextValue {
  currentPage: number
  totalPages: number
  setCurrentPage: Dispatch<SetStateAction<number>>
  setTotalPages: Dispatch<SetStateAction<number>>
}

const PreviewContentContext = createContext<PreviewContentContextValue | null>(null)

interface PreviewContentProviderProps {
  children: ReactNode
  currentPage: number
  totalPages: number
  setCurrentPage: Dispatch<SetStateAction<number>>
  setTotalPages: Dispatch<SetStateAction<number>>
}

/**
 * Provides pagination state to preview panel children.
 * State is controlled by the parent (preview-panel.tsx) so that:
 * - The page reset effect can run when pdfUrl changes
 * - The expand modal (rendered in a portal) can receive values via props
 */
export function PreviewContentProvider({
  children,
  currentPage,
  totalPages,
  setCurrentPage,
  setTotalPages,
}: PreviewContentProviderProps) {
  const contextValue = useMemo(() => ({
    currentPage,
    totalPages,
    setCurrentPage,
    setTotalPages,
  }), [currentPage, totalPages, setCurrentPage, setTotalPages])

  return (
    <PreviewContentContext.Provider value={contextValue}>
      {children}
    </PreviewContentContext.Provider>
  )
}

export function usePreviewContent() {
  const context = useContext(PreviewContentContext)
  if (!context) {
    throw new Error('usePreviewContent must be used within PreviewContentProvider')
  }
  return context
}

/**
 * Safe version of usePreviewContent that returns null instead of throwing
 * when used outside the provider. Useful for components that can work
 * both inside and outside the provider (e.g., PageNavigation in ExpandModal).
 */
export function usePreviewContentSafe() {
  return useContext(PreviewContentContext)
}
