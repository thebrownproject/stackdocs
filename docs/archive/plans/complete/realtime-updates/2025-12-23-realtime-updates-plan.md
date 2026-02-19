# Realtime Updates & Extracted Fields Table - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-refresh extracted data when AI updates it, and redesign the table with TanStack Table + expanding rows.

**Architecture:** Client wrapper component with Supabase realtime subscription. TanStack Table with `getExpandedRowModel()` for nested data. Smart renderer detects data shape and picks display pattern.

**Tech Stack:** Supabase Realtime, TanStack Table, shadcn/ui Table components, React state

---

## Stage 1: Realtime Updates

### Task 1: Create `useExtractionRealtime` Hook

**Files:**
- Create: `frontend/hooks/use-extraction-realtime.ts`

**Step 1: Create the hook file with types and basic structure**

```typescript
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

export interface ExtractionUpdate {
  extracted_fields: Record<string, unknown>
  confidence_scores: Record<string, number>
}

interface UseExtractionRealtimeOptions {
  documentId: string
  onUpdate: (extraction: ExtractionUpdate) => void
}

export function useExtractionRealtime({
  documentId,
  onUpdate,
}: UseExtractionRealtimeOptions): { status: RealtimeStatus } {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onUpdateRef = useRef(onUpdate)

  // Keep onUpdate ref current to avoid stale closures
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    // Fix #1: Wrap getToken in arrow function - createClerkSupabaseClient expects () => Promise<string | null>
    const supabase = createClerkSupabaseClient(() => getToken())

    const channel = supabase
      .channel(`extraction:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'extractions',
          filter: `document_id=eq.${documentId}`,
        },
        (payload) => {
          // Fix #2: Validate payload before accessing properties
          const newData = payload.new
          if (!newData || typeof newData !== 'object') {
            console.error('Invalid realtime payload:', payload)
            return
          }

          const extracted_fields = (newData as Record<string, unknown>).extracted_fields as Record<string, unknown> | undefined
          const confidence_scores = (newData as Record<string, unknown>).confidence_scores as Record<string, number> | undefined

          onUpdateRef.current({
            extracted_fields: extracted_fields || {},
            confidence_scores: confidence_scores || {},
          })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('connected')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setStatus('disconnected')
        }
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [documentId, getToken])

  return { status }
}
```

**Step 2: Verify file was created**

Run: `ls frontend/hooks/use-extraction-realtime.ts`
Expected: File exists

**Step 3: Type check the hook**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors related to `use-extraction-realtime.ts`

**Step 4: Commit**

```bash
git add frontend/hooks/use-extraction-realtime.ts
git commit -m "feat: add useExtractionRealtime hook for Supabase subscription"
```

---

### Task 2: Create `DocumentDetailClient` Wrapper Component

**Files:**
- Create: `frontend/components/documents/document-detail-client.tsx`

**Step 1: Create the client wrapper component**

```typescript
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useExtractionRealtime, ExtractionUpdate } from '@/hooks/use-extraction-realtime'
import { ExtractedDataTable } from './extracted-data-table'
import { PreviewPanel } from './preview-panel'
import { AiChatBar } from './ai-chat-bar'
import type { DocumentWithExtraction } from '@/types/documents'

interface DocumentDetailClientProps {
  initialDocument: DocumentWithExtraction
  signedUrl: string | null
}

