# Phase 3: Upload Flow Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current upload flow with a new Realtime-driven flow focused on metadata generation.

**Architecture:** User drops file, frontend calls `POST /api/document/upload` (instant return), then subscribes to Supabase Realtime on that document_id. Backend runs OCR + metadata via BackgroundTasks, updating status and metadata fields in the database. Frontend shows spinner states based on status, then displays metadata form when complete.

**Tech Stack:** Next.js, Zustand, Supabase Realtime, shadcn/ui

---

## Overview

Replace the current upload flow (Dropzone -> Configure -> Fields -> Extracting -> Complete) with a new Realtime-driven flow (Dropzone -> Processing -> Metadata -> Complete).

**Current flow:** User uploads, configures extraction method, optionally specifies fields, waits for extraction, views extracted data.

**New flow:** User uploads (instant return), watches processing via Realtime subscription, reviews/edits AI-generated metadata (display_name, tags, summary), optionally assigns to stack, saves document.

---

## Architecture Changes

### Backend Flow (Phase 2.1 - Already Implemented)

```
POST /api/document/upload (instant return)
     |
     v
BackgroundTask: OCR processing
     | - Updates status: 'uploading' -> 'processing' -> 'ocr_complete'
     | - On failure: status -> 'failed'
     |
     v on success (direct await)
Metadata generation (fire-and-forget)
     | - Writes display_name, tags, summary to documents table
     | - Failures logged but don't affect OCR status
```

### Frontend Flow (This Phase)

```
User drops file
     |
     v
Call POST /api/document/upload
     | - Returns instantly with document_id, status: 'uploading'
     |
     v
Subscribe to Realtime for document_id
     | - Watch status field for progress
     | - Watch display_name, tags, summary for metadata
     |
     v
Show spinner states based on status:
     | - 'uploading' -> "Uploading document..."
     | - 'processing' -> "Extracting text..."
     | - 'ocr_complete' + no metadata -> "Generating metadata..."
     | - 'ocr_complete' + metadata populated -> Show metadata form
     | - 'failed' -> Show error with "Retry" button
     |
     v
User reviews/edits metadata, optionally assigns to stack
     |
     v
Save metadata to database
     |
     v
Complete
```

### Flow Steps

| Current Step | New Step | Purpose |
|--------------|----------|---------|
| `dropzone` | `dropzone` | File selection (unchanged) |
| `configure` | `processing` | Processing state (OCR + metadata generation via Realtime) |
| `fields` | `metadata` | Review/edit AI-generated metadata |
| `extracting` | (removed) | - |
| `complete` | `complete` | Success state with actions |

### State Changes

**UploadFlowStep type:**
```ts
// Current
type UploadFlowStep = 'dropzone' | 'configure' | 'fields' | 'extracting' | 'complete'

// New
type UploadFlowStep = 'dropzone' | 'processing' | 'metadata' | 'complete'
```

**UploadFlowData interface:**
```ts
// Current
interface UploadFlowData {
  file: File | null
  documentId: string | null
  documentName: string
  extractionMethod: ExtractionMethod
  customFields: CustomField[]
  uploadStatus: 'idle' | 'uploading' | 'ready' | 'error'
  uploadError: string | null
  extractionError: string | null
}

// New
interface UploadFlowData {
  file: File | null
  documentId: string | null
  // Metadata fields (AI-generated, user-editable)
  displayName: string
  tags: string[]
  summary: string
  // Optional stack assignment
  stackId: string | null
  stackName: string | null
  // Status tracking
  uploadStatus: 'idle' | 'uploading' | 'processing' | 'ready' | 'error'
  uploadError: string | null
  metadataError: string | null
}
```

---

## Tasks

### Task 1: Update Agent Store Types

**File:** `frontend/components/agent/stores/agent-store.ts`

**Changes:**
1. Update `UploadFlowStep` type to new steps
2. Update `UploadFlowData` interface to new fields
3. Update `initialUploadData` with new defaults
4. Update `getStepStatusText()` helper for new steps
5. Update `getUploadTitle()` helper for new steps

**Code changes:**

