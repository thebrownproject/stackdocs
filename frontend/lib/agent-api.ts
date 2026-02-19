/**
 * Agent API helper for streaming corrections and extractions.
 *
 * Uses fetch + ReadableStream (not EventSource) because
 * the backend expects POST with FormData.
 */

import type { CustomField } from '@/types/upload'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface AgentEvent {
  type: 'tool' | 'text' | 'complete' | 'error'
  content: string
  timestamp: number
  meta?: {
    extractionId?: string
    sessionId?: string
  }
}

/**
 * Humanize tool names from MCP format.
 * e.g., "mcp__extraction__read_ocr" → "Reading OCR"
 */
function humanizeToolName(toolName: string): string {
  // Strip mcp__extraction__ prefix
  const name = toolName.replace(/^mcp__\w+__/, '')

  // Map known tool names to human-readable labels
  const toolLabels: Record<string, string> = {
    read_ocr: 'Reading OCR',
    read_extraction: 'Reading extraction',
    save_extraction: 'Saving extraction',
    set_field: 'Updating field',
    delete_field: 'Removing field',
    complete: 'Completing',
    // Extraction agent tools
    analyze_document: 'Analyzing document',
  }

  return toolLabels[name] || name.replace(/_/g, ' ')
}

/**
 * Process a single SSE data line and emit event.
 */
function processSSELine(
  line: string,
  onEvent: OnEventCallback
): void {
  if (!line.startsWith('data: ')) return

  try {
    const json = JSON.parse(line.slice(6))
    const timestamp = Date.now()

    if ('error' in json) {
      onEvent({
        type: 'error',
        content: String(json.error),
        timestamp,
      })
    } else if ('complete' in json) {
      onEvent({
        type: 'complete',
        content: 'Update complete',
        timestamp,
        meta: {
          extractionId: typeof json.extraction_id === 'string'
            ? json.extraction_id
            : undefined,
          sessionId: typeof json.session_id === 'string'
            ? json.session_id
            : undefined,
        },
      })
    } else if ('tool' in json) {
      onEvent({
        type: 'tool',
        content: humanizeToolName(String(json.tool)),
        timestamp,
      })
    } else if ('text' in json) {
      onEvent({
        type: 'text',
        content: String(json.text),
        timestamp,
      })
    }
  } catch {
    // Ignore malformed JSON
  }
}

export type OnEventCallback = (event: AgentEvent) => void

/**
 * Extract error message from failed fetch response.
 * Attempts to parse JSON error, falls back to text or status code.
 */
async function getResponseError(response: Response): Promise<string> {
  let errorMessage = `Request failed: ${response.status}`
  try {
    const text = await response.text()
    try {
      const errorData = JSON.parse(text)
      errorMessage = errorData.detail || errorData.message || text
    } catch {
      errorMessage = text || errorMessage
    }
  } catch {
    // Failed to read body
  }
  return errorMessage
}

/**
 * Stream agent correction request.
 *
 * Uses fetch + ReadableStream with proper SSE buffering to handle
 * messages that may be split across TCP chunk boundaries.
 *
 * @param documentId - Document to correct
 * @param instruction - User's correction instruction
 * @param onEvent - Callback for each event
 * @param authToken - Clerk auth token for Authorization header
 * @param signal - AbortController signal for cancellation
 */
export async function streamAgentCorrection(
  documentId: string,
  instruction: string,
  onEvent: OnEventCallback,
  authToken: string,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData()
  formData.append('document_id', documentId)
  formData.append('instruction', instruction)

  const response = await fetch(`${API_URL}/api/agent/correct`, {
    method: 'POST',
    body: formData,
    signal,
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await getResponseError(response))
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '' // Accumulate chunks to handle split messages

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      buffer += text

      // Split by SSE message boundary (double newline)
      const messages = buffer.split('\n\n')

      // Keep last incomplete message in buffer
      buffer = messages.pop() || ''

      // Process complete messages
      for (const message of messages) {
        if (!message.trim()) continue

        const lines = message.split('\n')
        for (const line of lines) {
          processSSELine(line, onEvent)
        }
      }
    }

    // Process any remaining buffered data
    if (buffer.trim()) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        processSSELine(line, onEvent)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Stream agent extraction request.
 *
 * Uses fetch + ReadableStream with proper SSE buffering.
 *
 * @param documentId - Document to extract from (must have OCR cached)
 * @param mode - "auto" or "custom"
 * @param customFields - Array of custom fields (required if mode=custom)
 * @param onEvent - Callback for each event
 * @param authToken - Clerk auth token for Authorization header
 * @param signal - AbortController signal for cancellation
 */
export async function streamAgentExtraction(
  documentId: string,
  mode: 'auto' | 'custom',
  customFields: CustomField[] | null,
  onEvent: OnEventCallback,
  authToken: string,
  signal?: AbortSignal
): Promise<void> {
  // Validate custom fields when mode requires them
  if (mode === 'custom' && (!customFields || customFields.length === 0)) {
    throw new Error('Custom fields are required when mode is "custom"')
  }

  const formData = new FormData()
  formData.append('document_id', documentId)
  formData.append('mode', mode)
  if (customFields && customFields.length > 0) {
    formData.append('custom_fields', JSON.stringify(customFields))
  }

  const response = await fetch(`${API_URL}/api/agent/extract`, {
    method: 'POST',
    body: formData,
    signal,
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await getResponseError(response))
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      buffer += text

      const messages = buffer.split('\n\n')
      buffer = messages.pop() || ''

      for (const message of messages) {
        if (!message.trim()) continue
        const lines = message.split('\n')
        for (const line of lines) {
          processSSELine(line, onEvent)
        }
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        processSSELine(line, onEvent)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Stream document metadata regeneration request.
 *
 * Uses fetch + ReadableStream with proper SSE buffering.
 * Called when user clicks "Regenerate" on the metadata step.
 *
 * @param documentId - Document to regenerate metadata for (must have OCR cached)
 * @param onEvent - Callback for each event
 * @param authToken - Clerk auth token for Authorization header
 * @param signal - AbortController signal for cancellation
 */
export async function streamDocumentMetadata(
  documentId: string,
  onEvent: OnEventCallback,
  authToken: string,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData()
  formData.append('document_id', documentId)

  const response = await fetch(`${API_URL}/api/document/metadata`, {
    method: 'POST',
    body: formData,
    signal,
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await getResponseError(response))
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      buffer += text

      const messages = buffer.split('\n\n')
      buffer = messages.pop() || ''

      for (const message of messages) {
        if (!message.trim()) continue
        const lines = message.split('\n')
        for (const line of lines) {
          processSSELine(line, onEvent)
        }
      }
    }

    if (buffer.trim()) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        processSSELine(line, onEvent)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