export function DocumentDetailClient({
  initialDocument,
  signedUrl,
}: DocumentDetailClientProps) {
  const [document, setDocument] = useState(initialDocument)
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set())

  // Fix #3: Use ref to access current document state without recreating callback
  const documentRef = useRef(document)
  useEffect(() => {
    documentRef.current = document
  }, [document])

  const handleExtractionUpdate = useCallback(
    (update: ExtractionUpdate) => {
      // Find which fields changed - use ref to avoid stale closure
      const newChangedFields = new Set<string>()
      const oldFields = documentRef.current.extracted_fields || {}
      const newFields = update.extracted_fields || {}

      for (const key of Object.keys(newFields)) {
        if (JSON.stringify(oldFields[key]) !== JSON.stringify(newFields[key])) {
          newChangedFields.add(key)
        }
      }

      // Update document state
      setDocument((prev) => ({
        ...prev,
        extracted_fields: update.extracted_fields,
        confidence_scores: update.confidence_scores,
      }))

      // Set changed fields for highlight animation
      setChangedFields(newChangedFields)
    },
    [] // Stable callback - no dependencies since we use ref
  )

  // Clear changed fields after animation (1.5s)
  useEffect(() => {
    if (changedFields.size > 0) {
      const timer = setTimeout(() => {
        setChangedFields(new Set())
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [changedFields])

  const { status } = useExtractionRealtime({
    documentId: document.id,
    onUpdate: handleExtractionUpdate,
  })

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Main content - asymmetric layout */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-auto">
        {/* Left: Extracted Data - narrow fixed width */}
        <div className="w-80 shrink-0">
          <ExtractedDataTable
            fields={document.extracted_fields}
            confidenceScores={document.confidence_scores}
            changedFields={changedFields}
          />
        </div>

        {/* Right: Preview - takes remaining space */}
        <div className="flex-1 min-w-0">
          <PreviewPanel
            pdfUrl={signedUrl}
            ocrText={document.ocr_raw_text}
            mimeType={document.mime_type}
          />
        </div>
      </div>

      {/* AI Chat Bar - inline at bottom */}
      <div className="shrink-0 mt-6">
        <AiChatBar documentId={document.id} />
      </div>
    </div>
  )
}
```

**Step 2: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Error about `changedFields` prop not existing on ExtractedDataTable (expected - we'll add it next)

**Step 3: Commit**

```bash
git add frontend/components/documents/document-detail-client.tsx
git commit -m "feat: add DocumentDetailClient with realtime subscription and change tracking"
```

---

### Task 3: Update Page to Use Client Wrapper

**Files:**
- Modify: `frontend/app/(app)/documents/[id]/page.tsx`

**Step 1: Update page.tsx to pass data to client component**

Replace entire file content:

```typescript
import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DocumentDetailClient } from '@/components/documents/document-detail-client'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  if (!document) {
    notFound()
  }

  // Get signed URL for PDF viewing
  let signedUrl: string | null = null
  if (document.file_path) {
    try {
      const supabase = await createServerSupabaseClient()
      const { data } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 3600) // 1 hour expiry

      signedUrl = data?.signedUrl || null
    } catch {
      // Gracefully degrade - page still renders without PDF preview
      signedUrl = null
    }
  }

  return <DocumentDetailClient initialDocument={document} signedUrl={signedUrl} />
}
```

**Step 2: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Still error about `changedFields` prop (expected)

**Step 3: Commit**

```bash
git add frontend/app/(app)/documents/[id]/page.tsx
git commit -m "refactor: use DocumentDetailClient for realtime updates"
```

---

### Task 4: Add `changedFields` Prop to ExtractedDataTable

**Files:**
- Modify: `frontend/components/documents/extracted-data-table.tsx`

**Step 1: Update the component interface and add highlight class**

Add `changedFields` prop and apply highlight animation to changed rows.

In `extracted-data-table.tsx`, update the interface:

```typescript
interface ExtractedDataTableProps {
  fields: Record<string, unknown> | null
  confidenceScores: Record<string, number> | null
  changedFields?: Set<string>
}
```

Update the component signature:

```typescript
export function ExtractedDataTable({
  fields,
  confidenceScores,
  changedFields = new Set(),
}: ExtractedDataTableProps) {
```

Update the row div to include highlight animation:

```typescript
<div
  key={key}
  className={cn(
    "flex items-center justify-between py-2.5 px-1 group transition-colors duration-1000",
    changedFields.has(key) && "bg-primary/10"
  )}
>
```

Add `cn` import at top:

```typescript
import { cn } from '@/lib/utils'
```

**Step 2: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 3: Test locally**

Run: `cd frontend && npm run dev`
- Navigate to a document detail page
- Use AI chat bar to correct something
- Verify the field highlights briefly then fades

**Step 4: Commit**

```bash
git add frontend/components/documents/extracted-data-table.tsx
git commit -m "feat: add changedFields highlight animation to extracted data table"
```

---

## Stage 2: TanStack Table Redesign

### Task 5: Create Data Transformation Utilities

**Files:**
- Create: `frontend/lib/transform-extracted-fields.ts`

**Step 1: Create utility for detecting data shape and transforming to table rows**

```typescript
export type DataShape =
  | 'primitive'
  | 'key-value'
  | 'string-array'
  | 'grouped-arrays'
  | 'object-array'

export interface ExtractedFieldRow {
  id: string
  field: string
  value: unknown
  displayValue: string
  confidence?: number
  dataShape: DataShape
  subRows?: ExtractedFieldRow[]
  depth: number
  // Fix #5: Add properties for object-array rendering
  _columns?: string[]
  _values?: unknown[]
}

function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isObjectArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
  )
}