```ts
// Line ~10: Update step type
export type UploadFlowStep = 'dropzone' | 'processing' | 'metadata' | 'complete'

// Line ~27-36: Update data interface
export interface UploadFlowData {
  file: File | null
  documentId: string | null
  displayName: string
  tags: string[]
  summary: string
  stackId: string | null
  stackName: string | null
  uploadStatus: 'idle' | 'uploading' | 'processing' | 'ready' | 'error'
  uploadError: string | null
  metadataError: string | null
}

// Line ~66-75: Update initial data
export const initialUploadData: UploadFlowData = {
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
}

// Line ~178-187: Update status text helper
if (flowType === 'upload') {
  switch (step) {
    case 'dropzone': return 'Drop a file to get started'
    case 'processing': return 'Analyzing document...'
    case 'metadata': return 'Review document details'
    case 'complete': return 'Document saved'
  }
}

// Line ~194-201: Update title helper
export function getUploadTitle(step: UploadFlowStep): string {
  switch (step) {
    case 'dropzone': return 'Upload Document'
    case 'processing': return 'Processing'
    case 'metadata': return 'Document Details'
    case 'complete': return 'Complete'
  }
}
```

**Step 1b: Remove unused imports**

The old upload flow used `CustomField` and `ExtractionMethod` types. Remove these imports:

```ts
// REMOVE this import (around line 7):
import type { CustomField, ExtractionMethod } from '@/types/upload'
```

**Acceptance criteria:**
- [ ] TypeScript compiles with no errors
- [ ] New step types match design doc
- [ ] Initial data has sensible defaults
- [ ] No unused imports remaining

---

### Task 2: Create useDocumentRealtime Hook

**File:** `frontend/hooks/use-document-realtime.ts` (new file)

**Purpose:** Subscribe to Supabase Realtime for document status and metadata updates. Based on the existing `useExtractionRealtime` pattern.

**Reference:** See `frontend/hooks/use-extraction-realtime.ts` for the established pattern.

```ts
// frontend/hooks/use-document-realtime.ts
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

export type DocumentStatus = 'uploading' | 'processing' | 'ocr_complete' | 'failed'

export interface DocumentUpdate {
  status: DocumentStatus
  display_name: string | null
  tags: string[] | null
  summary: string | null
}

interface UseDocumentRealtimeOptions {
  documentId: string | null
  onUpdate: (update: DocumentUpdate) => void
  enabled?: boolean
}

export function useDocumentRealtime({
  documentId,
  onUpdate,
  enabled = true,
}: UseDocumentRealtimeOptions): { status: RealtimeStatus } {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onUpdateRef = useRef(onUpdate)

  // Keep onUpdate ref current to avoid stale closures
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    // Skip if no documentId or disabled
    if (!documentId || !enabled) {
      setStatus('disconnected')
      return
    }

    let mounted = true
    let supabaseClient: ReturnType<typeof createClerkSupabaseClient> | null = null
    let refreshInterval: NodeJS.Timeout | null = null

    const setupRealtime = async () => {
      const token = await getToken()

      // Don't continue if unmounted during token fetch
      if (!mounted) return

      supabaseClient = createClerkSupabaseClient(() => getToken())

      if (token) {
        supabaseClient.realtime.setAuth(token)
      }

      const channel = supabaseClient
        .channel(`document:${documentId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'documents',
            filter: `id=eq.${documentId}`,
          },
          (payload) => {
            if (!mounted) return

            const newData = payload.new
            if (!newData || typeof newData !== 'object') return

            const record = newData as Record<string, unknown>
            onUpdateRef.current({
              status: record.status as DocumentStatus,
              display_name: record.display_name as string | null,
              tags: record.tags as string[] | null,
              summary: record.summary as string | null,
            })
          }
        )
        .subscribe((subscribeStatus, err) => {
          if (!mounted) return

          if (subscribeStatus === 'SUBSCRIBED') {
            setStatus('connected')
          } else if (
            subscribeStatus === 'CLOSED' ||
            subscribeStatus === 'CHANNEL_ERROR' ||
            subscribeStatus === 'TIMED_OUT'
          ) {
            console.error(`[Realtime] Document channel failed: ${subscribeStatus}`, err)
            setStatus('disconnected')
          }
        })

      if (!mounted) {
        channel.unsubscribe()
        return
      }

      channelRef.current = channel

      // Refresh auth every 50 seconds (before Clerk's 60s expiry)
      refreshInterval = setInterval(async () => {
        if (!mounted) return
        try {
          const newToken = await getToken()
          if (newToken && supabaseClient) {
            supabaseClient.realtime.setAuth(newToken)
          }
        } catch (err) {
          console.error('[Realtime] Token refresh error:', err)
        }
      }, 50000)
    }

    setupRealtime()

    return () => {
      mounted = false
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [documentId, enabled, getToken])

  return { status }
}
```

**Acceptance criteria:**
- [ ] Hook follows same pattern as `useExtractionRealtime`
- [ ] Subscribes to `documents` table changes for specific document_id
- [ ] Returns status, display_name, tags, summary on update
- [ ] Handles token refresh (50 second interval)
- [ ] Cleans up subscription on unmount
- [ ] `enabled` flag allows conditional subscription
- [ ] TypeScript compiles without errors

---

### Task 3: Create Processing Step Component

**File:** `frontend/components/agent/flows/documents/upload/steps/upload-processing.tsx` (new file)

**Purpose:** Show processing state while OCR and metadata generation run via Realtime updates.

**UI states based on document status:**
- `uploading` -> "Uploading document..."
- `processing` -> "Extracting text..."
- `ocr_complete` + no metadata -> "Generating metadata..."
- `ocr_complete` + metadata populated -> (transitions to metadata step)
- `failed` -> Error with "Retry" button

```tsx
// frontend/components/agent/flows/documents/upload/steps/upload-processing.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import type { DocumentStatus } from '@/hooks/use-document-realtime'

