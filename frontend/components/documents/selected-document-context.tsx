'use client'

import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react'

const STORAGE_KEY = 'stackdocs-last-document'

interface StackSummary {
  id: string
  name: string
}

interface DocumentMetadata {
  filename: string
  filePath: string | null
  assignedStacks: StackSummary[]
  fileSize: number | null  // bytes
  pageCount: number | null
}

interface SelectedDocumentContextValue {
  // Document selection state
  selectedDocId: string | null
  setSelectedDocId: (id: string | null) => void
  // Preview data (signed URL, MIME type, OCR text)
  signedUrl: string | null
  setSignedUrl: (url: string | null) => void
  signedUrlDocId: string | null
  setSignedUrlDocId: (id: string | null) => void
  mimeType: string
  setMimeType: (type: string) => void
  ocrText: string | null
  setOcrText: (text: string | null) => void
  // Document metadata for subbar actions
  filename: string | null
  filePath: string | null
  assignedStacks: StackSummary[]
  fileSize: number | null
  pageCount: number | null
  setDocumentMetadata: (metadata: DocumentMetadata) => void
  // Extraction data for export
  extractedFields: Record<string, unknown> | null
  setExtractedFields: (fields: Record<string, unknown> | null) => void
  isLoadingExtraction: boolean
  setIsLoadingExtraction: (loading: boolean) => void
}

const SelectedDocumentContext = createContext<SelectedDocumentContextValue | null>(null)

export function SelectedDocumentProvider({ children }: { children: ReactNode }) {
  const [selectedDocId, setSelectedDocIdState] = useState<string | null>(null)
  const [signedUrl, setSignedUrlState] = useState<string | null>(null)
  const [signedUrlDocId, setSignedUrlDocIdState] = useState<string | null>(null)
  const [mimeType, setMimeTypeState] = useState<string>('')
  const [ocrText, setOcrTextState] = useState<string | null>(null)
  // Document metadata for subbar actions
  const [filename, setFilenameState] = useState<string | null>(null)
  const [filePath, setFilePathState] = useState<string | null>(null)
  const [assignedStacks, setAssignedStacksState] = useState<StackSummary[]>([])
  // File metadata for preview panel
  const [fileSize, setFileSizeState] = useState<number | null>(null)
  const [pageCount, setPageCountState] = useState<number | null>(null)
  // Extraction data for export
  const [extractedFields, setExtractedFieldsState] = useState<Record<string, unknown> | null>(null)
  const [isLoadingExtraction, setIsLoadingExtractionState] = useState(false)


  // Restore selected document from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setSelectedDocIdState(saved)
    }
  }, [])

  // Persist selected document to localStorage
  useEffect(() => {
    if (selectedDocId) {
      localStorage.setItem(STORAGE_KEY, selectedDocId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [selectedDocId])

  const setSelectedDocId = useCallback((id: string | null) => {
    setSelectedDocIdState(id)
    // Don't clear URL here - causes race condition with react-pdf
    // Consumer will fetch new URL and call setSignedUrl when ready
    // Clear metadata when deselecting
    if (id === null) {
      setFilenameState(null)
      setFilePathState(null)
      setAssignedStacksState([])
      setFileSizeState(null)
      setPageCountState(null)
      setExtractedFieldsState(null)
      setIsLoadingExtractionState(false)
    }
  }, [])

  const setSignedUrl = useCallback((url: string | null) => {
    setSignedUrlState(url)
  }, [])

  const setSignedUrlDocId = useCallback((id: string | null) => {
    setSignedUrlDocIdState(id)
  }, [])

  const setMimeType = useCallback((type: string) => {
    setMimeTypeState(type)
  }, [])

  const setOcrText = useCallback((text: string | null) => {
    setOcrTextState(text)
  }, [])

  const setDocumentMetadata = useCallback((metadata: DocumentMetadata) => {
    setFilenameState(metadata.filename)
    setFilePathState(metadata.filePath)
    setAssignedStacksState(metadata.assignedStacks)
    setFileSizeState(metadata.fileSize)
    setPageCountState(metadata.pageCount)
  }, [])

  const setExtractedFields = useCallback((fields: Record<string, unknown> | null) => {
    setExtractedFieldsState(fields)
  }, [])

  const setIsLoadingExtraction = useCallback((loading: boolean) => {
    setIsLoadingExtractionState(loading)
  }, [])

  const contextValue = useMemo(() => ({
    selectedDocId,
    setSelectedDocId,
    signedUrl,
    setSignedUrl,
    signedUrlDocId,
    setSignedUrlDocId,
    mimeType,
    setMimeType,
    ocrText,
    setOcrText,
    // Document metadata
    filename,
    filePath,
    assignedStacks,
    fileSize,
    pageCount,
    setDocumentMetadata,
    // Extraction data
    extractedFields,
    setExtractedFields,
    isLoadingExtraction,
    setIsLoadingExtraction,
  }), [
    selectedDocId, setSelectedDocId,
    signedUrl, setSignedUrl,
    signedUrlDocId, setSignedUrlDocId,
    mimeType, setMimeType,
    ocrText, setOcrText,
    filename, filePath, assignedStacks, fileSize, pageCount, setDocumentMetadata,
    extractedFields, setExtractedFields,
    isLoadingExtraction, setIsLoadingExtraction,
  ])

  return (
    <SelectedDocumentContext.Provider value={contextValue}>
      {children}
    </SelectedDocumentContext.Provider>
  )
}

export function useSelectedDocument() {
  const context = useContext(SelectedDocumentContext)
  if (!context) {
    throw new Error('useSelectedDocument must be used within SelectedDocumentProvider')
  }
  return context
}
