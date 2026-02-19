# Phase 3: Upload Flow Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the existing upload flow to the Config + Hook Hybrid pattern.

**Dependencies:** Phase 1 and 2 complete (types, registry, unified card)

---

## Task 1: Create Upload Flow Metadata

**Files:**
- Create: `frontend/components/agent/flows/documents/upload/metadata.ts`

**Step 1: Create metadata file**

```typescript
// frontend/components/agent/flows/documents/upload/metadata.ts
import * as Icons from '@/components/icons'
import type { FlowMetadata } from '../../types'
import type { UploadFlowStep } from '../../../stores/agent-store'

// Step components (will be moved in Task 3)
import { UploadDropzone } from './steps/upload-dropzone'
import { UploadConfigure } from './steps/upload-configure'
import { UploadFields } from './steps/upload-fields'
import { UploadExtracting } from './steps/upload-extracting'
import { UploadComplete } from './steps/upload-complete'

/**
 * Static metadata for the upload flow.
 * Defines visual properties and step components.
 */
export const uploadFlowMetadata: FlowMetadata<UploadFlowStep> = {
  type: 'upload',

  steps: ['dropzone', 'configure', 'fields', 'extracting', 'complete'] as const,

  icons: {
    dropzone: Icons.Upload,
    configure: Icons.Settings,
    fields: Icons.List,
    extracting: Icons.Loader2,
    complete: Icons.Check,
  },

  statusText: {
    dropzone: 'Drop a file to get started',
    configure: 'Configure extraction settings',
    fields: 'Specify fields to extract',
    extracting: 'Extracting...',
    complete: 'Extraction complete',
  },

  minimizedText: 'Continue file upload...',

  components: {
    dropzone: UploadDropzone,
    configure: UploadConfigure,
    fields: UploadFields,
    extracting: UploadExtracting,
    complete: UploadComplete,
  },

  backableSteps: ['configure', 'fields'] as const,

  confirmationSteps: ['configure', 'fields', 'extracting'] as const,
}
```