interface UploadProcessingProps {
  documentStatus: DocumentStatus | null
  hasMetadata: boolean
  onRetry: () => void
  isRetrying: boolean
}

const statusMessages: Record<DocumentStatus, string> = {
  uploading: 'Uploading document...',
  processing: 'Extracting text...',
  ocr_complete: 'Generating metadata...',
  failed: 'Processing failed',
}

export function UploadProcessing({
  documentStatus,
  hasMetadata,
  onRetry,
  isRetrying,
}: UploadProcessingProps) {
  // Determine what to show
  const isFailed = documentStatus === 'failed'

  // Get message - show "Generating metadata..." when OCR complete but no metadata yet
  const message = documentStatus
    ? (documentStatus === 'ocr_complete' && !hasMetadata)
      ? 'Generating metadata...'
      : statusMessages[documentStatus]
    : 'Starting upload...'

  if (isFailed) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Icons.AlertCircle className="size-4 shrink-0" />
          <span>Document processing failed. Please try again.</span>
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <>
                <Icons.Loader2 className="size-4 animate-spin mr-2" />
                Retrying...
              </>
            ) : (
              <>
                <Icons.Refresh className="size-4 mr-2" />
                Retry
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Check if upload step is complete (status is beyond 'uploading')
  const uploadComplete = documentStatus && ['processing', 'ocr_complete', 'failed'].includes(documentStatus)

  // Normal processing state
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span>{message}</span>
      </div>

      {/* Progress indicators */}
      <div className="space-y-1.5">
        {/* Upload step */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {uploadComplete ? (
            <Icons.Check className="size-3.5 text-green-500 shrink-0" />
          ) : (
            <Icons.Circle className="size-3.5 shrink-0" />
          )}
          <span>Upload file</span>
        </div>

        {/* OCR step */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {documentStatus === 'ocr_complete' ? (
            <Icons.Check className="size-3.5 text-green-500 shrink-0" />
          ) : (
            <Icons.Circle className="size-3.5 shrink-0" />
          )}
          <span>Extract text</span>
        </div>

        {/* Metadata step */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {hasMetadata ? (
            <Icons.Check className="size-3.5 text-green-500 shrink-0" />
          ) : (
            <Icons.Circle className="size-3.5 shrink-0" />
          )}
          <span>Generate metadata</span>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance criteria:**
- [ ] Shows spinner with appropriate message for each status
- [ ] Shows progress indicators (checkmarks for completed steps)
- [ ] Shows error state with "Retry" button when failed
- [ ] Matches existing step visual style
- [ ] Uses icons from `@/components/icons`

---

### Task 4: Create Metadata Step Component

**File:** `frontend/components/agent/flows/documents/upload/steps/upload-metadata.tsx` (new file)

**Purpose:** Review and edit AI-generated metadata before saving. This is the core new component.

**UI mockup from design doc:**
```
+--------------------------------------------------+
| Document Details                                  |
|                                                   |
| Name                                              |
| [Invoice - Acme Corp - March 2026.pdf       ]    |
|                                                   |
| Tags                                              |
| [invoice] [acme-corp] [$1,250] [+]               |
|                                                   |
| Summary                                           |
| +-----------------------------------------------+|
| | Monthly consulting invoice from Acme Corp     ||
| | dated March 15, 2026 for $1,250.00           ||
| +-----------------------------------------------+|
|                                                   |
| Add to Stack (optional)                           |
| [Select a stack...                          v]   |
|                                                   |
|              [Regenerate]  [Save Document]        |
+--------------------------------------------------+
```

```tsx
// frontend/components/agent/flows/documents/upload/steps/upload-metadata.tsx
'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StackPickerContent } from '@/components/shared/stack-picker-content'
import * as Icons from '@/components/icons'
import type { UploadFlowData } from '../../../../stores/agent-store'

interface UploadMetadataProps {
  data: UploadFlowData
  onUpdate: (data: Partial<UploadFlowData>) => void
  onSave: () => void
  onRegenerate: () => void
  isSaving: boolean
  isRegenerating: boolean
}

export function UploadMetadata({
  data,
  onUpdate,
  onSave,
  onRegenerate,
  isSaving,
  isRegenerating,
}: UploadMetadataProps) {
  const [newTag, setNewTag] = useState('')
  const [stackPickerOpen, setStackPickerOpen] = useState(false)

  const handleAddTag = useCallback(() => {
    const tag = newTag.trim().toLowerCase()
    if (tag && !data.tags.includes(tag)) {
      onUpdate({ tags: [...data.tags, tag] })
    }
    setNewTag('')
  }, [newTag, data.tags, onUpdate])

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    onUpdate({ tags: data.tags.filter((t) => t !== tagToRemove) })
  }, [data.tags, onUpdate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }, [handleAddTag])

  const handleSelectStack = useCallback((stackId: string, stackName: string) => {
    // Toggle: if same stack selected, deselect
    if (data.stackId === stackId) {
      onUpdate({ stackId: null, stackName: null })
    } else {
      onUpdate({ stackId, stackName })
    }
    setStackPickerOpen(false)
  }, [data.stackId, onUpdate])

  const handleClearStack = useCallback(() => {
    onUpdate({ stackId: null, stackName: null })
  }, [onUpdate])

  return (
    <div className="space-y-4">
      {/* Display Name */}
      <div className="space-y-1.5">
        <label htmlFor="display-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="display-name"
          value={data.displayName}
          onChange={(e) => onUpdate({ displayName: e.target.value })}
          placeholder="Document name"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${tag} tag`}
              >
                <Icons.X className="size-3" />
              </button>
            </Badge>
          ))}
          <div className="flex items-center gap-1">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add tag..."
              className="h-6 w-24 text-xs"
              aria-label="New tag name"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              aria-label="Add tag"
            >
              <Icons.Plus className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1.5">
        <label htmlFor="summary" className="text-sm font-medium">
          Summary
        </label>
        <Textarea
          id="summary"
          value={data.summary}
          onChange={(e) => onUpdate({ summary: e.target.value })}
          placeholder="Brief description of the document"
          className="min-h-16 resize-none"
          rows={2}
        />
      </div>

      {/* Stack Assignment */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Add to Stack <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        {data.stackId ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Icons.Stack className="size-3" />
              {data.stackName}
              <button
                type="button"
                onClick={handleClearStack}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label="Remove stack assignment"
              >
                <Icons.X className="size-3" />
              </button>
            </Badge>
          </div>
        ) : (
          <DropdownMenu open={stackPickerOpen} onOpenChange={setStackPickerOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="text-muted-foreground">Select a stack...</span>
                <Icons.ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
              <StackPickerContent
                onSelectStack={handleSelectStack}
                isOpen={stackPickerOpen}
                showStackIcon
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Error display */}
      {data.metadataError && (
        <p className="text-sm text-destructive">{data.metadataError}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onRegenerate}
          disabled={isRegenerating || isSaving}
        >
          {isRegenerating ? (
            <>
              <Icons.Loader2 className="size-4 animate-spin mr-2" />
              Regenerating...
            </>
          ) : (
            <>
              <Icons.Refresh className="size-4 mr-2" />
              Regenerate
            </>
          )}
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving || isRegenerating || !data.displayName.trim()}
        >
          {isSaving ? (
            <>
              <Icons.Loader2 className="size-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Document'
          )}
        </Button>
      </div>
    </div>
  )
}
```

**Acceptance criteria:**
- [ ] Editable display name input
- [ ] Tag list with add/remove functionality
- [ ] Editable summary textarea
- [ ] Optional stack picker dropdown (uses existing `StackPickerContent`)
- [ ] Regenerate button to re-run metadata generation
- [ ] Save button with loading state
- [ ] Error display for metadata errors
- [ ] Proper form accessibility (labels, aria attributes)

---

### Task 5: Update Complete Step Component

**File:** `frontend/components/agent/flows/documents/upload/steps/upload-complete.tsx`

**Changes:**
1. Update success message (no longer mentions "extraction")
2. Change "View Document" to "Done" (navigates to documents list)
3. Keep "Upload Another" button

```tsx
// frontend/components/agent/flows/documents/upload/steps/upload-complete.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'

