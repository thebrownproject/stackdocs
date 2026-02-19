# Documents Page: Phase 3 - Document Detail

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the document detail page with PDF viewer, extraction table, and AI chat bar.

**Prereq:** `02-documents-list.md` | **This plan:** Tasks 12-20 | **Next:** `04-integration.md`

**Architecture:** Server components fetch data from Supabase, pass to client table/detail components. Page header uses React Context for breadcrumbs and a portal pattern for actions. PDF viewing uses react-pdf with client-side rendering. AI chat uses SSE streaming to the existing extraction agent.

**Tech Stack:** Next.js 16, TanStack Table, shadcn/ui (table, dialog, badge, tabs, dropdown-menu, popover, checkbox, card), react-pdf, Supabase

---

## Design System: Linear-Inspired Precision

**Aesthetic Direction:** Extreme restraint. Let content speak. Every element earns its place.

**Typography:**
- Headers: `font-medium` only - never bold, never uppercase
- Table headers: `text-muted-foreground text-sm` - lowercase, understated
- IDs/codes: `font-mono text-muted-foreground text-sm` - like Linear's `BUI-1`
- Body: Default weight, generous line height

**Color Palette:**
- Base: Near-monochrome - `text-foreground` and `text-muted-foreground`
- Status icons only: Small colored dots/icons, never colored text blocks
- Backgrounds: `bg-transparent` or very subtle `hover:bg-muted/50`
- Borders: `border-border` - visible but not heavy
- **Dark mode safe colors:** Use CSS variables or explicit dark: variants for status indicators

**Spacing:**
- Rows: `py-3` minimum - content needs room to breathe
- Sections: `space-y-6` between major blocks
- Inline: `gap-3` for property pills

**Borders & Containers:**
- Tables: Single outer border, no internal row borders (use hover bg instead)
- Empty states: `border-dashed` with muted placeholder text and subtle icon
- Cards: `rounded-lg border` - subtle, not boxy

**Motion:**
- Transitions: `duration-150` - instant feel
- Hover: `bg-muted/50` - barely there
- No transforms, no scaling, no bounce

**Interactions:**
- Rows: Full clickable area, subtle bg on hover, `data-state="selected"` for selection styling
- Buttons: Ghost by default, outline for secondary, filled only for primary CTA
- Property pills: Inline badges with icons, clickable for dropdowns

---

## Phase 3: Document Detail Page

### Task 12: Install react-pdf

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install react-pdf**

Run:
```bash
cd frontend && npm install react-pdf
```

**Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add react-pdf dependency"
```

---

### Task 13: Create PDF Viewer Component

**Files:**
- Create: `frontend/components/pdf-viewer.tsx`

**Step 1: Create the PDF viewer client component**

Create `frontend/components/pdf-viewer.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker - use CDN for Next.js compatibility
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfViewerProps {
  url: string
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setLoading(false)
  }

  function onDocumentLoadError(error: Error) {
    setError(error.message)
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center">
      {error ? (
        <div className="flex h-[600px] items-center justify-center text-destructive p-4 text-center">
          <div>
            <p className="font-medium">Failed to load PDF</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex h-[600px] items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            }
            className="max-h-[600px] overflow-auto"
          >
            <Page
              pageNumber={pageNumber}
              width={500}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>

          {!loading && numPages > 1 && (
            <div className="mt-4 flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {pageNumber} of {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/pdf-viewer.tsx
git commit -m "feat: add PdfViewer component with react-pdf"
```

---

### Task 14: Create Visual Preview Component

**Files:**
- Create: `frontend/components/visual-preview.tsx`

**Step 1: Create the visual preview component**

Create `frontend/components/visual-preview.tsx`:

```tsx
import { FileText } from 'lucide-react'

interface VisualPreviewProps {
  markdown: string | null
}

export function VisualPreview({ markdown }: VisualPreviewProps) {
  if (!markdown) {
    return (
      <div className="flex h-[600px] flex-col items-center justify-center text-muted-foreground">
        <FileText className="size-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm font-medium">No OCR text available</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Run extraction to generate text
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-[600px] overflow-auto p-4">
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
        {markdown}
      </pre>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/visual-preview.tsx
git commit -m "feat: add VisualPreview component for OCR text"
```

---

### Task 15: Create Preview Panel Component

**Files:**
- Create: `frontend/components/documents/preview-panel.tsx`

**Step 1: Create the preview panel with tabs**

Create `frontend/components/documents/preview-panel.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { VisualPreview } from '@/components/visual-preview'
import { Loader2 } from 'lucide-react'

// Dynamic import to avoid SSR issues with react-pdf
const PdfViewer = dynamic(
  () => import('@/components/pdf-viewer').then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

interface PreviewPanelProps {
  pdfUrl: string | null
  ocrText: string | null
  mimeType: string
}

export function PreviewPanel({ pdfUrl, ocrText, mimeType }: PreviewPanelProps) {
  const isPdf = mimeType === 'application/pdf'

  return (
    <Tabs defaultValue={isPdf ? 'pdf' : 'visual'} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="pdf" disabled={!isPdf}>
          PDF
        </TabsTrigger>
        <TabsTrigger value="visual">Visual</TabsTrigger>
      </TabsList>
      <TabsContent value="pdf">
        <Card>
          <CardContent className="p-0">
            {isPdf && pdfUrl ? (
              <PdfViewer url={pdfUrl} />
            ) : (
              <div className="flex h-[600px] items-center justify-center text-muted-foreground">
                PDF preview not available for this file type
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="visual">
        <Card>
          <CardContent className="p-0">
            <VisualPreview markdown={ocrText} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/preview-panel.tsx
git commit -m "feat: add PreviewPanel with PDF and Visual tabs"
```

---

### Task 16: Create Extracted Data Table Component

**Files:**
- Create: `frontend/components/documents/extracted-data-table.tsx`

**Step 1: Create the extracted data display component with expandable nested data**

Create `frontend/components/documents/extracted-data-table.tsx`:

```tsx
'use client'

import * as React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FileText, ChevronRight } from 'lucide-react'

interface ExtractedDataTableProps {
  fields: Record<string, unknown> | null
  confidenceScores: Record<string, number> | null
}

function NestedDataDialog({ label, data }: { label: string; data: unknown }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-1 gap-1">
          <Badge variant="secondary" className="font-mono text-xs">
            {Array.isArray(data) ? `${data.length} items` : 'Object'}
          </Badge>
          <ChevronRight className="size-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">{label.replace(/_/g, ' ')}</DialogTitle>
          <DialogDescription>Nested data structure</DialogDescription>
        </DialogHeader>
        <pre className="mt-4 rounded-lg bg-muted p-4 text-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </DialogContent>
    </Dialog>
  )
}

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return <NestedDataDialog label={key} data={value} />
  }

  // Format currency values
  if (typeof value === 'string' && /^\$?[\d,]+\.?\d*$/.test(value)) {
    return <span className="font-mono tabular-nums">{value}</span>
  }

  return <span className="text-foreground">{String(value)}</span>
}

function ConfidenceIndicator({ score }: { score: number }) {
  const percentage = Math.round(score * 100)

  // Use CSS variables for dark mode compatibility
  const dotColor =
    score >= 0.9
      ? 'bg-green-500 dark:bg-green-400'
      : score >= 0.7
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-red-500 dark:bg-red-400'

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <span className={cn('size-1.5 rounded-full', dotColor)} />
      <span className="text-xs tabular-nums text-muted-foreground">{percentage}%</span>
    </div>
  )
}

export function ExtractedDataTable({
  fields,
  confidenceScores,
}: ExtractedDataTableProps) {
  if (!fields || Object.keys(fields).length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
        <FileText className="size-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm font-medium">No extracted data</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Run extraction to populate fields
        </p>
      </div>
    )
  }

  const entries = Object.entries(fields)

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 text-sm font-normal text-muted-foreground w-1/3">
              Field
            </TableHead>
            <TableHead className="h-10 text-sm font-normal text-muted-foreground">
              Value
            </TableHead>
            <TableHead className="h-10 text-sm font-normal text-muted-foreground w-28 text-right">
              Confidence
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => {
            const confidence = confidenceScores?.[key]
            return (
              <TableRow
                key={key}
                className="border-0 hover:bg-muted/50 transition-colors duration-150"
              >
                <TableCell className="py-3">
                  <span className="text-sm text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="py-3">{renderValue(key, value)}</TableCell>
                <TableCell className="py-3">
                  {confidence !== undefined ? (
                    <ConfidenceIndicator score={confidence} />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/extracted-data-table.tsx
git commit -m "feat: add ExtractedDataTable with expandable nested data"
```

---

### Task 17: Create Stacks Dropdown Component

**Files:**
- Create: `frontend/components/documents/stacks-dropdown.tsx`

**Step 1: Create the stacks dropdown component**

Create `frontend/components/documents/stacks-dropdown.tsx`:

```tsx
'use client'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Stack } from '@/types/documents'
import { ChevronDown } from 'lucide-react'

interface StacksDropdownProps {
  assignedStacks: Stack[]
  allStacks?: Stack[]
  onToggleStack?: (stackId: string, assigned: boolean) => void
}

export function StacksDropdown({
  assignedStacks,
  allStacks = [],
  onToggleStack,
}: StacksDropdownProps) {
  const assignedIds = new Set(assignedStacks.map((s) => s.id))

  if (assignedStacks.length === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground cursor-not-allowed">
        No stacks
      </Badge>
    )
  }

  const displayText =
    assignedStacks.length === 1
      ? assignedStacks[0].name
      : `${assignedStacks[0].name} +${assignedStacks.length - 1}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 transition-colors gap-1"
        >
          {displayText}
          <ChevronDown className="size-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Assign to Stacks</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allStacks.length > 0 ? (
          allStacks.map((stack) => (
            <DropdownMenuCheckboxItem
              key={stack.id}
              checked={assignedIds.has(stack.id)}
              onCheckedChange={(checked) => onToggleStack?.(stack.id, checked)}
            >
              {stack.name}
            </DropdownMenuCheckboxItem>
          ))
        ) : (
          assignedStacks.map((stack) => (
            <DropdownMenuCheckboxItem key={stack.id} checked={true} disabled>
              {stack.name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/stacks-dropdown.tsx
git commit -m "feat: add StacksDropdown component"
```

---

### Task 18: Create Document Detail Page Client Component

**Files:**
- Create: `frontend/components/documents/document-detail.tsx`

**Step 1: Create the document detail client component**

Create `frontend/components/documents/document-detail.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useBreadcrumbs } from '@/contexts/page-header-context'
import { PageHeader } from '@/components/page-header'
import { ExtractedDataTable } from './extracted-data-table'
import { PreviewPanel } from './preview-panel'
import { StacksDropdown } from './stacks-dropdown'
import { AiChatBar } from './ai-chat-bar'
import { Button } from '@/components/ui/button'
import { Edit, Download } from 'lucide-react'
import type { DocumentWithExtraction } from '@/types/documents'

interface DocumentDetailProps {
  document: DocumentWithExtraction
  signedUrl: string | null
}

export function DocumentDetail({ document, signedUrl }: DocumentDetailProps) {
  const { setBreadcrumbs } = useBreadcrumbs()

  useEffect(() => {
    setBreadcrumbs([
      { id: 'documents', label: 'Documents', href: '/documents' },
      { id: 'document', label: document.filename },
    ])
  }, [setBreadcrumbs, document.filename])

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <StacksDropdown assignedStacks={document.stacks} />
            <Button variant="outline" size="sm" disabled>
              <Edit className="mr-2 size-4" />
              Edit
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-2 size-4" />
              Export
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Extracted Data */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Extracted Data</h2>
          <ExtractedDataTable
            fields={document.extracted_fields}
            confidenceScores={document.confidence_scores}
          />
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Preview</h2>
          <PreviewPanel
            pdfUrl={signedUrl}
            ocrText={document.ocr_raw_text}
            mimeType={document.mime_type}
          />
        </div>
      </div>

      {/* AI Chat Bar */}
      <AiChatBar documentId={document.id} sessionId={document.session_id} />

      {/* Spacer for fixed chat bar */}
      <div className="h-24" />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/document-detail.tsx
git commit -m "feat: add DocumentDetail client component"
```

---

### Task 19: Create AI Chat Bar Component (Stub)

**Files:**
- Create: `frontend/components/documents/ai-chat-bar.tsx`

**Step 1: Create the AI chat bar stub**

Create `frontend/components/documents/ai-chat-bar.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, ArrowUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AiChatBarProps {
  documentId: string
  sessionId: string | null
  onSubmit?: (message: string) => void
}

export function AiChatBar({ documentId, sessionId, onSubmit }: AiChatBarProps) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [message])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isSubmitting) return

    setIsSubmitting(true)
    // TODO: Implement actual agent call
    console.log('Submit to agent:', { documentId, sessionId, message })
    onSubmit?.(message)
    setMessage('')
    setIsSubmitting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 pb-4 pt-6 bg-gradient-to-t from-background via-background to-transparent pointer-events-none z-50">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-2xl px-4 pointer-events-auto"
      >
        <div
          className={cn(
            'flex items-end gap-2 rounded-xl border bg-background/95 backdrop-blur-sm p-3 shadow-lg transition-all duration-200',
            isFocused && 'ring-2 ring-primary/20 border-primary/50'
          )}
        >
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 shrink-0">
            <Sparkles className="size-4 text-primary" />
          </div>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent to edit, analyze, or transform data..."
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none min-h-[24px] max-h-[120px] py-1"
            rows={1}
            disabled={isSubmitting}
          />

          <Button
            type="submit"
            size="icon"
            className={cn(
              'size-8 shrink-0 rounded-lg transition-all duration-200',
              message.trim()
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground'
            )}
            disabled={!message.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/ai-chat-bar.tsx
git commit -m "feat: add AI chat bar component stub"
```

---

### Task 20: Create Document Detail Page and Loading State

**Files:**
- Create: `frontend/app/(app)/documents/[id]/page.tsx`
- Create: `frontend/app/(app)/documents/[id]/loading.tsx`

**Step 1: Create the document detail server page**

Create `frontend/app/(app)/documents/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { DocumentDetail } from '@/components/documents/document-detail'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.file_path, 3600) // 1 hour expiry

    signedUrl = data?.signedUrl || null
  }

  return <DocumentDetail document={document} signedUrl={signedUrl} />
}
```

**Step 2: Create the loading skeleton**

Create `frontend/app/(app)/documents/[id]/loading.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function DocumentDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-64" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Extracted Data skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="rounded-lg border p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Preview skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[600px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Verify the page works**

Run:
```bash
cd frontend && npm run dev
```

Navigate to http://localhost:3000/documents/[some-id] - should show 404 or document detail if ID exists.

**Step 4: Commit**

```bash
git add frontend/app/\(app\)/documents/\[id\]
git commit -m "feat: implement document detail page with loading state"
```

---

