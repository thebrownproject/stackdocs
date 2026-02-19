# Phase 3: Integration

> **Prerequisites:** Complete Phase 1 and Phase 2 first. Read `README.md` for context.

**Tasks:** 11-17
**Goal:** Assemble dialog, integrate with header, update backend, test, and cleanup.

---

## Task 11: Create UploadDialogTrigger Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx
'use client'

import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { UploadDialogContent } from './upload-dialog-content'

interface UploadDialogTriggerProps {
  /** Use 'header' variant for smaller styling in the page header */
  variant?: 'default' | 'header'
}

/**
 * Button that opens the upload dialog.
 * Replaces the old UploadButton component.
 */
export function UploadDialogTrigger({
  variant = 'default',
}: UploadDialogTriggerProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant={variant === 'header' ? 'ghost' : 'default'}
          size={variant === 'header' ? 'sm' : 'default'}
          className={variant === 'header' ? 'h-7 px-2 text-xs' : undefined}
        >
          <Upload
            className={variant === 'header' ? 'mr-1.5 size-3.5' : 'mr-2 size-4'}
          />
          Upload
        </Button>
      </DialogTrigger>
      <UploadDialogContent />
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx
git commit -m "feat(upload-dialog): add UploadDialogTrigger component"
```

---

## Task 12: Create UploadDialogContent Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/upload-dialog-content.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/upload-dialog-content.tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DropzoneStep } from './steps/dropzone-step'
import { ConfigureStep } from './steps/configure-step'
import { FieldsStep } from './steps/fields-step'
import { UploadStatus } from './upload-status'
import { ExtractionProgress } from './extraction-progress'
import { streamAgentExtraction, type AgentEvent } from '@/lib/agent-api'
import { getUploadErrorMessage } from '@/lib/upload-config'
import type {
  UploadStep,
  UploadStatus as UploadStatusType,
  ExtractionMethod,
  ExtractionStatus,
  CustomField,
} from './types'

/**
 * Upload dialog content with internal state management.
 * Manages the full upload and extraction flow.
 */
export function UploadDialogContent() {
  const { getToken } = useAuth()
  const router = useRouter()
  const abortControllerRef = useRef<AbortController | null>(null)
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // State
  const [step, setStep] = useState<UploadStep>('dropzone')
  const [file, setFile] = useState<File | null>(null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadStatusType>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [extractionMethod, setExtractionMethod] =
    useState<ExtractionMethod>('auto')
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>('idle')
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [extractionEvents, setExtractionEvents] = useState<AgentEvent[]>([])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [])

  // Handle escape key to cancel extraction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && extractionStatus === 'extracting') {
        abortControllerRef.current?.abort()
        setExtractionStatus('idle')
        setExtractionError('Extraction cancelled')
      }
    }

    if (extractionStatus === 'extracting') {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [extractionStatus])

  // Upload file handler
  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile)
      setUploadStatus('uploading')
      setUploadError(null)
      setStep('configure')

      try {
        const token = await getToken()
        if (!token) {
          throw new Error('Not authenticated')
        }

        const formData = new FormData()
        formData.append('file', selectedFile)

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/api/document/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          const errorMessage = getUploadErrorMessage(
            response.status,
            error.detail
          )
          throw new Error(errorMessage)
        }

        const data = await response.json()
        setDocumentId(data.document_id)
        setUploadStatus('ready')
      } catch (error) {
        console.error('Upload error:', error)
        setUploadError(error instanceof Error ? error.message : 'Upload failed')
        setUploadStatus('error')
      }
    },
    [getToken]
  )

  // Start extraction
  const handleExtraction = useCallback(
    async () => {
      if (!documentId) {
        setExtractionError('No document to extract from')
        return
      }

      setExtractionStatus('extracting')
      setExtractionError(null)
      setExtractionEvents([])

      abortControllerRef.current = new AbortController()

      const handleEvent = (event: AgentEvent) => {
        if (event.type === 'error') {
          setExtractionError(event.content)
          setExtractionStatus('error')
        } else if (event.type === 'complete') {
          setExtractionStatus('complete')
          setExtractionEvents((prev) => [...prev, event])
          // Navigate after brief delay with cleanup
          navigationTimeoutRef.current = setTimeout(() => {
            router.push(`/documents/${documentId}`)
            router.refresh()
          }, 1000)
        } else {
          setExtractionEvents((prev) => [...prev, event])
        }
      }

      try {
        const token = await getToken()
        if (!token) {
          throw new Error('Authentication required')
        }

        await streamAgentExtraction(
          documentId,
          extractionMethod,
          extractionMethod === 'custom' ? customFields : null,
          handleEvent,
          token,
          abortControllerRef.current.signal
        )
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        setExtractionError(message)
        setExtractionStatus('error')
      }
    },
    [documentId, extractionMethod, customFields, getToken, router]
  )

  // Add custom field
  const handleAddField = useCallback((field: CustomField) => {
    setCustomFields((prev) => [...prev, field])
  }, [])

  // Remove custom field
  const handleRemoveField = useCallback((name: string) => {
    setCustomFields((prev) => prev.filter((f) => f.name !== name))
  }, [])

  // Navigation
  const canGoBack = step !== 'dropzone' && extractionStatus === 'idle'

  const handleBack = () => {
    if (step === 'configure') {
      setStep('dropzone')
    } else if (step === 'fields') {
      setStep('configure')
    }
  }

  const handlePrimaryAction = () => {
    if (step === 'configure') {
      if (extractionMethod === 'auto') {
        handleExtraction()
      } else {
        setStep('fields')
      }
    } else if (step === 'fields') {
      handleExtraction()
    }
  }

  const isPrimaryDisabled = () => {
    if (uploadStatus === 'uploading') return true
    if (uploadStatus !== 'ready') return true
    if (extractionStatus === 'extracting') return true
    if (step === 'fields' && customFields.length === 0) return true
    return false
  }

  const getPrimaryButtonText = () => {
    if (uploadStatus === 'uploading') return 'Uploading...'
    if (extractionStatus === 'extracting') return 'Extracting...'
    if (step === 'configure' && extractionMethod === 'custom') return 'Next'
    return 'Extract'
  }

  const getTitle = () => {
    switch (step) {
      case 'dropzone':
        return 'Upload Document'
      case 'configure':
        return 'Configure Extraction'
      case 'fields':
        return 'Specify Fields'
      default:
        return 'Upload Document'
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-2">
          {canGoBack && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleBack}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Go back</span>
            </Button>
          )}
          <DialogTitle>{getTitle()}</DialogTitle>
        </div>
      </DialogHeader>

      {/* Step content */}
      <div className="py-4">
        {step === 'dropzone' && (
          <DropzoneStep onFileSelect={handleFileSelect} />
        )}

        {step === 'configure' && file && (
          <ConfigureStep
            fileName={file.name}
            extractionMethod={extractionMethod}
            onMethodChange={setExtractionMethod}
          />
        )}

        {step === 'fields' && file && (
          <FieldsStep
            fileName={file.name}
            fields={customFields}
            onAddField={handleAddField}
            onRemoveField={handleRemoveField}
          />
        )}

        {/* Extraction progress */}
        {extractionStatus !== 'idle' && (
          <div className="mt-4">
            <ExtractionProgress
              status={extractionStatus}
              events={extractionEvents}
              error={extractionError}
            />
          </div>
        )}
      </div>

      {/* Footer with status and action */}
      {step !== 'dropzone' && (
        <div className="flex items-center justify-between border-t pt-4">
          <UploadStatus
            status={uploadStatus}
            error={uploadError}
          />
          <Button
            onClick={handlePrimaryAction}
            disabled={isPrimaryDisabled()}
          >
            {getPrimaryButtonText()}
          </Button>
        </div>
      )}
    </DialogContent>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/upload-dialog-content.tsx
git commit -m "feat(upload-dialog): add UploadDialogContent with state management"
```

---

## Task 13: Create Barrel Export

**Files:**
- Create: `frontend/components/documents/upload-dialog/index.ts`

**Step 1: Create the barrel file**

```typescript
// frontend/components/documents/upload-dialog/index.ts
export { UploadDialogTrigger } from './upload-dialog-trigger'
export { UploadDialogContent } from './upload-dialog-content'
export type { CustomField, UploadStep, ExtractionMethod } from './types'
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/index.ts
git commit -m "feat(upload-dialog): add barrel export"
```

---

## Task 14: Update Documents Header to Use New Dialog

**Files:**
- Modify: `frontend/app/(app)/@header/documents/page.tsx`

**Step 1: Update the import and component**

Replace the file contents:

```typescript
// frontend/app/(app)/@header/documents/page.tsx
import { PageHeader } from '@/components/layout/page-header'
import { UploadDialogTrigger } from '@/components/documents/upload-dialog'

/**
 * Header slot for documents list page.
 * Shows breadcrumb with Upload action.
 */
export default function DocumentsHeaderSlot() {
  return (
    <PageHeader
      actions={<UploadDialogTrigger variant="header" />}
    />
  )
}
```

**Step 2: Verify build passes**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add frontend/app/(app)/@header/documents/page.tsx
git commit -m "feat(upload-dialog): integrate UploadDialogTrigger in documents header"
```

---

## Task 15: Update Backend to Accept JSON Custom Fields

**Files:**
- Modify: `backend/app/routes/agent.py`
- Modify: `backend/app/agents/extraction_agent/__init__.py`

**Step 1: Add JSON import to agent.py**

At the top of `backend/app/routes/agent.py`, ensure `json` is imported:

```python
import json  # Add if not already present
```

**Step 2: Update custom_fields parsing with validation**

Find the section around line 75-77 where custom_fields is parsed:

```python
# Parse custom fields
fields_list: list[str] | None = None
if custom_fields:
    fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]
