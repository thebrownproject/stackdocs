# Agent UI Upload Flow

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the upload dialog into the agent popup system with all step components.

**Architecture:** UploadFlow component routes to step components based on flow.step. Reuses existing ExtractionMethodCard and FieldTagInput components.

**Tech Stack:** React, shadcn/ui, existing agent-api.ts

---

## Task 1: Create Upload Flow Component

**Files:**
- Create: `frontend/components/agent/flows/documents/upload-flow.tsx`

**Step 1: Create upload flow that routes to steps**

```typescript
// frontend/components/agent/flows/documents/upload-flow.tsx
'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { useAgentStore, useAgentFlow, getUploadTitle, type UploadFlowStep } from '../../stores/agent-store'
import { AgentPopup } from '../../agent-popup'
import { UploadDropzone } from './upload-dropzone'
import { UploadConfigure } from './upload-configure'
import { UploadFields } from './upload-fields'
import { UploadExtracting } from './upload-extracting'
import { UploadComplete } from './upload-complete'
import { streamAgentExtraction, type AgentEvent } from '@/lib/agent-api'
import { getUploadErrorMessage } from '@/lib/upload-config'

export function UploadFlow() {
  const { getToken } = useAuth()
  const router = useRouter()
  const flow = useAgentFlow()
  const abortControllerRef = useRef<AbortController | null>(null)

  const actions = useAgentStore(
    useShallow((s) => ({
      setStep: s.setStep,
      updateFlowData: s.updateFlowData,
      setStatus: s.setStatus,
      addEvent: s.addEvent,
      collapsePopup: s.collapsePopup,
      close: s.close,
    }))
  )

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortControllerRef.current?.abort()
  }, [])

  // Only render for upload flow
  if (!flow || flow.type !== 'upload') return null

  const { step, data } = flow
  const { setStep, updateFlowData, setStatus, addEvent, collapsePopup, close } = actions

  // Handle file selection from dropzone
  const handleFileSelect = useCallback(async (file: File) => {
    updateFlowData({
      file,
      documentName: file.name,
      uploadStatus: 'uploading',
      uploadError: null,
    })
    setStep('configure')
    setStatus('processing', 'Uploading document...')

    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/document/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(getUploadErrorMessage(response.status, error.detail))
      }

      const result = await response.json()
      updateFlowData({
        documentId: result.document_id,
        uploadStatus: 'ready',
      })
      setStatus('idle', 'Configure extraction settings')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      updateFlowData({ uploadStatus: 'error', uploadError: message })
      setStatus('error', message)
    }
  }, [getToken, updateFlowData, setStep, setStatus])

  // Start extraction
  const handleExtract = useCallback(async () => {
    if (!data.documentId) return

    setStep('extracting')
    collapsePopup()
    setStatus('processing', 'Extracting...')

    const handleEvent = (event: AgentEvent) => {
      addEvent(event)
      if (event.type === 'tool') {
        setStatus('processing', event.content)
      } else if (event.type === 'complete') {
        setStep('complete')
        setStatus('complete', 'Extraction complete')
      } else if (event.type === 'error') {
        updateFlowData({ extractionError: event.content })
        setStatus('error', event.content)
      }
    }

    try {
      const token = await getToken()
      if (!token) throw new Error('Authentication required')

      // Cancel any in-flight extraction and create new controller
      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      await streamAgentExtraction(
        data.documentId,
        data.extractionMethod,
        data.extractionMethod === 'custom' ? data.customFields : null,
        handleEvent,
        token,
        abortControllerRef.current.signal
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'Extraction failed'
      updateFlowData({ extractionError: message })
      setStatus('error', message)
    }
  }, [data, getToken, setStep, collapsePopup, setStatus, addEvent, updateFlowData])

  // Navigation handlers - type-safe step transitions
  const handleBack = useCallback(() => {
    const prevStep: Partial<Record<UploadFlowStep, UploadFlowStep>> = {
      configure: 'dropzone',
      fields: 'configure',
    }
    const prev = prevStep[step]
    if (prev) setStep(prev)
  }, [step, setStep])

  const handleNext = useCallback(() => {
    if (step === 'configure' && data.extractionMethod === 'custom') {
      setStep('fields')
    } else {
      handleExtract()
    }
  }, [step, data.extractionMethod, setStep, handleExtract])

  const handleViewDocument = useCallback(() => {
    if (data.documentId) {
      close()
      router.push(`/documents/${data.documentId}`)
    }
  }, [data.documentId, router, close])

  const handleUploadAnother = useCallback(() => {
    updateFlowData({
      file: null,
      documentId: null,
      documentName: '',
      extractionMethod: 'auto',
      customFields: [],
      uploadStatus: 'idle',
      uploadError: null,
      extractionError: null,
    })
    setStep('dropzone')
    setStatus('idle', 'Drop a file to get started')
  }, [updateFlowData, setStep, setStatus])

  const showBack = step === 'configure' || step === 'fields'

  return (
    <AgentPopup title={getUploadTitle(step)} showBack={showBack} onBack={handleBack}>
      {step === 'dropzone' && (
        <UploadDropzone onFileSelect={handleFileSelect} />
      )}
      {step === 'configure' && (
        <UploadConfigure
          data={data}
          onUpdate={updateFlowData}
          onNext={handleNext}
          isPrimaryDisabled={data.uploadStatus !== 'ready'}
          primaryButtonText={data.uploadStatus === 'uploading' ? 'Uploading...' : (data.extractionMethod === 'custom' ? 'Next' : 'Extract')}
        />
      )}
      {step === 'fields' && (
        <UploadFields
          data={data}
          onUpdate={updateFlowData}
          onExtract={handleExtract}
        />
      )}
      {step === 'extracting' && (
        <UploadExtracting />
      )}
      {step === 'complete' && (
        <UploadComplete
          documentName={data.documentName}
          onViewDocument={handleViewDocument}
          onUploadAnother={handleUploadAnother}
        />
      )}
    </AgentPopup>
  )
}
```