function isGroupedArrays(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((v) => isStringArray(v))
}

function isKeyValueObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((v) => isPrimitive(v))
}

export function detectDataShape(value: unknown): DataShape {
  if (isPrimitive(value)) return 'primitive'
  if (isStringArray(value)) return 'string-array'
  if (isObjectArray(value)) return 'object-array'
  if (isGroupedArrays(value)) return 'grouped-arrays'
  if (isKeyValueObject(value)) return 'key-value'
  // Default to key-value for complex nested objects
  return 'key-value'
}

function formatFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function getSummary(value: unknown, shape: DataShape): string {
  switch (shape) {
    case 'primitive':
      if (value === null || value === undefined) return '—'
      return String(value)
    case 'string-array':
      return `${(value as string[]).length} items`
    case 'object-array':
      return `${(value as object[]).length} items`
    case 'grouped-arrays': {
      const categories = Object.keys(value as object).length
      return `${categories} categories`
    }
    case 'key-value': {
      const fields = Object.keys(value as object).length
      return `${fields} fields`
    }
    default:
      return ''
  }
}

function transformKeyValue(
  obj: Record<string, unknown>,
  parentId: string,
  depth: number
): ExtractedFieldRow[] {
  return Object.entries(obj).map(([key, val]) => ({
    id: `${parentId}-${key}`,
    field: formatFieldName(key),
    value: val,
    displayValue: isPrimitive(val) ? (val === null ? '—' : String(val)) : '',
    dataShape: 'primitive' as DataShape,
    depth,
  }))
}

function transformStringArray(arr: string[], parentId: string, depth: number): ExtractedFieldRow[] {
  // Return single row with joined values for inline display
  return [
    {
      id: `${parentId}-items`,
      field: '',
      value: arr,
      displayValue: arr.join(' · '),
      dataShape: 'string-array' as DataShape,
      depth,
    },
  ]
}

function transformGroupedArrays(
  obj: Record<string, string[]>,
  parentId: string,
  depth: number
): ExtractedFieldRow[] {
  return Object.entries(obj).map(([key, arr]) => ({
    id: `${parentId}-${key}`,
    field: formatFieldName(key),
    value: arr,
    displayValue: arr.join(' · '),
    dataShape: 'string-array' as DataShape,
    depth,
  }))
}

function transformObjectArray(
  arr: Record<string, unknown>[],
  parentId: string,
  depth: number
): ExtractedFieldRow[] {
  // Get all unique keys from objects
  const allKeys = [...new Set(arr.flatMap((obj) => Object.keys(obj)))]

  return arr.map((obj, index): ExtractedFieldRow => ({
    id: `${parentId}-${index}`,
    field: allKeys.map((k) => obj[k]).join(' | '),
    value: obj,
    displayValue: '',
    dataShape: 'primitive' as DataShape,
    depth,
    // Store columns for table rendering (now properly typed in interface)
    _columns: allKeys,
    _values: allKeys.map((k) => obj[k]),
  }))
}

export function transformExtractedFields(
  fields: Record<string, unknown> | null,
  confidenceScores: Record<string, number> | null
): ExtractedFieldRow[] {
  // Fix #10: Add null safety - validate fields object
  if (!fields || typeof fields !== 'object') return []

  return Object.entries(fields)
    .filter(([_, value]) => value !== undefined) // Skip undefined values
    .map(([key, value]) => {
    const shape = detectDataShape(value)
    const confidence = confidenceScores?.[key]

    const row: ExtractedFieldRow = {
      id: key,
      field: formatFieldName(key),
      value,
      displayValue: getSummary(value, shape),
      confidence,
      dataShape: shape,
      depth: 0,
    }

    // Add subRows for expandable content
    if (shape === 'key-value') {
      row.subRows = transformKeyValue(value as Record<string, unknown>, key, 1)
    } else if (shape === 'string-array') {
      row.subRows = transformStringArray(value as string[], key, 1)
    } else if (shape === 'grouped-arrays') {
      row.subRows = transformGroupedArrays(value as Record<string, string[]>, key, 1)
    } else if (shape === 'object-array') {
      row.subRows = transformObjectArray(value as Record<string, unknown>[], key, 1)
    }

    return row
  })
}
```

**Step 2: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add frontend/lib/transform-extracted-fields.ts
git commit -m "feat: add data shape detection and field transformation utilities"
```