```

Replace with:

```python
# Parse custom fields - supports both JSON format and comma-separated
fields_list: list[dict] | list[str] | None = None
if custom_fields:
    try:
        # Try JSON format first: [{"name": "...", "description": "..."}]
        parsed = json.loads(custom_fields)
        if isinstance(parsed, list) and len(parsed) > 0:
            # Validate structure - all items must be dicts with 'name' key
            if all(isinstance(item, dict) and 'name' in item for item in parsed):
                fields_list = parsed
            else:
                # Invalid structure, fall back to comma-separated
                fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]
        else:
            fields_list = []
    except json.JSONDecodeError:
        # Fall back to comma-separated format for backwards compatibility
        fields_list = [f.strip() for f in custom_fields.split(",") if f.strip()]
```

**Step 3: Update the extraction agent to handle field objects**

In `backend/app/agents/extraction_agent/__init__.py`, find where custom_fields is used in the prompt and update to handle objects:

```python
# In the prompt building section, format fields appropriately
if custom_fields:
    fields_text = []
    for field in custom_fields:
        if isinstance(field, dict):
            name = field.get('name', '')
            desc = field.get('description', '')
            if desc:
                fields_text.append(f"- {name}: {desc}")
            else:
                fields_text.append(f"- {name}")
        else:
            fields_text.append(f"- {field}")
    fields_prompt = "\n".join(fields_text)
