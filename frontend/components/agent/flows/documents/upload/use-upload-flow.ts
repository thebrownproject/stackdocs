// frontend/components/agent/flows/documents/upload/use-upload-flow.ts
'use client'

import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import {
  useAgentStore,
  useAgentFlow,
  type UploadFlowStep,
  type UploadFlowData,
} from '../../../stores/agent-store'
import { streamDocumentMetadata, type AgentEvent } from '@/lib/agent-api'
import { getUploadErrorMessage } from '@/lib/upload-config'
import { useSupabase } from '@/hooks/use-supabase'
import { useDocumentRealtime, type DocumentStatus, type DocumentUpdate } from '@/hooks/use-document-realtime'
import type { FlowHookResult } from '../../types'

export interface UploadFlowStepProps {
  dropzone: {
    onFileSelect: (file: File) => void
  }
  processing: {
    documentStatus: DocumentStatus | null
    hasMetadata: boolean
    onRetry: () => void
    isRetrying: boolean
  }
  metadata: {
    data: UploadFlowData
    onUpdate: (data: Partial<UploadFlowData>) => void
    onSave: () => void
    onRegenerate: () => void
    isSaving: boolean
    isRegenerating: boolean
  }
  complete: {
    documentName: string
    onDone: () => void
    onUploadAnother: () => void
  }
}