**Step 2: Commit (after creating step components)**

---

## Task 2: Create Upload Step Components

**Files:**
- Create: `frontend/components/agent/flows/documents/upload-dropzone.tsx`
- Create: `frontend/components/agent/flows/documents/upload-configure.tsx`
- Create: `frontend/components/agent/flows/documents/upload-fields.tsx`
- Create: `frontend/components/agent/flows/documents/upload-extracting.tsx`
- Create: `frontend/components/agent/flows/documents/upload-complete.tsx`

> **Note (Gemini Code Review):** This component must maintain EXACT validation parity with the existing
> UploadDialog (`frontend/components/documents/upload-dialog/steps/dropzone-step.tsx`).
> All validation logic uses the shared `UPLOAD_CONSTRAINTS` from `frontend/lib/upload-config.ts`
> to ensure a single source of truth. No validation rules should be added or removed.

**Validation Parity Checklist:**

| Rule | Source | Implementation |
|------|--------|----------------|
| File type validation | `UPLOAD_CONSTRAINTS.ACCEPTED_TYPES` | `['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']` |
| File size validation | `UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES` | 10 * 1024 * 1024 (10MB) |
| Input accept attribute | `UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS` | `.pdf,.jpg,.jpeg,.png` |
| Error message (type) | Copied from dropzone-step.tsx | "File must be PDF, JPG, or PNG" |
| Error message (size) | Copied from dropzone-step.tsx | "File must be under {MAX_SIZE_MB}MB" |

**Step 1: Create dropzone step (adapted from existing upload dialog)**