```

**Step 4: Verify backend starts**

Run: `cd /Users/fraserbrown/stackdocs/backend && python -c "from app.routes.agent import router; print('OK')"`
Expected: Prints "OK"

**Step 5: Commit**

```bash
git add backend/app/routes/agent.py backend/app/agents/extraction_agent/__init__.py
git commit -m "feat(upload-dialog): support JSON custom_fields with descriptions"
```

---

## Task 16: Manual Testing Checklist

**Files:** None (testing)

**Step 1: Start development servers**

```bash
# Terminal 1: Frontend
cd /Users/fraserbrown/stackdocs/frontend && npm run dev

# Terminal 2: Backend
cd /Users/fraserbrown/stackdocs/backend && uvicorn app.main:app --reload
```

**Step 2: Test the upload flow**

1. Navigate to `/documents`
2. Click the Upload button in header
3. Verify dialog opens at Step 1 (Dropzone)
4. Drag or click to select a PDF/image
5. Verify auto-advance to Step 2
6. Verify upload status shows "Uploading..." then "Ready"
7. Test "Auto Extract" - click Extract, verify SSE events show
8. Test "Custom Fields":
   - Select Custom Fields method
   - Click Next to go to Step 3
   - Add fields with descriptions
   - Verify badges show with tooltips
   - Click Extract
9. Verify navigation to document detail page after extraction

**Step 3: Test edge cases**

1. Invalid file type - should show error
2. File too large - should show error
3. Back navigation - should work correctly
4. Close dialog mid-upload - should not crash
5. Network error - should show error state
6. Press Escape during extraction - should cancel and show error message
7. Test adding multiple custom fields with tooltips
8. Verify focus returns to name input after adding a field

---

## Task 17: Clean Up Old UploadButton (Optional)

**Files:**
- Archive: `frontend/components/documents/upload-button.tsx`

**Step 1: Verify no other usages**

```bash
grep -r "upload-button" frontend/
grep -r "UploadButton" frontend/
```

Expected: Only the old header page import (now updated)

**Step 2: Delete or archive the file**

```bash
git rm frontend/components/documents/upload-button.tsx
```

**Step 3: Commit**

```bash
git commit -m "chore: remove deprecated UploadButton component"
```

---

## Phase 3 Complete

**Verify:**
1. Run `npm run build` in frontend directory - should pass
2. Run backend and verify `/api/agent/extract` accepts JSON custom_fields
3. Complete manual testing checklist

**Files created/modified:**
- `upload-dialog/upload-dialog-trigger.tsx`
- `upload-dialog/upload-dialog-content.tsx`
- `upload-dialog/index.ts`
- `@header/documents/page.tsx` (modified)
- `backend/app/routes/agent.py` (modified)
- `backend/app/agents/extraction_agent/__init__.py` (modified)
- `frontend/components/documents/upload-button.tsx` (deleted)

**Feature Complete!**