export function useUploadFlow(): FlowHookResult<UploadFlowStep> & {
  stepProps: UploadFlowStepProps
} {
  const { getToken } = useAuth()
  const router = useRouter()
  const supabase = useSupabase()
  const flow = useAgentFlow()
  const abortControllerRef = useRef<AbortController | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus | null>(null)
  // Track whether we've received metadata via Realtime (avoids infinite loop from deriving from data)
  const [hasReceivedMetadata, setHasReceivedMetadata] = useState(false)

  const actions = useAgentStore(
    useShallow((s) => ({
      setStep: s.setStep,
      updateFlowData: s.updateFlowData,
      setStatus: s.setStatus,
      addEvent: s.addEvent,
      collapse: s.collapse,
      close: s.close,
    }))
  )

  useEffect(() => {
    return () => abortControllerRef.current?.abort()
  }, [])

  const step = (flow?.type === 'upload' ? flow.step : 'dropzone') as UploadFlowStep
  const data = (flow?.type === 'upload' ? flow.data : {}) as UploadFlowData

  const { setStep, updateFlowData, setStatus, addEvent, collapse, close } = actions

  // Handle Realtime updates from document
  // Note: Don't include data.displayName, data.tags, data.summary in dependencies
  // to avoid stale closure issues - just use what comes from the server
  const handleRealtimeUpdate = useCallback((update: DocumentUpdate) => {
    setDocumentStatus(update.status)

    // Update status text based on document status
    switch (update.status) {
      case 'uploading':
        setStatus('processing', 'Uploading document...')
        break
      case 'processing':
        setStatus('processing', 'Extracting text...')
        break
      case 'ocr_complete':
        // Check if metadata is populated
        if (update.display_name || update.tags?.length || update.summary) {
          // Metadata complete - update flow data and move to metadata step
          setHasReceivedMetadata(true)
          updateFlowData({
            displayName: update.display_name || '',
            tags: update.tags || [],
            summary: update.summary || '',
            uploadStatus: 'ready',
          })
          setStep('metadata')
          setStatus('idle', 'Review document details')
        } else {
          // OCR complete but no metadata yet - still processing
          setStatus('processing', 'Generating metadata...')
        }
        break
      case 'failed':
        updateFlowData({ uploadStatus: 'error', uploadError: 'Document processing failed' })
        setStatus('error', 'Processing failed')
        break
    }
  }, [setStatus, setStep, updateFlowData])

  // Subscribe to Realtime updates for current document
  const { status: realtimeStatus } = useDocumentRealtime({
    documentId: data.documentId,
    onUpdate: handleRealtimeUpdate,
    enabled: step === 'processing' && !!data.documentId,
  })

  // Handle file selection - upload then watch via Realtime
  const handleFileSelect = useCallback(async (file: File) => {
    console.log('[Upload] Starting upload for:', file.name)
    updateFlowData({
      file,
      displayName: file.name.replace(/\.[^/.]+$/, ''), // Strip extension for default name
      uploadStatus: 'uploading',
      uploadError: null,
      metadataError: null,
    })
    setStep('processing')
    setStatus('processing', 'Uploading document...')
    setDocumentStatus('uploading')
    collapse()

    try {
      console.log('[Upload] Getting auth token...')
      const token = await getToken()
      console.log('[Upload] Token received:', token ? 'yes' : 'no')
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      console.log('[Upload] Calling API:', `${apiUrl}/api/document/upload`)
      const response = await fetch(`${apiUrl}/api/document/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      console.log('[Upload] Response status:', response.status)
      if (!response.ok) {
        const error = await response.json()
        console.log('[Upload] Error response:', error)
        throw new Error(getUploadErrorMessage(response.status, error.detail))
      }

      const result = await response.json()
      console.log('[Upload] Success response:', result)

      // Store document_id - Realtime subscription will start automatically
      updateFlowData({
        documentId: result.document_id,
        uploadStatus: 'processing',
      })
      setDocumentStatus(result.status as DocumentStatus)

    } catch (error) {
      console.log('[Upload] Error caught:', error)
      const message = error instanceof Error ? error.message : 'Upload failed'
      updateFlowData({ uploadStatus: 'error', uploadError: message })
      setStatus('error', message)
      setDocumentStatus('failed')
    }
  }, [getToken, updateFlowData, setStep, setStatus, collapse])

  // Retry failed OCR via backend endpoint
  const handleRetry = useCallback(async () => {
    if (!data.documentId) return

    setIsRetrying(true)
    setDocumentStatus('uploading')
    setStatus('processing', 'Retrying...')
    updateFlowData({ uploadStatus: 'uploading', uploadError: null })

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('document_id', data.documentId)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/document/retry-ocr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Retry failed')
      }

      // Realtime subscription will handle status updates
      setDocumentStatus('uploading')
      updateFlowData({ uploadStatus: 'processing' })

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Retry failed'
      updateFlowData({ uploadStatus: 'error', uploadError: message })
      setStatus('error', message)
      setDocumentStatus('failed')
    } finally {
      setIsRetrying(false)
    }
  }, [data.documentId, getToken, setStatus, updateFlowData])

  // Regenerate metadata via SSE endpoint (manual regeneration)
  // Note: Realtime subscription is disabled on metadata step, so no race condition
  const handleRegenerate = useCallback(async () => {
    if (!data.documentId) return

    setIsRegenerating(true)
    updateFlowData({ metadataError: null })
    setStatus('processing', 'Regenerating metadata...')

    const handleEvent = (event: AgentEvent) => {
      addEvent(event)
      if (event.type === 'tool') {
        setStatus('processing', event.content)
      } else if (event.type === 'error') {
        updateFlowData({ metadataError: event.content })
        setStatus('error', event.content)
      }
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      await streamDocumentMetadata(
        data.documentId,
        handleEvent,
        token,
        abortControllerRef.current.signal
      )

      // After regeneration, fetch updated document
      const { data: doc } = await supabase
        .from('documents')
        .select('display_name, tags, summary')
        .eq('id', data.documentId)
        .single()

      if (doc) {
        updateFlowData({
          displayName: doc.display_name || '',
          tags: doc.tags || [],
          summary: doc.summary || '',
        })
      }

      setStatus('idle', 'Review document details')

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'Regeneration failed'
      updateFlowData({ metadataError: message })
      setStatus('error', message)
    } finally {
      setIsRegenerating(false)
    }
  }, [data.documentId, getToken, supabase, addEvent, setStatus, updateFlowData])

  // Save metadata to database
  const handleSave = useCallback(async () => {
    if (!data.documentId) return

    setIsSaving(true)
    setStatus('processing', 'Saving document...')

    try {
      // Update document with metadata
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          display_name: data.displayName.trim() || null,
          tags: data.tags.length > 0 ? data.tags : null,
          summary: data.summary.trim() || null,
        })
        .eq('id', data.documentId)

      if (updateError) throw updateError

      // If stack selected, add to stack
      if (data.stackId) {
        const { error: stackError } = await supabase
          .from('stack_documents')
          .insert({
            stack_id: data.stackId,
            document_id: data.documentId,
          })

        // Ignore duplicate error (document already in stack) - use PostgreSQL error code
        if (stackError && stackError.code !== '23505') {
          console.error('Failed to add to stack:', stackError)
        }
      }

      updateFlowData({ uploadStatus: 'ready' })
      setStep('complete')
      setStatus('complete', 'Document saved')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed'
      updateFlowData({ metadataError: message })
      setStatus('error', message)
    } finally {
      setIsSaving(false)
    }
  }, [data, supabase, updateFlowData, setStep, setStatus])

  // Done - close flow and refresh page
  const handleDone = useCallback(() => {
    close()
    router.refresh()
  }, [close, router])

  // Upload another - reset flow
  const handleUploadAnother = useCallback(() => {
    setDocumentStatus(null)
    setHasReceivedMetadata(false)
    updateFlowData({
      file: null,
      documentId: null,
      displayName: '',
      tags: [],
      summary: '',
      stackId: null,
      stackName: null,
      uploadStatus: 'idle',
      uploadError: null,
      metadataError: null,
    })
    setStep('dropzone')
    setStatus('idle', 'Drop a file to get started')
  }, [updateFlowData, setStep, setStatus])

  // Empty - no back navigation in upload flow, but required by FlowHookResult interface
  const handleBack = useCallback(() => {}, [])

  // Memoize stepProps for performance
  const stepProps: UploadFlowStepProps = useMemo(() => ({
    dropzone: {
      onFileSelect: handleFileSelect,
    },
    processing: {
      documentStatus,
      hasMetadata: hasReceivedMetadata,
      onRetry: handleRetry,
      isRetrying,
    },
    metadata: {
      data,
      onUpdate: updateFlowData,
      onSave: handleSave,
      onRegenerate: handleRegenerate,
      isSaving,
      isRegenerating,
    },
    complete: {
      documentName: data.displayName || 'Document',
      onDone: handleDone,
      onUploadAnother: handleUploadAnother,
    },
  }), [
    handleFileSelect,
    documentStatus,
    hasReceivedMetadata,
    handleRetry,
    isRetrying,
    data,
    updateFlowData,
    handleSave,
    handleRegenerate,
    isSaving,
    isRegenerating,
    handleDone,
    handleUploadAnother,
  ])

  return {
    step,
    canGoBack: false, // No back in new flow
    needsConfirmation: step === 'processing',
    onBack: handleBack,
    stepProps,
  }
}