**Step 2: Verify TypeScript compiles (will fail - step components not moved yet)**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors about missing step components (we'll fix in Task 3)

**Step 3: Commit (skip for now, commit after Task 3)**

---

## Task 2: Create Upload Flow Hook

**Files:**
- Create: `frontend/components/agent/flows/documents/upload/use-upload-flow.ts`

**Step 1: Create the hook file**

This extracts all the logic from the current `upload-flow.tsx`:

```typescript
// frontend/components/agent/flows/documents/upload/use-upload-flow.ts
'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import {
  useAgentStore,
  useAgentFlow,
  type UploadFlowStep,
  type UploadFlowData,
} from '../../../stores/agent-store'
import { streamAgentExtraction, type AgentEvent } from '@/lib/agent-api'
import { getUploadErrorMessage } from '@/lib/upload-config'
import type { FlowHookResult } from '../../types'

/**
 * Props for each step component.
 * Explicitly typed for type safety.
 */
export interface UploadFlowStepProps {
  dropzone: {
    onFileSelect: (file: File) => void
  }
  configure: {
    data: UploadFlowData
    onUpdate: (data: Partial<UploadFlowData>) => void
    onNext: () => void
    isPrimaryDisabled: boolean
    primaryButtonText: string
  }
  fields: {
    data: UploadFlowData
    onUpdate: (data: Partial<UploadFlowData>) => void
    onExtract: () => void
  }
  extracting: Record<string, never> // No props - reads from store
  complete: {
    documentName: string
    onViewDocument: () => void
    onUploadAnother: () => void
  }
}

/**
 * Hook containing all upload flow logic.
 * Returns computed state and handlers for the AgentCard.
 */
export function useUploadFlow(): FlowHookResult<UploadFlowStep> & {
  stepProps: UploadFlowStepProps
} {
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
      collapse: s.collapse,
      close: s.close,
    }))
  )

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => abortControllerRef.current?.abort()
  }, [])

  // Extract flow state (with safe defaults)
  const step = (flow?.type === 'upload' ? flow.step : 'dropzone') as UploadFlowStep
  const data = (flow?.type === 'upload' ? flow.data : {}) as UploadFlowData

  const { setStep, updateFlowData, setStatus, addEvent, collapse, close } = actions

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
  // FIX #10: Use specific data fields instead of entire `data` object
  // to prevent unnecessary callback recreation when unrelated fields change
  const handleExtract = useCallback(async () => {
    if (!data.documentId) return

    setStep('extracting')
    collapse()
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
  }, [
    // FIX #10: Only depend on specific fields used in the callback
    data.documentId,
    data.extractionMethod,
    data.customFields,
    getToken,
    setStep,
    collapse,
    setStatus,
    addEvent,
    updateFlowData,
  ])

  // Navigation: back
  const handleBack = useCallback(() => {
    const prevStep: Partial<Record<UploadFlowStep, UploadFlowStep>> = {
      configure: 'dropzone',
      fields: 'configure',
    }
    const prev = prevStep[step]
    if (prev) setStep(prev)
  }, [step, setStep])

  // Navigation: next
  const handleNext = useCallback(() => {
    if (step === 'configure' && data.extractionMethod === 'custom') {
      setStep('fields')
    } else {
      handleExtract()
    }
  }, [step, data.extractionMethod, setStep, handleExtract])

  // Complete: view document
  const handleViewDocument = useCallback(() => {
    if (data.documentId) {
      close()
      router.push(`/documents/${data.documentId}`)
    }
  }, [data.documentId, router, close])

  // Complete: upload another
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

  // Computed state
  const canGoBack = step === 'configure' || step === 'fields'
  const needsConfirmation = ['configure', 'fields', 'extracting'].includes(step)

  // Build step props
  const stepProps: UploadFlowStepProps = {
    dropzone: {
      onFileSelect: handleFileSelect,
    },
    configure: {
      data,
      onUpdate: updateFlowData,
      onNext: handleNext,
      isPrimaryDisabled: data.uploadStatus !== 'ready',
      primaryButtonText:
        data.uploadStatus === 'uploading'
          ? 'Uploading...'
          : data.extractionMethod === 'custom'
            ? 'Next'
            : 'Extract',
    },
    fields: {
      data,
      onUpdate: updateFlowData,
      onExtract: handleExtract,
    },
    extracting: {},
    complete: {
      documentName: data.documentName,
      onViewDocument: handleViewDocument,
      onUploadAnother: handleUploadAnother,
    },
  }

  return {
    step,
    canGoBack,
    needsConfirmation,
    onBack: handleBack,
    stepProps,
  }
}
```

**Step 2: Verify TypeScript compiles (will fail - step components not moved yet)**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors about missing step components

---

## Task 3: Move Step Components

**Files:**
- Move: `frontend/components/agent/flows/documents/upload-dropzone.tsx` -> `frontend/components/agent/flows/documents/upload/steps/upload-dropzone.tsx`
- Move: `frontend/components/agent/flows/documents/upload-configure.tsx` -> `frontend/components/agent/flows/documents/upload/steps/upload-configure.tsx`
- Move: `frontend/components/agent/flows/documents/upload-fields.tsx` -> `frontend/components/agent/flows/documents/upload/steps/upload-fields.tsx`
- Move: `frontend/components/agent/flows/documents/upload-extracting.tsx` -> `frontend/components/agent/flows/documents/upload/steps/upload-extracting.tsx`
- Move: `frontend/components/agent/flows/documents/upload-complete.tsx` -> `frontend/components/agent/flows/documents/upload/steps/upload-complete.tsx`
- Move: `frontend/components/agent/flows/documents/extraction-method-card.tsx` -> `frontend/components/agent/flows/documents/upload/steps/extraction-method-card.tsx`
- Move: `frontend/components/agent/flows/documents/field-tag-input.tsx` -> `frontend/components/agent/flows/documents/upload/steps/field-tag-input.tsx`

**Step 1: Move files**

```bash
cd /Users/fraserbrown/stackdocs/frontend/components/agent/flows/documents

# Move step components
mv upload-dropzone.tsx upload/steps/
mv upload-configure.tsx upload/steps/
mv upload-fields.tsx upload/steps/
mv upload-extracting.tsx upload/steps/
mv upload-complete.tsx upload/steps/
mv extraction-method-card.tsx upload/steps/
mv field-tag-input.tsx upload/steps/
```

**Step 2: Update imports in step components**

Each step component needs import path updates. Update the store import in each:

For each file in `upload/steps/`, change:
```typescript
// OLD
import { ... } from '../../stores/agent-store'

// NEW
import { ... } from '../../../../stores/agent-store'
```

And for internal imports between step files:
```typescript
// OLD
import { ExtractionMethodCard } from './extraction-method-card'

// NEW (no change needed - they're in same directory)
import { ExtractionMethodCard } from './extraction-method-card'
```

**Step 3: Create steps barrel export**

```typescript
// frontend/components/agent/flows/documents/upload/steps/index.ts
export { UploadDropzone } from './upload-dropzone'
export { UploadConfigure } from './upload-configure'
export { UploadFields } from './upload-fields'
export { UploadExtracting } from './upload-extracting'
export { UploadComplete } from './upload-complete'
```

**Step 4: Update metadata.ts imports**

```typescript
// frontend/components/agent/flows/documents/upload/metadata.ts
// Change:
import { UploadDropzone } from './steps/upload-dropzone'
// etc.

// To:
import {
  UploadDropzone,
  UploadConfigure,
  UploadFields,
  UploadExtracting,
  UploadComplete,
} from './steps'
```

**Step 5: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 6: Commit**

```bash
git add frontend/components/agent/flows/documents/ && git commit -m "refactor(agent): move upload step components to new structure"
```

---

## Task 4: Create Upload Flow Barrel Export

**Files:**
- Modify: `frontend/components/agent/flows/documents/upload/index.ts`

**Step 1: Update barrel export**

```typescript
// frontend/components/agent/flows/documents/upload/index.ts
export { uploadFlowMetadata } from './metadata'
export { useUploadFlow, type UploadFlowStepProps } from './use-upload-flow'
export * from './steps'
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/flows/documents/upload/index.ts && git commit -m "chore(agent): add upload flow barrel export"
```

---

## Task 5: Register Upload Flow

**Files:**
- Modify: `frontend/components/agent/flows/registry.ts`

**Step 1: Update registry**

```typescript
// frontend/components/agent/flows/registry.ts
import type { FlowRegistration } from './types'
import type { AgentFlow, UploadFlowStep } from '../stores/agent-store'
import { uploadFlowMetadata, useUploadFlow } from './documents/upload'

/**
 * Registry of all flow types.
 * Maps flow type string to its metadata and hook.
 */
export const flowRegistry: Partial<Record<NonNullable<AgentFlow>['type'], FlowRegistration>> = {
  upload: {
    metadata: uploadFlowMetadata,
    useHook: useUploadFlow,
  } as FlowRegistration<UploadFlowStep>,
}

/**
 * Get a flow registration by type.
 */
export function getFlowRegistration(flowType: string): FlowRegistration | undefined {
  return flowRegistry[flowType as keyof typeof flowRegistry]
}

/**
 * Check if a flow type is registered.
 */
export function isFlowRegistered(flowType: string): boolean {
  return flowType in flowRegistry
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/flows/registry.ts && git commit -m "feat(agent): register upload flow in registry"
```

---

## Task 6: Remove Old Upload Flow File

**Files:**
- Delete: `frontend/components/agent/flows/documents/upload-flow.tsx`

**Step 1: Verify new flow works**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npm run dev
```

Test the upload flow:
1. Click Upload action
2. Drop a file
3. Configure extraction
4. Verify flow progresses correctly

**Step 2: Delete old file**

```bash
rm /Users/fraserbrown/stackdocs/frontend/components/agent/flows/documents/upload-flow.tsx
```

**Step 3: Update any remaining imports**

Search for imports of the old file:

```bash
grep -r "upload-flow" /Users/fraserbrown/stackdocs/frontend/components/agent/
```

Update `agent-popup-content.tsx` if it still references the old import:

```typescript
// frontend/components/agent/agent-popup-content.tsx
// This file may no longer be needed after migration
// If still referenced elsewhere, update to use registry pattern
```

**Step 4: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add -A && git commit -m "refactor(agent): remove old upload-flow.tsx, complete migration"
```

---

## Task 7: End-to-End Testing

**Step 1: Start dev server**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npm run dev
```

**Step 2: Test complete upload flow**

| Test | Expected Result |
|------|-----------------|
| Click Upload button | Card expands, shows dropzone |
| Drop valid file | Transitions to configure step with upload progress |
| Wait for upload | Status changes to "Configure extraction settings" |
| Click Back | Returns to dropzone |
| Drop file again | Back to configure step |
| Select "Custom Fields" | Shows Next button |
| Click Next | Shows fields step |
| Click Back | Returns to configure |
| Select "Auto Extract" | Shows Extract button |
| Click Extract | Card collapses, status shows "Extracting..." |
| Wait for extraction | Status shows "Extraction complete" |
| Expand card | Shows complete step with View/Upload Another |
| Click View Document | Navigates to document page |

**Step 3: Test edge cases**

| Test | Expected Result |
|------|-----------------|
| Click X during configure | Shows confirmation dialog |
| Confirm close | Flow closes, card returns to idle |
| Click outside during flow | Card collapses (flow continues) |
| Expand again | Flow resumes where it was |
| Invalid file type | Shows error in dropzone |
| Upload error | Shows error state |

**Step 4: Document any issues**

Add to `docs/plans/issues/ACTIVE.md` if needed.

**Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix(agent): address issues from upload flow testing"
```

---

## Phase 3 Checklist

- [x] Upload flow metadata created
- [x] Upload flow hook created
- [x] Step components moved to new structure
- [x] Upload flow registered in registry
- [x] Old upload-flow.tsx removed
- [x] End-to-end testing passed
- [x] All edge cases handled

---

## Next Phase

Continue to [Phase 4: Remaining Flows](./phase-4-remaining-flows.md) to stub out the remaining 7 flow types.