interface UploadCompleteProps {
  documentName: string
  onDone: () => void
  onUploadAnother: () => void
}

export function UploadComplete({
  documentName,
  onDone,
  onUploadAnother,
}: UploadCompleteProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Icons.Check className="size-4 text-green-500" />
        <span>Document saved: {documentName}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onUploadAnother}>
          Upload Another
        </Button>
        <Button onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  )
}
```

**Acceptance criteria:**
- [ ] Success message says "Document saved" not "extracted"
- [ ] "Done" button closes flow and stays on documents page
- [ ] "Upload Another" resets flow to dropzone

---

### Task 6: Update Steps Index Export

**File:** `frontend/components/agent/flows/documents/upload/steps/index.ts`

**Changes:**
1. Remove exports for `UploadConfigure`, `UploadFields`, `UploadExtracting`
2. Add exports for `UploadProcessing`, `UploadMetadata`

```ts
// frontend/components/agent/flows/documents/upload/steps/index.ts
export { UploadDropzone } from './upload-dropzone'
export { UploadProcessing } from './upload-processing'
export { UploadMetadata } from './upload-metadata'
export { UploadComplete } from './upload-complete'
```

**Note:** Do not delete the old files yet - they can be deleted in Phase 5 cleanup.

**Acceptance criteria:**
- [ ] Only new step components exported
- [ ] TypeScript finds all exports correctly

---

### Task 7: Update Flow Metadata

**File:** `frontend/components/agent/flows/documents/upload/metadata.ts`

**Changes:**
1. Update steps array to new flow
2. Update icons for each step
3. Update status text for each step
4. Update component mapping
5. Update backable/confirmation steps

**Note:** The `components` mapping in flow metadata provides step components to `AgentCard`. AgentCard spreads `stepProps[step]` to each component, so components receive their props via this mechanism.

```ts
// frontend/components/agent/flows/documents/upload/metadata.ts
import * as Icons from '@/components/icons'
import type { FlowMetadata } from '../../types'
import type { UploadFlowStep } from '../../../stores/agent-store'

