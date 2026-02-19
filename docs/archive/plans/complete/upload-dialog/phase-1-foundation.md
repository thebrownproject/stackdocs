# Phase 1: Foundation

> **Prerequisites:** Read `README.md` first for context.

**Tasks:** 1-3
**Goal:** Set up types, SSE streaming, and configuration constants.

---

## Task 1: Create Type Definitions

**Files:**
- Create: `frontend/components/documents/upload-dialog/types.ts`

**Step 1: Create the types file**

```typescript
// frontend/components/documents/upload-dialog/types.ts
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
  customFields: CustomField[]

  // Extraction progress
  extractionStatus: ExtractionStatus
  extractionError: string | null
  extractionEvents: AgentEvent[]
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
```

**Step 2: Verify file created correctly**

Run: `cat frontend/components/documents/upload-dialog/types.ts`
Expected: File contents match above

**Step 3: Commit**

```bash
git add frontend/components/documents/upload-dialog/types.ts
git commit -m "feat(upload-dialog): add type definitions for dialog state"
```

---

## Task 2: Add streamAgentExtraction to agent-api.ts

**Files:**
- Modify: `frontend/lib/agent-api.ts`

**Step 1: Add extraction tool labels to humanizeToolName**

Add these entries to the `toolLabels` object (around line 29):

```typescript
// Inside humanizeToolName function, add to toolLabels:
const toolLabels: Record<string, string> = {
  read_ocr: 'Reading OCR',
  read_extraction: 'Reading extraction',
  save_extraction: 'Saving extraction',
  set_field: 'Updating field',
  delete_field: 'Removing field',
  complete: 'Completing',
  // Add for extraction
  analyze_document: 'Analyzing document',
}
```

**Step 2: Re-export CustomField type**

Add below the AgentEvent interface (after line 18):

```typescript
// Re-export CustomField from types for convenience
export type { CustomField } from '@/components/documents/upload-dialog/types'
```

**Step 3: Add streamAgentExtraction function**

Add at the end of the file (after streamAgentCorrection):

```typescript
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
    throw new Error(errorMessage)
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
```

**Step 4: Verify changes compile**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors related to agent-api.ts

**Step 5: Commit**

```bash
git add frontend/lib/agent-api.ts
git commit -m "feat(upload-dialog): add streamAgentExtraction function for SSE extraction"
```

---

## Task 3: Create Upload Configuration Constants

**Files:**
- Create: `frontend/lib/upload-config.ts`

**Step 1: Create the config file**

```typescript
// frontend/lib/upload-config.ts

/**
 * Upload constraints and configuration.
 * Centralized constants for file validation and upload behavior.
 */
export const UPLOAD_CONSTRAINTS = {
  ACCEPTED_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'] as const,
  ACCEPTED_EXTENSIONS: '.pdf,.jpg,.jpeg,.png',
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
} as const

/**
 * Get user-friendly error message for HTTP status code.
 */
export function getUploadErrorMessage(status: number, detail?: string): string {
  switch (status) {
    case 401:
      return 'Session expired. Please sign in again.'
    case 413:
      return 'File too large. Maximum size is 10MB.'
    case 429:
      return 'Upload limit reached. Please try again later.'
    case 415:
      return 'Unsupported file type. Please upload a PDF, JPG, or PNG.'
    default:
      return detail || 'Upload failed. Please try again.'
  }
}
```

**Step 2: Commit**

```bash
git add frontend/lib/upload-config.ts
git commit -m "feat(upload-dialog): add upload configuration constants"
```

---

## Phase 1 Complete

**Verify:** Run `npx tsc --noEmit` in frontend directory - should pass.

**Next:** Proceed to `phase-2-components.md`