```typescript
// frontend/components/agent/flows/documents/upload-dropzone.tsx
'use client'

/**
 * Upload dropzone for agent popup.
 *
 * VALIDATION PARITY: This component mirrors the validation logic from the existing
 * UploadDialog at `frontend/components/documents/upload-dialog/steps/dropzone-step.tsx`.
 * All validation uses the shared `UPLOAD_CONSTRAINTS` from `frontend/lib/upload-config.ts`
 * to ensure consistent behavior between both upload interfaces.
 *
 * DO NOT modify validation rules here without also updating the original dropzone-step.tsx.
 */

import { useCallback, useRef, useState } from 'react'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'
import { UPLOAD_CONSTRAINTS } from '@/lib/upload-config'

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void
}

export function UploadDropzone({ onFileSelect }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Validate file before selection.
   * Validation logic copied from: frontend/components/documents/upload-dialog/steps/dropzone-step.tsx
   * Uses shared UPLOAD_CONSTRAINTS to ensure parity with existing upload dialog.
   */
  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null)

      // Type validation - matches dropzone-step.tsx exactly
      if (!UPLOAD_CONSTRAINTS.ACCEPTED_TYPES.includes(file.type as typeof UPLOAD_CONSTRAINTS.ACCEPTED_TYPES[number])) {
        setError('File must be PDF, JPG, or PNG')
        return
      }

      // Size validation - matches dropzone-step.tsx exactly
      if (file.size > UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES) {
        setError(`File must be under ${UPLOAD_CONSTRAINTS.MAX_SIZE_MB}MB`)
        return
      }

      onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleClick = () => inputRef.current?.click()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndSelect(file)
    // Reset input for re-selection of same file (matches dropzone-step.tsx)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) validateAndSelect(file)
  }

  return (
    <div className="space-y-4">
      {/* Accept attribute uses shared config for browser-level filtering */}
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS}
        onChange={handleChange}
        className="hidden"
        aria-label="Upload document file"
      />

      <button
        type="button"
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-describedby={error ? 'dropzone-error' : undefined}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragging
            ? 'border-primary bg-accent/50'
            : 'border-border hover:border-muted-foreground/50 hover:bg-accent/30'
        )}
      >
        <div className="rounded-full bg-muted p-3">
          <Icons.Upload className="size-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            Drop a file here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, JPG, PNG up to {UPLOAD_CONSTRAINTS.MAX_SIZE_MB}MB
          </p>
        </div>
      </button>

      {error && (
        <p id="dropzone-error" role="alert" className="text-sm text-destructive text-center">
          {error}
        </p>
      )}
    </div>
  )
}
```

**Step 1.5: Verification - Cross-check validation rules**

After creating `upload-dropzone.tsx`, verify validation parity with:

```bash
# Compare validation logic between old and new dropzone components
diff <(grep -A20 "validateAndSelect" frontend/components/documents/upload-dialog/steps/dropzone-step.tsx) \
     <(grep -A20 "validateAndSelect" frontend/components/agent/flows/documents/upload-dropzone.tsx)
```

Expected: Only difference should be the comment about validation source. Core logic must match.

**Step 2: Create configure step with document rename**