import {
  UploadDropzone,
  UploadProcessing,
  UploadMetadata,
  UploadComplete,
} from './steps'

export const uploadFlowMetadata: FlowMetadata<UploadFlowStep> = {
  type: 'upload',

  steps: ['dropzone', 'processing', 'metadata', 'complete'] as const,

  icons: {
    dropzone: Icons.Upload,
    processing: Icons.Loader2,
    metadata: Icons.FileText,
    complete: Icons.Check,
  },

  statusText: {
    dropzone: 'Drop a file to get started',
    processing: 'Analyzing document...',
    metadata: 'Review document details',
    complete: 'Document saved',
  },

  minimizedText: 'Continue file upload...',

  components: {
    dropzone: UploadDropzone,
    processing: UploadProcessing,
    metadata: UploadMetadata,
    complete: UploadComplete,
  },

  backableSteps: [] as const, // No back navigation in new flow

  confirmationSteps: ['processing'] as const, // Only confirm close during processing
}
```

**Acceptance criteria:**
- [ ] Steps array matches new flow
- [ ] Icons appropriate for each step
- [ ] Status text matches design doc
- [ ] Components correctly mapped
- [ ] Confirmation only during processing step

---

### Task 8: Add `streamDocumentMetadata` to agent-api.ts

**File:** `frontend/lib/agent-api.ts`

**Purpose:** Add the missing SSE streaming function for manual metadata regeneration.

**Add this function after `streamAgentExtraction`:**

```ts
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
```

**Acceptance criteria:**
- [ ] Function follows same pattern as `streamAgentExtraction`
- [ ] Calls `POST /api/document/metadata` endpoint
- [ ] Properly handles SSE buffering
- [ ] TypeScript compiles without errors

---

### Task 9: Rewrite Upload Flow Hook

**File:** `frontend/components/agent/flows/documents/upload/use-upload-flow.ts`

**Changes:**
This is a significant rewrite. The new flow uses Realtime for status tracking:

1. **Dropzone** - User selects file
2. **handleFileSelect** - Upload to storage (instant return), subscribe to Realtime
3. **Processing** - Show progress based on Realtime status updates
4. **Metadata** - Populate form when Realtime shows metadata complete
5. **handleRegenerate** - Call SSE endpoint for manual regeneration
6. **handleSave** - Save metadata to database
7. **Complete** - Show success, offer to upload another or done

```ts
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

      // Store document_id - Realtime subscription will start automatically
      updateFlowData({
        documentId: result.document_id,
        uploadStatus: 'processing',
      })
      setDocumentStatus(result.status as DocumentStatus)

    } catch (error) {
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
```

**Acceptance criteria:**
- [ ] File upload triggers instant return, Realtime subscription starts
- [ ] Processing step shows progress based on Realtime status updates
- [ ] Metadata step auto-populates when Realtime shows metadata complete
- [ ] Retry button works for failed documents
- [ ] Regenerate uses SSE endpoint for manual regeneration
- [ ] Save writes to documents table + optional stack_documents
- [ ] Done closes flow and refreshes page
- [ ] Upload Another resets state
- [ ] Proper abort controller cleanup for SSE

---

### Task 10: Add Missing Icon Exports

**File:** `frontend/components/icons/index.ts`

**Verify these icons are exported (add if missing):**
- `Refresh` - for regenerate/retry button
- `X` - for removing tags/stack
- `Plus` - for adding tags
- `ChevronDown` - for stack dropdown
- `FileText` - for metadata step icon
- `AlertCircle` - for error state
- `Circle` - for progress indicators (unfilled)

Check the existing barrel export and add any that are missing.

**Acceptance criteria:**
- [ ] All icons used in new components are exported
- [ ] TypeScript finds all icon imports

---

### Task 11: Delete Old Step Components

**Files to delete:**
- `frontend/components/agent/flows/documents/upload/steps/upload-configure.tsx`
- `frontend/components/agent/flows/documents/upload/steps/upload-fields.tsx`
- `frontend/components/agent/flows/documents/upload/steps/upload-extracting.tsx`
- `frontend/components/agent/flows/documents/upload/steps/extraction-method-card.tsx`
- `frontend/components/agent/flows/documents/upload/steps/field-tag-input.tsx`

**Note:** Only delete after verifying the build passes with new components.

**Acceptance criteria:**
- [ ] All old step files removed
- [ ] No imports reference deleted files
- [ ] Build passes

---

## Testing

### Manual Testing Checklist

1. **Upload Flow**
   - [ ] Drop a PDF file
   - [ ] See "Uploading document..." status (instant return)
   - [ ] See "Extracting text..." status (via Realtime)
   - [ ] See "Generating metadata..." status (via Realtime)
   - [ ] Arrive at metadata step with pre-filled values

2. **Realtime Updates**
   - [ ] Status updates reflect in UI without polling
   - [ ] Metadata populates automatically when backend completes
   - [ ] Multiple uploads can be tracked (via different document_ids)

3. **Failed Document Handling**
   - [ ] Failed OCR shows error state with "Retry" button
   - [ ] Retry triggers `POST /api/document/retry-ocr`
   - [ ] Status updates after retry via Realtime

4. **Metadata Editing**
   - [ ] Edit display name
   - [ ] Add a new tag
   - [ ] Remove an existing tag
   - [ ] Edit summary
   - [ ] Select a stack from dropdown
   - [ ] Remove stack selection

5. **Regenerate**
   - [ ] Click Regenerate button
   - [ ] See loading state (SSE streaming)
   - [ ] Values update with new AI-generated content

6. **Save**
   - [ ] Click Save Document
   - [ ] See loading state
   - [ ] Arrive at complete step
   - [ ] Verify document in database has metadata

7. **Complete Actions**
   - [ ] "Upload Another" returns to dropzone
   - [ ] "Done" closes card and stays on page

8. **Error Handling**
   - [ ] Network error during upload shows error message
   - [ ] Metadata generation failure shows error but allows manual editing
   - [ ] Save failure shows error message

---

## Dependencies

This phase requires:
- Phase 1 (Database): `display_name`, `tags`, `summary` columns on `documents` table
- Phase 2.1 (Backend): Background processing chain with Realtime-compatible status updates

If implementing before Phase 2.1 is complete, the Realtime subscription will not receive updates and the flow will hang at processing.

---

## Files Modified

| File | Change |
|------|--------|
| `frontend/components/agent/stores/agent-store.ts` | Update types and helpers |
| `frontend/hooks/use-document-realtime.ts` | New file - Realtime subscription hook |
| `frontend/components/agent/flows/documents/upload/steps/upload-processing.tsx` | New file |
| `frontend/components/agent/flows/documents/upload/steps/upload-metadata.tsx` | New file |
| `frontend/components/agent/flows/documents/upload/steps/upload-complete.tsx` | Update props and messaging |
| `frontend/components/agent/flows/documents/upload/steps/index.ts` | Update exports |
| `frontend/components/agent/flows/documents/upload/metadata.ts` | Update flow config |
| `frontend/lib/agent-api.ts` | Add `streamDocumentMetadata` function |
| `frontend/components/agent/flows/documents/upload/use-upload-flow.ts` | Rewrite flow logic with Realtime |
| `frontend/components/icons/index.ts` | Add any missing icons |

**Files to delete:**
| File |
|------|
| `frontend/components/agent/flows/documents/upload/steps/upload-configure.tsx` |
| `frontend/components/agent/flows/documents/upload/steps/upload-fields.tsx` |
| `frontend/components/agent/flows/documents/upload/steps/upload-extracting.tsx` |
| `frontend/components/agent/flows/documents/upload/steps/extraction-method-card.tsx` |
| `frontend/components/agent/flows/documents/upload/steps/field-tag-input.tsx` |

---

## Key Architecture Decisions

### Why Realtime Instead of SSE

**Previous approach (SSE):**
- Frontend called `POST /api/document/upload` and waited for OCR
- Then called `POST /api/document/metadata` with SSE stream for metadata
- Required maintaining SSE connection and parsing events
- Two separate network requests, blocking behavior

**New approach (Realtime):**
- Frontend calls `POST /api/document/upload` (instant return)
- Backend runs OCR + metadata via BackgroundTasks, updates database
- Frontend subscribes to Supabase Realtime for that document_id
- Single network request, non-blocking, automatic updates

**Benefits:**
- Faster perceived performance (instant return)
- Simpler frontend code (no SSE parsing for progress)
- Consistent with rest of app (uses existing Realtime infrastructure)
- Better error recovery (document status persisted in database)
- User can close and reopen flow, status is preserved

### SSE Still Used For Regenerate

The "Regenerate" button still uses SSE via `POST /api/document/metadata` because:
- It's a manual action that needs progress feedback
- User is actively waiting and expects to see activity
- The existing SSE infrastructure works well for this use case
- Regenerate is less common than initial upload
