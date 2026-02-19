import type { StackSummary } from './stacks'

export type DocumentStatus = 'processing' | 'ocr_complete' | 'completed' | 'failed'

export interface Document {
  id: string
  filename: string
  mime_type: string
  file_size_bytes: number
  file_path: string | null
  status: DocumentStatus
  uploaded_at: string
  stacks: StackSummary[]
}

export interface DocumentWithExtraction extends Document {
  extraction_id: string | null
  extracted_fields: Record<string, unknown> | null
  confidence_scores: Record<string, number> | null
  session_id: string | null
  ocr_raw_text: string | null
}
