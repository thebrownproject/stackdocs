# Phase 4: Export Dropdown

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CSV/JSON export functionality for document extraction data.

**Architecture:** Client component generates file and triggers browser download.

**Tech Stack:** Sonner toast, browser Blob/URL APIs

---

## Task 10: Create Export Dropdown Component

**Files:**
- Create: `frontend/components/documents/export-dropdown.tsx`

**Step 1: Create the export dropdown with CSV/JSON options**

```tsx
'use client'

import { toast } from 'sonner'
import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ExportDropdownProps {
  filename: string
  extractedFields: Record<string, unknown> | null
}

function formatDate(): string {
  return new Date().toISOString().split('T')[0]
}

function flattenFields(fields: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(fields)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenFields(value as Record<string, unknown>, fullKey))
    } else if (Array.isArray(value)) {
      result[fullKey] = value.map(v => String(v)).join('; ')
    } else {
      result[fullKey] = String(value ?? '')
    }
  }

  return result
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ExportDropdown({ filename, extractedFields }: ExportDropdownProps) {
  const baseFilename = filename.replace(/\.[^/.]+$/, '') // Remove extension
  const dateStr = formatDate()

  const handleExportCSV = () => {
    if (!extractedFields) {
      toast.error('No extraction data to export')
      return
    }

    try {
      const flat = flattenFields(extractedFields)
      // Escape both headers and values (headers may contain commas from nested paths)
      const escapeCsvField = (v: string) => `"${v.replace(/"/g, '""')}"`
      const headers = Object.keys(flat).map(escapeCsvField)
      const values = Object.values(flat).map(escapeCsvField)

      const csv = [headers.join(','), values.join(',')].join('\n')
      downloadFile(csv, `${baseFilename}_extraction_${dateStr}.csv`, 'text/csv')
      toast.success('CSV exported')
    } catch (error) {
      console.error('CSV export failed:', error)
      toast.error('Failed to export CSV')
    }
  }

  const handleExportJSON = () => {
    if (!extractedFields) {
      toast.error('No extraction data to export')
      return
    }

    try {
      const json = JSON.stringify(extractedFields, null, 2)
      downloadFile(json, `${baseFilename}_extraction_${dateStr}.json`, 'application/json')
      toast.success('JSON exported')
    } catch (error) {
      console.error('JSON export failed:', error)
      toast.error('Failed to export JSON')
    }
  }

  const hasData = extractedFields !== null

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild disabled={!hasData}>
            <ActionButton icon={<Icons.Download />} disabled={!hasData}>
              Export
            </ActionButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {hasData ? 'Download extraction data' : 'No extraction data available'}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuItem onClick={handleExportCSV}>
          Download as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON}>
          Download as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/components/documents/export-dropdown.tsx
git commit -m "feat: add export dropdown with CSV/JSON download"
```

---

## Task 10: Wire Up Export in Document Detail Actions

**Files:**
- Modify: `frontend/app/(app)/@subbar/documents/[id]/page.tsx`
- Modify: `frontend/components/documents/document-detail-sub-bar.tsx`
- Modify: `frontend/components/documents/document-detail-actions.tsx`

**Step 1: Update server component to fetch extraction data**

Switch from `getDocumentStacks()` to `getDocumentWithExtraction()` + `getAllStacks()` to get all required data.

> **Note:** This task builds on Task 6 (Phase 3) which already added `getAllStacks()`. The props interface
> here is the UNIFIED interface that includes all fields needed for Export (Task 8-9), Delete (Task 10-11),
> and Stack toggle (Task 5-7).

```tsx
// frontend/app/(app)/@subbar/documents/[id]/page.tsx
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { getAllStacks } from '@/lib/queries/stacks'
import { DocumentDetailSubBar } from '@/components/documents/document-detail-sub-bar'

interface DocumentDetailSubBarPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailSubBarPage({ params }: DocumentDetailSubBarPageProps) {
  const { id } = await params

  // Fetch in parallel for faster loading
  const [document, allStacks] = await Promise.all([
    getDocumentWithExtraction(id),
    getAllStacks(),
  ])

  if (!document) {
    return null
  }

  return (
    <DocumentDetailSubBar
      documentId={id}
      filename={document.filename}
      filePath={document.file_path}
      extractedFields={document.extracted_fields}
      assignedStacks={document.stacks}
      allStacks={allStacks}
    />
  )
}
```

**Step 2: Update DocumentDetailSubBar props interface**

This is the UNIFIED interface including all fields needed for Export, Delete, and Stack operations:

```tsx
// frontend/components/documents/document-detail-sub-bar.tsx
import type { StackSummary } from '@/types/stacks'

interface DocumentDetailSubBarProps {
  documentId: string                              // For Delete, Stack toggle
  filename: string                                // For Export, Delete
  filePath: string | null                         // For Delete (storage cleanup)
  extractedFields: Record<string, unknown> | null // For Export
  assignedStacks: StackSummary[]                  // For Stack toggle
  allStacks: StackSummary[]                       // For Stack toggle
}

export function DocumentDetailSubBar({
  documentId,
  filename,
  filePath,
  extractedFields,
  assignedStacks,
  allStacks,
}: DocumentDetailSubBarProps) {
  const { fieldSearch, setFieldSearch, selectedFieldCount } = useDocumentDetailFilter()

  return (
    <SubBar
      left={
        <>
          <FilterButton />
          <ExpandableSearch
            value={fieldSearch}
            onChange={setFieldSearch}
            placeholder="Search fields..."
          />
        </>
      }
      right={
        <>
          <SelectionActions selectedCount={selectedFieldCount} />
          <DocumentDetailActions
            documentId={documentId}
            filename={filename}
            filePath={filePath}
            extractedFields={extractedFields}
            assignedStacks={assignedStacks}
            allStacks={allStacks}
          />
        </>
      }
    />
  )
}
```

**Step 3: Update DocumentDetailActions props and use ExportDropdown**

This is the UNIFIED interface - includes all props for Stack toggle, Export, and Delete:

```tsx
// frontend/components/documents/document-detail-actions.tsx
'use client'

import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { ExportDropdown } from '@/components/documents/export-dropdown'
import { ActionButton } from '@/components/layout/action-button'
import * as Icons from '@/components/icons'
import type { StackSummary } from '@/types/stacks'

interface DocumentDetailActionsProps {
  documentId: string                              // For Delete, Stack toggle
  filename: string                                // For Export, Delete
  filePath: string | null                         // For Delete (storage cleanup)
  extractedFields: Record<string, unknown> | null // For Export
  assignedStacks: StackSummary[]                  // For Stack toggle
  allStacks: StackSummary[]                       // For Stack toggle
}

export function DocumentDetailActions({
  documentId,
  filename,
  filePath,
  extractedFields,
  assignedStacks,
  allStacks,
}: DocumentDetailActionsProps) {
  return (
    <>
      <StacksDropdown
        documentId={documentId}
        assignedStacks={assignedStacks}
        allStacks={allStacks}
      />
      <ActionButton icon={<Icons.Edit />} tooltip="Edit document and extractions">
        Edit
      </ActionButton>
      <ExportDropdown filename={filename} extractedFields={extractedFields} />
      {/* DeleteDialog will be added in Task 11 */}
    </>
  )
}
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/app/(app)/@subbar/documents/[id]/page.tsx frontend/components/documents/document-detail-sub-bar.tsx frontend/components/documents/document-detail-actions.tsx
git commit -m "feat: wire up export dropdown in document detail"
```
