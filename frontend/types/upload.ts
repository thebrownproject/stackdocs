// frontend/types/upload.ts
import type { AgentEvent } from '@/lib/agent-api'

export type UploadStep = 'dropzone' | 'configure' | 'fields'

export type UploadStatus = 'idle' | 'uploading' | 'processing_ocr' | 'ready' | 'error'

export type ExtractionMethod = 'auto' | 'custom'

export type ExtractionStatus = 'idle' | 'extracting' | 'complete' | 'error'

export interface CustomField {
  name: string
  description?: string
}

export interface UploadDialogState {
  // Navigation
  step: UploadStep
  isOpen: boolean

  // From Step 1
  file: File | null
  documentId: string | null

  // Upload/OCR progress
  uploadStatus: UploadStatus
  uploadError: string | null

  // From Step 2
  extractionMethod: ExtractionMethod

  // From Step 3 (if custom)
  readonly customFields: readonly CustomField[]

  // Extraction progress
  extractionStatus: ExtractionStatus
  extractionError: string | null
  readonly extractionEvents: readonly AgentEvent[]
}

export interface UploadDialogActions {
  // Navigation
  setStep: (step: UploadStep) => void
  setOpen: (open: boolean) => void
  reset: () => void

  // Step 1
  setFile: (file: File | null) => void
  setDocumentId: (id: string | null) => void
  setUploadStatus: (status: UploadStatus) => void
  setUploadError: (error: string | null) => void

  // Step 2
  setExtractionMethod: (method: ExtractionMethod) => void

  // Step 3
  addCustomField: (field: CustomField) => void
  removeCustomField: (name: string) => void

  // Extraction
  setExtractionStatus: (status: ExtractionStatus) => void
  setExtractionError: (error: string | null) => void
  addExtractionEvent: (event: AgentEvent) => void
}