```typescript
// frontend/components/agent/flows/documents/upload-configure.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExtractionMethodCard } from '@/components/layout/upload-dialog/extraction-method-card'
import type { UploadFlowData } from '../../stores/agent-store'

interface UploadConfigureProps {
  data: UploadFlowData
  onUpdate: (data: Partial<UploadFlowData>) => void
  onNext: () => void
  isPrimaryDisabled: boolean
  primaryButtonText: string
}

export function UploadConfigure({
  data,
  onUpdate,
  onNext,
  isPrimaryDisabled,
  primaryButtonText,
}: UploadConfigureProps) {
  return (
    <div className="space-y-6">
      {/* Document name (editable) */}
      <div className="space-y-2">
        <Label htmlFor="document-name">Document Name</Label>
        <Input
          id="document-name"
          value={data.documentName}
          onChange={(e) => onUpdate({ documentName: e.target.value })}
          placeholder="Enter document name"
        />
      </div>

      {/* Upload status */}
      {data.uploadStatus === 'uploading' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="animate-pulse">Uploading...</span>
        </div>
      )}
      {data.uploadError && (
        <p className="text-sm text-destructive">{data.uploadError}</p>
      )}

      {/* Stack selection - placeholder */}
      <div className="space-y-2">
        <Label>Add to Stack</Label>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="cursor-not-allowed opacity-50">
            Coming soon
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Stack grouping will be available in a future update
        </p>
      </div>

      {/* Extraction method */}
      <div className="space-y-3">
        <Label>Extraction Method</Label>
        <div className="grid grid-cols-2 gap-3">
          <ExtractionMethodCard
            title="Auto Extract"
            description="AI analyzes and extracts all fields automatically"
            selected={data.extractionMethod === 'auto'}
            onSelect={() => onUpdate({ extractionMethod: 'auto' })}
          />
          <ExtractionMethodCard
            title="Custom Fields"
            description="Specify exactly which fields to extract"
            selected={data.extractionMethod === 'custom'}
            onSelect={() => onUpdate({ extractionMethod: 'custom' })}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={isPrimaryDisabled}>
          {primaryButtonText}
        </Button>
      </div>
    </div>
  )
}
```

**Step 3: Create fields step**

```typescript
// frontend/components/agent/flows/documents/upload-fields.tsx
'use client'

import { Button } from '@/components/ui/button'
import { FieldTagInput } from '@/components/layout/upload-dialog/field-tag-input'
import type { UploadFlowData } from '../../stores/agent-store'
import type { CustomField } from '@/types/upload'

interface UploadFieldsProps {
  data: UploadFlowData
  onUpdate: (data: Partial<UploadFlowData>) => void
  onExtract: () => void
}

export function UploadFields({ data, onUpdate, onExtract }: UploadFieldsProps) {
  const handleAddField = (field: CustomField) => {
    onUpdate({ customFields: [...data.customFields, field] })
  }

  const handleRemoveField = (name: string) => {
    onUpdate({ customFields: data.customFields.filter((f) => f.name !== name) })
  }

  return (
    <div className="space-y-6">
      <FieldTagInput
        fields={data.customFields}
        onAddField={handleAddField}
        onRemoveField={handleRemoveField}
      />

      <div className="flex justify-end pt-2">
        <Button onClick={onExtract} disabled={data.customFields.length === 0}>
          Extract
        </Button>
      </div>
    </div>
  )
}
```

**Step 4: Create extracting step (minimal - popup is collapsed)**

```typescript
// frontend/components/agent/flows/documents/upload-extracting.tsx
'use client'

import { useMemo } from 'react'
import * as Icons from '@/components/icons'
import { useAgentEvents } from '../../stores/agent-store'

export function UploadExtracting() {
  const events = useAgentEvents()
  const toolEvents = useMemo(
    () => events.filter((e) => e.type === 'tool'),
    [events]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span>Extracting data from document...</span>
      </div>

      {toolEvents.length > 0 && (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {toolEvents.map((event, i) => (
            <div
              key={`tool-${i}`}
              className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-150"
            >
              <Icons.Check className="size-3.5 text-green-500 shrink-0" />
              <span>{event.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 5: Create complete step**

```typescript
// frontend/components/agent/flows/documents/upload-complete.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'

interface UploadCompleteProps {
  documentName: string
  onViewDocument: () => void
  onUploadAnother: () => void
}

