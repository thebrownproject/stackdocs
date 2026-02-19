# Phase 2: UI Components

> **Prerequisites:** Complete Phase 1 first. Read `README.md` for context.

**Tasks:** 4-10
**Goal:** Create all presentational components for the upload dialog.

---

## Task 4: Create UploadStatus Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/upload-status.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/upload-status.tsx
'use client'

import { Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UploadStatus as UploadStatusType } from './types'

interface UploadStatusProps {
  status: UploadStatusType
  error?: string | null
  className?: string
}

/**
 * Shows upload/OCR progress indicator.
 * Displays checkmarks for completed steps, spinner for in-progress.
 */
export function UploadStatus({ status, error, className }: UploadStatusProps) {
  if (status === 'idle') {
    return null
  }

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      {status === 'uploading' && (
        <>
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Uploading document...</span>
        </>
      )}

      {status === 'processing_ocr' && (
        <>
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Processing OCR...</span>
        </>
      )}

      {status === 'ready' && (
        <>
          <Check className="size-3.5 text-green-500" />
          <span className="text-muted-foreground">Ready</span>
        </>
      )}

      {status === 'error' && (
        <>
          <X className="size-3.5 text-destructive" />
          <span className="text-destructive">{error || 'Upload failed'}</span>
        </>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/upload-status.tsx
git commit -m "feat(upload-dialog): add UploadStatus component for progress display"
```

---

## Task 5: Create ExtractionMethodCard Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/extraction-method-card.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/extraction-method-card.tsx
'use client'

import { cn } from '@/lib/utils'

interface ExtractionMethodCardProps {
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}

/**
 * Selectable card for choosing extraction method.
 * Linear-style: subtle background change when selected, no colored borders.
 */
export function ExtractionMethodCard({
  title,
  description,
  selected,
  onSelect,
}: ExtractionMethodCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors',
        'hover:bg-accent/50',
        selected
          ? 'border-border bg-accent/70'
          : 'border-border bg-background'
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/extraction-method-card.tsx
git commit -m "feat(upload-dialog): add ExtractionMethodCard component"
```

---

## Task 6: Create FieldTagInput Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/field-tag-input.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/field-tag-input.tsx
'use client'

import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CustomField } from './types'

interface FieldTagInputProps {
  fields: CustomField[]
  onAdd: (field: CustomField) => void
  onRemove: (name: string) => void
}

/**
 * Tag-based input for custom fields.
 * Allows adding field name + optional description.
 * Shows badges with tooltips for descriptions.
 */
export function FieldTagInput({ fields, onAdd, onRemove }: FieldTagInputProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    // Check for duplicates
    if (fields.some((f) => f.name.toLowerCase() === trimmedName.toLowerCase())) {
      return
    }

    onAdd({
      name: trimmedName,
      description: description.trim() || undefined,
    })
    setName('')
    setDescription('')

    // Focus name input for adding another field
    nameInputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-4">
      {/* Input row */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            ref={nameInputRef}
            placeholder="Field name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!name.trim()}
          >
            Add
          </Button>
        </div>
        <Input
          placeholder="Description (optional) - helps AI understand what to extract"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-sm"
        />
      </div>

      {/* Field badges */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fields.map((field) => (
            <FieldBadge
              key={field.name}
              field={field}
              onRemove={() => onRemove(field.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FieldBadgeProps {
  field: CustomField
  onRemove: () => void
}

function FieldBadge({ field, onRemove }: FieldBadgeProps) {
  const badge = (
    <Badge
      variant="secondary"
      className="gap-1 pr-1 cursor-default"
    >
      {field.name}
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
        aria-label={`Remove ${field.name}`}
      >
        <X className="size-3" />
      </button>
    </Badge>
  )

  // Wrap in tooltip if description exists
  if (field.description) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{field.description}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return badge
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/field-tag-input.tsx
git commit -m "feat(upload-dialog): add FieldTagInput component with badges and tooltips"
```

---

## Task 7: Create DropzoneStep Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/steps/dropzone-step.tsx`

**Step 1: Create the steps directory and component**

```typescript
// frontend/components/documents/upload-dialog/steps/dropzone-step.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UPLOAD_CONSTRAINTS } from '@/lib/upload-config'

interface DropzoneStepProps {
  onFileSelect: (file: File) => void
}

/**
 * Step 1: File dropzone.
 * Accepts PDF, JPG, PNG up to 10MB.
 * Immediately triggers onFileSelect when file is chosen.
 */
export function DropzoneStep({ onFileSelect }: DropzoneStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null)

      // Check type
      if (!UPLOAD_CONSTRAINTS.ACCEPTED_TYPES.includes(file.type as typeof UPLOAD_CONSTRAINTS.ACCEPTED_TYPES[number])) {
        setError('File must be PDF, JPG, or PNG')
        return
      }

      // Check size
      if (file.size > UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES) {
        setError(`File must be under ${UPLOAD_CONSTRAINTS.MAX_SIZE_MB}MB`)
        return
      }

      onFileSelect(file)
    },
    [onFileSelect]
  )

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSelect(file)
    }
    // Reset input for re-selection of same file
    if (inputRef.current) {
      inputRef.current.value = ''
    }
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
    if (file) {
      validateAndSelect(file)
    }
  }

  return (
    <div className="space-y-4">
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
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragging
            ? 'border-primary bg-accent/50'
            : 'border-border hover:border-muted-foreground/50 hover:bg-accent/30'
        )}
      >
        <div className="rounded-full bg-muted p-3">
          <Upload className="size-6 text-muted-foreground" />
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
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/steps/dropzone-step.tsx
git commit -m "feat(upload-dialog): add DropzoneStep component with drag-drop"
```

---

## Task 8: Create ConfigureStep Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/steps/configure-step.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/steps/configure-step.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { ExtractionMethodCard } from '../extraction-method-card'
import type { ExtractionMethod } from '../types'

interface ConfigureStepProps {
  fileName: string
  extractionMethod: ExtractionMethod
  onMethodChange: (method: ExtractionMethod) => void
}

/**
 * Step 2: Configure extraction.
 * Shows file badge, stack chips (placeholder), and extraction method cards.
 */
export function ConfigureStep({
  fileName,
  extractionMethod,
  onMethodChange,
}: ConfigureStepProps) {
  return (
    <div className="space-y-6">
      {/* Selected file badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">File:</span>
        <Badge variant="outline" className="font-normal">
          {fileName}
        </Badge>
      </div>

      {/* Stack selection - placeholder */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Add to Stack</label>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="secondary"
            className="cursor-not-allowed opacity-50"
          >
            Coming soon
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Stack grouping will be available in a future update
        </p>
      </div>

      {/* Extraction method */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Extraction Method</label>
        <div className="grid grid-cols-2 gap-3">
          <ExtractionMethodCard
            title="Auto Extract"
            description="AI analyzes and extracts all fields automatically"
            selected={extractionMethod === 'auto'}
            onSelect={() => onMethodChange('auto')}
          />
          <ExtractionMethodCard
            title="Custom Fields"
            description="Specify exactly which fields to extract"
            selected={extractionMethod === 'custom'}
            onSelect={() => onMethodChange('custom')}
          />
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/steps/configure-step.tsx
git commit -m "feat(upload-dialog): add ConfigureStep component with method selection"
```

---

## Task 9: Create FieldsStep Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/steps/fields-step.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/steps/fields-step.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { FieldTagInput } from '../field-tag-input'
import type { CustomField } from '../types'

interface FieldsStepProps {
  fileName: string
  fields: CustomField[]
  onAddField: (field: CustomField) => void
  onRemoveField: (name: string) => void
}

/**
 * Step 3: Specify custom fields.
 * Shows file badge and field tag input.
 */
export function FieldsStep({
  fileName,
  fields,
  onAddField,
  onRemoveField,
}: FieldsStepProps) {
  return (
    <div className="space-y-6">
      {/* Selected file badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">File:</span>
        <Badge variant="outline" className="font-normal">
          {fileName}
        </Badge>
      </div>

      {/* Field input */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Fields to Extract</label>
          <p className="mt-1 text-xs text-muted-foreground">
            Add the fields you want to extract. Descriptions help the AI understand what to look for.
          </p>
        </div>
        <FieldTagInput
          fields={fields}
          onAdd={onAddField}
          onRemove={onRemoveField}
        />
      </div>

      {/* Helper text */}
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          Add at least one field to continue
        </p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/steps/fields-step.tsx
git commit -m "feat(upload-dialog): add FieldsStep component for custom field input"
```

---

## Task 10: Create ExtractionProgress Component

**Files:**
- Create: `frontend/components/documents/upload-dialog/extraction-progress.tsx`

**Step 1: Create the component**

```typescript
// frontend/components/documents/upload-dialog/extraction-progress.tsx
'use client'

import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentEvent } from '@/lib/agent-api'
import type { ExtractionStatus } from './types'

interface ExtractionProgressProps {
  status: ExtractionStatus
  events: AgentEvent[]
  error: string | null
}

/**
 * Shows extraction progress with event list.
 * Similar styling to AiActivityPanel but inline in dialog.
 */
export function ExtractionProgress({
  status,
  events,
  error,
}: ExtractionProgressProps) {
  if (status === 'idle') {
    return null
  }

  const isExtracting = status === 'extracting'
  const isComplete = status === 'complete'
  const isError = status === 'error'

  const toolEvents = events.filter((e) => e.type === 'tool')

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {isExtracting && (
          <>
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm font-medium">Extracting...</span>
          </>
        )}
        {isComplete && (
          <>
            <Check className="size-4 text-green-500" />
            <span className="text-sm font-medium">Extraction complete</span>
          </>
        )}
        {isError && (
          <>
            <AlertCircle className="size-4 text-destructive" />
            <span className="text-sm font-medium">Extraction failed</span>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive mb-2">{error}</p>
      )}

      {/* Events list */}
      {toolEvents.length > 0 && (
        <div className="space-y-1.5">
          {toolEvents.map((event, i) => (
            <div
              key={`tool-${i}`}
              className={cn(
                'flex items-center gap-2 text-sm text-muted-foreground',
                'animate-in fade-in duration-150'
              )}
            >
              <Check className="size-3 text-green-500 shrink-0" />
              <span>{event.content}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isExtracting && events.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Connecting to agent...
        </p>
      )}

      {/* Complete message */}
      {isComplete && (
        <p className="text-sm text-muted-foreground mt-2">
          Redirecting to document...
        </p>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/upload-dialog/extraction-progress.tsx
git commit -m "feat(upload-dialog): add ExtractionProgress component for SSE events"
```

---

## Phase 2 Complete

**Verify:** Run `npx tsc --noEmit` in frontend directory - should pass.

**Files created:**
- `upload-dialog/upload-status.tsx`
- `upload-dialog/extraction-method-card.tsx`
- `upload-dialog/field-tag-input.tsx`
- `upload-dialog/steps/dropzone-step.tsx`
- `upload-dialog/steps/configure-step.tsx`
- `upload-dialog/steps/fields-step.tsx`
- `upload-dialog/extraction-progress.tsx`

**Next:** Proceed to `phase-3-integration.md`
