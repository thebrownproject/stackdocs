'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useExtractionRealtime, ExtractionUpdate } from '@/hooks/use-extraction-realtime'
import { ExtractedDataTable } from './extracted-data-table'
import { useSelectedDocument } from './selected-document-context'
import { useDocumentDetailFilter } from './document-detail-filter-context'
import { createClerkSupabaseClient } from '@/lib/supabase'
import type { DocumentWithExtraction } from '@/types/documents'

interface DocumentDetailClientProps {
  initialDocument: DocumentWithExtraction
  initialSignedUrl: string | null  // Renamed from signedUrl to avoid context collision
}

export function DocumentDetailClient({
  initialDocument,
  initialSignedUrl,
}: DocumentDetailClientProps) {
  const [document, setDocument] = useState(initialDocument)
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set())

  // Auth for Supabase client
  const { getToken } = useAuth()

  // Shared state from contexts
  const { setSelectedDocId, setSignedUrl, setSignedUrlDocId, signedUrlDocId, setMimeType, setOcrText } = useSelectedDocument()
  const { fieldSearch } = useDocumentDetailFilter()

  // Sync selected document to context and fetch signed URL client-side
  // Uses signedUrlDocId to avoid re-fetching for the same document
  useEffect(() => {
    let cancelled = false
    setSelectedDocId(initialDocument.id)
    setMimeType(initialDocument.mime_type)
    setOcrText(initialDocument.ocr_raw_text ?? null)

    // Skip fetch if we already have a signed URL for this document
    if (signedUrlDocId === initialDocument.id) {
      return
    }

    // If signed URL provided from server, use it; otherwise fetch client-side
    if (initialSignedUrl) {
      setSignedUrl(initialSignedUrl)
      setSignedUrlDocId(initialDocument.id)
    } else if (initialDocument.file_path) {
      const supabase = createClerkSupabaseClient(getToken)
      supabase.storage
        .from('documents')
        .createSignedUrl(initialDocument.file_path, 3600)
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) {
            console.error('Failed to get signed URL:', error)
          }
          setSignedUrl(data?.signedUrl ?? null)
          setSignedUrlDocId(initialDocument.id)
        })
    }

    return () => {
      cancelled = true
    }
  }, [initialDocument.id, initialDocument.file_path, initialDocument.mime_type, initialDocument.ocr_raw_text, initialSignedUrl, signedUrlDocId, getToken, setSelectedDocId, setSignedUrl, setSignedUrlDocId, setMimeType, setOcrText])

  // Fix #3: Use ref to access current document state without recreating callback
  const documentRef = useRef(document)
  useEffect(() => {
    documentRef.current = document
  }, [document])

  const handleExtractionUpdate = useCallback(
    (update: ExtractionUpdate) => {
      // Find which fields changed - use ref to avoid stale closure
      const newChangedFields = new Set<string>()
      const oldFields = documentRef.current.extracted_fields || {}
      const newFields = update.extracted_fields || {}

      for (const key of Object.keys(newFields)) {
        if (JSON.stringify(oldFields[key]) !== JSON.stringify(newFields[key])) {
          newChangedFields.add(key)
        }
      }

      // Update document state
      setDocument((prev) => ({
        ...prev,
        extracted_fields: update.extracted_fields,
        confidence_scores: update.confidence_scores,
      }))

      // Set changed fields for highlight animation
      setChangedFields(newChangedFields)
    },
    [] // Stable callback - no dependencies since we use ref
  )

  // Clear changed fields after animation (1.5s)
  useEffect(() => {
    if (changedFields.size > 0) {
      const timer = setTimeout(() => {
        setChangedFields(new Set())
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [changedFields])

  useExtractionRealtime({
    documentId: document.id,
    onUpdate: handleExtractionUpdate,
  })

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Extracted data table - SubBar rendered by @subbar parallel route */}
      <div className="flex-1 overflow-auto">
        <ExtractedDataTable
          fields={document.extracted_fields}
          confidenceScores={document.confidence_scores}
          changedFields={changedFields}
          searchFilter={fieldSearch}
        />
      </div>
      {/* Agent bar rendered by AgentContainer in root layout */}
    </div>
  )
}