export function UploadComplete({
  documentName,
  onViewDocument,
  onUploadAnother,
}: UploadCompleteProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Check className="size-4 text-green-500" />
        <span>Successfully extracted data from {documentName}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onUploadAnother}>
          Upload Another
        </Button>
        <Button onClick={onViewDocument}>
          View Document
        </Button>
      </div>
    </div>
  )
}
```

**Step 6: Verify all compile**

Run: `npx tsc --noEmit frontend/components/agent/flows/documents/*.tsx`
Expected: No errors

**Step 7: Commit**

```bash
git add frontend/components/agent/flows/
git commit -m "feat(agent): add upload flow step components"
```

---

## Task 3: Wire Upload Flow into Popup Content

**Files:**
- Modify: `frontend/components/agent/agent-popup-content.tsx`

**Step 1: Import and render UploadFlow**

Replace the placeholder in `agent-popup-content.tsx`:

```typescript
// frontend/components/agent/agent-popup-content.tsx
'use client'

import { useAgentFlow } from './stores/agent-store'
import { UploadFlow } from './flows/documents/upload-flow'

export function AgentPopupContent() {
  const flow = useAgentFlow()

  if (!flow) return null

  switch (flow.type) {
    case 'upload':
      return <UploadFlow />
    case 'create-stack':
      // Post-MVP
      return null
    default:
      return null
  }
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit frontend/components/agent/agent-popup-content.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/agent-popup-content.tsx
git commit -m "feat(agent): wire UploadFlow into popup content router"
```

---

## Task 4: Add Close Confirmation Dialog

**Files:**
- Create: `frontend/components/agent/panels/confirm-close.tsx`
- Modify: `frontend/components/agent/agent-popup.tsx`

**Step 1: Create confirmation dialog component**

```typescript
// frontend/components/agent/panels/confirm-close.tsx
'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmCloseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title?: string
  description?: string
}

export function ConfirmClose({
  open,
  onOpenChange,
  onConfirm,
  title = 'Cancel upload?',
  description = 'You have an upload in progress. Are you sure you want to cancel?',
}: ConfirmCloseProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Working</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard & Close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Step 2: Update AgentPopup to use confirmation**

```typescript
// frontend/components/agent/agent-popup.tsx
'use client'

import { useState, useCallback } from 'react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentFlow, useAgentPopup } from './stores/agent-store'
import { ConfirmClose } from './panels/confirm-close'

interface AgentPopupProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export function AgentPopup({ children, title, showBack, onBack }: AgentPopupProps) {
  const { isPopupOpen } = useAgentPopup()
  const flow = useAgentFlow()
  const collapsePopup = useAgentStore((s) => s.collapsePopup)
  const close = useAgentStore((s) => s.close)
  const [showConfirm, setShowConfirm] = useState(false)

  // Determine if we need confirmation before closing
  const needsConfirmation = useCallback(() => {
    if (!flow || flow.type !== 'upload') return false
    const { step } = flow
    // Confirm if mid-flow (file selected or extracting)
    return step === 'configure' || step === 'fields' || step === 'extracting'
  }, [flow])

  const handleClose = useCallback(() => {
    if (needsConfirmation()) {
      setShowConfirm(true)
    } else {
      close()
    }
  }, [needsConfirmation, close])

  const handleConfirmClose = useCallback(() => {
    setShowConfirm(false)
    close()
  }, [close])

  // Don't render if no flow active
  if (!flow) return null

  return (
    <>
      <Collapsible open={isPopupOpen} onOpenChange={(open) => !open && collapsePopup()}>
        <CollapsibleContent forceMount className={cn(!isPopupOpen && 'hidden')}>
          <div className="rounded-xl border border-border bg-background shadow-lg mb-3">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                {showBack && onBack && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={onBack}
                  >
                    <Icons.ChevronLeft className="size-4" />
                    <span className="sr-only">Go back</span>
                  </Button>
                )}
                {title && (
                  <h3 className="text-sm font-medium">{title}</h3>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={collapsePopup}
                  aria-label="Collapse popup"
                >
                  <Icons.ChevronDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={handleClose}
                  aria-label="Close"
                >
                  <Icons.X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ConfirmClose
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmClose}
      />
    </>
  )
}
```

**Step 3: Verify compiles**

Run: `npx tsc --noEmit frontend/components/agent/agent-popup.tsx frontend/components/agent/panels/confirm-close.tsx`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/components/agent/panels/ frontend/components/agent/agent-popup.tsx
git commit -m "feat(agent): add close confirmation for mid-flow cancellation"
```