---

### Task 6: Create Column Definitions for Extracted Data Table

**Files:**
- Create: `frontend/components/documents/extracted-columns.tsx`

**Step 1: Create column definitions mirroring documents-table pattern**

```typescript
'use client'

import { ColumnDef } from '@tanstack/react-table'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExtractedFieldRow } from '@/lib/transform-extracted-fields'

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return null

  const percentage = Math.round(confidence * 100)
  const colorClass =
    percentage >= 90
      ? 'text-emerald-600'
      : percentage >= 70
        ? 'text-amber-500'
        : 'text-red-500'

  return (
    <span className={cn('font-mono text-xs tabular-nums', colorClass)}>
      {percentage}%
    </span>
  )
}

export const extractedColumns: ColumnDef<ExtractedFieldRow>[] = [
  {
    accessorKey: 'field',
    header: () => <span className="text-muted-foreground">Field</span>,
    cell: ({ row }) => {
      const depth = row.original.depth
      const canExpand = row.getCanExpand()
      const isExpanded = row.getIsExpanded()

      return (
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          {canExpand ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                row.toggleExpanded()
              }}
              className="p-0.5 hover:bg-muted rounded"
              // Fix #7: Add ARIA attributes for accessibility
              aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span className={cn(depth === 0 ? 'font-medium' : 'text-muted-foreground')}>
            {row.original.field}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'displayValue',
    header: () => <span className="text-muted-foreground">Value</span>,
    cell: ({ row }) => {
      const { displayValue, dataShape } = row.original

      // For string arrays shown inline
      if (dataShape === 'string-array' && row.original.depth > 0) {
        return (
          <span className="text-sm text-muted-foreground">{displayValue}</span>
        )
      }

      // For primitives (currency, numbers, etc.)
      if (dataShape === 'primitive') {
        const isCurrency =
          typeof displayValue === 'string' && /^\$?[\d,]+\.?\d*$/.test(displayValue)
        return (
          <span
            className={cn(
              'text-sm',
              isCurrency ? 'font-mono tabular-nums' : ''
            )}
          >
            {displayValue || '—'}
          </span>
        )
      }

      // Summary for expandable rows
      return (
        <span className="text-sm text-muted-foreground">{displayValue}</span>
      )
    },
  },
  {
    accessorKey: 'confidence',
    header: () => (
      <span className="text-muted-foreground text-right block">Conf.</span>
    ),
    cell: ({ row }) => (
      <div className="text-right">
        <ConfidenceBadge confidence={row.original.confidence} />
      </div>
    ),
    size: 60,
  },
]
```

**Step 2: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add frontend/components/documents/extracted-columns.tsx
git commit -m "feat: add TanStack column definitions for extracted data table"
```

---

### Task 7: Rewrite ExtractedDataTable with TanStack Table

**Files:**
- Modify: `frontend/components/documents/extracted-data-table.tsx`

**Step 1: Replace entire file with TanStack Table implementation**

```typescript
'use client'

import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  ExpandedState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { extractedColumns } from './extracted-columns'
import {
  transformExtractedFields,
  ExtractedFieldRow,
} from '@/lib/transform-extracted-fields'

interface ExtractedDataTableProps {
  fields: Record<string, unknown> | null
  confidenceScores: Record<string, number> | null
  changedFields?: Set<string>
}

