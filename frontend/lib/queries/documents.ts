import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Document, DocumentWithExtraction, DocumentStatus } from '@/types/documents'
import type { StackSummary } from '@/types/stacks'

// Helper to extract stacks from Supabase nested join response
function extractStacks(
  stackDocuments: Array<{ stacks: unknown }> | null
): StackSummary[] {
  if (!stackDocuments) return []

  return stackDocuments
    .map((sd) => sd.stacks as StackSummary | null)
    .filter((s): s is StackSummary => s !== null)
}

export async function getDocumentsWithStacks(): Promise<Document[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('documents')
    .select(`
      id,
      filename,
      mime_type,
      file_size_bytes,
      file_path,
      status,
      uploaded_at,
      stack_documents (
        stacks (
          id,
          name
        )
      )
    `)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }

  return (data || []).map((doc) => ({
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    file_size_bytes: doc.file_size_bytes,
    file_path: doc.file_path,
    status: doc.status as DocumentStatus,
    uploaded_at: doc.uploaded_at,
    stacks: extractStacks(doc.stack_documents),
  }))
}

/**
 * Fetch stacks assigned to a document.
 * Wrapped with React cache() to deduplicate requests across parallel routes.
 */
export const getDocumentStacks = cache(async function getDocumentStacks(
  documentId: string
): Promise<StackSummary[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('stack_documents')
    .select(`
      stacks (
        id,
        name
      )
    `)
    .eq('document_id', documentId)

  if (error) {
    console.error('Error fetching document stacks:', error)
    return []
  }

  return extractStacks(data)
})

/**
 * Fetch document with extraction data, OCR text, and assigned stacks.
 * Wrapped with React cache() to deduplicate requests across parallel routes
 * (e.g., page + header slot both fetching the same document).
 *
 * Note: cache() only persists for a single server request. Each navigation
 * gets fresh data. Realtime updates trigger router.refresh() which creates
 * a new request and bypasses the cache.
 */
export const getDocumentWithExtraction = cache(async function getDocumentWithExtraction(
  documentId: string
): Promise<DocumentWithExtraction | null> {
  const supabase = await createServerSupabaseClient()

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select(`
      id,
      filename,
      mime_type,
      file_size_bytes,
      status,
      uploaded_at,
      file_path,
      stack_documents (
        stacks (
          id,
          name
        )
      )
    `)
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    console.error('Error fetching document:', docError)
    return null
  }

  // Fetch extraction and OCR in parallel for faster loading
  const [extractionResult, ocrResult] = await Promise.all([
    // Get latest extraction (maybeSingle - document may not have extraction yet)
    supabase
      .from('extractions')
      .select('id, extracted_fields, confidence_scores, session_id')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Get OCR text (maybeSingle - OCR may still be processing)
    supabase
      .from('ocr_results')
      .select('raw_text')
      .eq('document_id', documentId)
      .maybeSingle(),
  ])

  const extraction = extractionResult.data
  const ocr = ocrResult.data

  return {
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    file_size_bytes: doc.file_size_bytes,
    status: doc.status as DocumentStatus,
    uploaded_at: doc.uploaded_at,
    file_path: doc.file_path,
    stacks: extractStacks(doc.stack_documents),
    extraction_id: extraction?.id ?? null,
    extracted_fields: extraction?.extracted_fields ?? null,
    confidence_scores: extraction?.confidence_scores ?? null,
    session_id: extraction?.session_id ?? null,
    ocr_raw_text: ocr?.raw_text ?? null,
  }
})