export function ExtractedDataTable({
  fields,
  confidenceScores,
  changedFields = new Set(),
}: ExtractedDataTableProps) {
  const [expanded, setExpanded] = React.useState<ExpandedState>({})

  const data = React.useMemo(
    () => transformExtractedFields(fields, confidenceScores),
    [fields, confidenceScores]
  )

  const table = useReactTable({
    data,
    columns: extractedColumns,
    state: {
      expanded,
    },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  })

  if (!fields || Object.keys(fields).length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No data extracted</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 text-sm font-normal text-muted-foreground"
                  style={{ width: header.column.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              // Check if this row or its parent is in changedFields
              const rootId = row.original.id.split('-')[0]
              const isChanged = changedFields.has(rootId)

              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    'hover:bg-muted/30 transition-colors',
                    row.getCanExpand() && 'cursor-pointer',
                    isChanged && 'bg-primary/10 animate-pulse'
                  )}
                  onClick={() => {
                    if (row.getCanExpand()) {
                      row.toggleExpanded()
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={extractedColumns.length} className="h-24 text-center">
                <p className="text-sm text-muted-foreground">No data extracted</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 3: Test locally**

Run: `cd frontend && npm run dev`
- Navigate to a document detail page
- Verify table renders with Field | Value | Conf. columns
- Click on expandable rows to expand/collapse
- Verify nested data appears indented

**Step 4: Commit**

```bash
git add frontend/components/documents/extracted-data-table.tsx
git commit -m "feat: rewrite extracted data table with TanStack Table and expanding rows"
```

---

### Task 8: Add CSS Animation for Changed Fields

**Files:**
- Modify: `frontend/app/globals.css` (or create animation in component)

**Step 1: Add highlight fade animation**

In `extracted-data-table.tsx`, update the changed row className:

Replace:
```typescript
isChanged && 'bg-primary/10 animate-pulse'
```

With:
```typescript
isChanged && 'animate-highlight-fade'
```

Add to `globals.css`:

```css
@keyframes highlight-fade {
  0% {
    background-color: hsl(var(--primary) / 0.15);
  }
  100% {
    background-color: transparent;
  }
}

.animate-highlight-fade {
  animation: highlight-fade 1.5s ease-out forwards;
  /* Fix #8: Hint browser for GPU acceleration */
  will-change: background-color;
}
```

**Step 2: Test animation**

Run: `cd frontend && npm run dev`
- Use AI chat bar to correct a field
- Verify the changed row highlights and fades over 1.5s

**Step 3: Commit**

```bash
git add frontend/app/globals.css frontend/components/documents/extracted-data-table.tsx
git commit -m "feat: add highlight fade animation for changed extraction fields"
```

---

### Task 9: Integration Test - Full Flow

**Files:** None (testing only)

**Step 1: Start development server**

Run: `cd frontend && npm run dev`

**Step 2: Test realtime updates**

1. Open document detail page
2. Open browser DevTools Network tab, filter by "realtime" or "websocket"
3. Verify WebSocket connection established
4. Use AI chat bar to correct a field (e.g., "Change the name to John Smith")
5. Verify:
   - Table updates without page reload
   - Changed field highlights and fades
   - Confidence scores update if changed

**Step 3: Test table expansion**

1. Click on rows with nested data (showing "X fields" or "X items")
2. Verify:
   - Chevron rotates on expand
   - Nested rows appear indented
   - Clicking again collapses

**Step 4: Test different data shapes**

Upload documents with different extracted structures:
- Simple key-value objects (Applicant info)
- Arrays of strings (Skills list)
- Grouped arrays (Technical Skills by category)
- Arrays of objects (Line items)

Verify each renders appropriately.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete realtime updates and extracted fields table redesign"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create useExtractionRealtime hook | `hooks/use-extraction-realtime.ts` |
| 2 | Create DocumentDetailClient wrapper | `components/documents/document-detail-client.tsx` |
| 3 | Update page to use client wrapper | `app/(app)/documents/[id]/page.tsx` |
| 4 | Add changedFields prop to table | `components/documents/extracted-data-table.tsx` |
| 5 | Create data transformation utilities | `lib/transform-extracted-fields.ts` |
| 6 | Create TanStack column definitions | `components/documents/extracted-columns.tsx` |
| 7 | Rewrite table with TanStack Table | `components/documents/extracted-data-table.tsx` |
| 8 | Add highlight fade animation | `globals.css`, `extracted-data-table.tsx` |
| 9 | Integration test | - |
