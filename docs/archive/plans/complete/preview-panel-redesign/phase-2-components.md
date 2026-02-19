# Preview Panel Redesign - Phase 2: Components

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the document preview panel with Apple Finder-inspired aesthetics, hover-reveal controls, metadata display, expand modal, and localStorage persistence.

**Architecture:** Refactor existing `preview-panel.tsx` into modular components under `preview-panel/` folder. Build leaf components first (metadata, page-nav, controls), then container components, then integrate. TDD approach with frequent commits.

**Tech Stack:** React, TypeScript, shadcn/ui (Tabs, Dialog, Button), Tailwind CSS, react-pdf, localStorage

---

## Phase 3: Leaf Components (Tasks 5-8)

> **Note on 'use client':** Components using React hooks or browser APIs need `'use client'` at the top. Pure presentational components like `PreviewMetadata` and `TextContent` don't need it - they receive data as props and just render JSX. Components in Phase 4+ use hooks and need the directive.

### Task 5: Create preview-metadata.tsx

**Files:**
- Create: `frontend/components/documents/preview-panel/preview-metadata.tsx`
- Modify: `frontend/components/documents/preview-panel/index.tsx`

**Step 1: Create the component**

```typescript
interface PreviewMetadataProps {
  filename: string
  mimeType: string
  fileSize: number | null
  pageCount: number | null
  fieldCount: number | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.startsWith('image/')) return 'Image'
  return 'Document'
}

export function PreviewMetadata({
  filename,
  mimeType,
  fileSize,
  pageCount,
  fieldCount,
}: PreviewMetadataProps) {
  const fileTypeLabel = getFileTypeLabel(mimeType)

  const details: string[] = [fileTypeLabel]
  if (fileSize !== null) details.push(formatFileSize(fileSize))
  if (pageCount !== null && pageCount > 1) details.push(`${pageCount} pages`)
  if (fieldCount !== null) {
    details.push(`${fieldCount} fields`)
  } else {
    details.push('Not extracted')
  }

  return (
    <div className="px-4 py-3 shrink-0">
      <p className="font-medium text-foreground truncate" title={filename}>
        {filename}
      </p>
      <p className="text-sm text-muted-foreground">
        {details.join(' · ')}
      </p>
    </div>
  )
}
```

**Step 2: Export from barrel**

Update `frontend/components/documents/preview-panel/index.tsx`:
```typescript
export { PreviewMetadata } from './preview-metadata'
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
feat: add PreviewMetadata component

Displays filename and dot-separated details (type, size, pages, fields)
EOF
)"
```

---

### Task 6: Create page-navigation.tsx

**Files:**
- Create: `frontend/components/documents/preview-panel/page-navigation.tsx`
- Modify: `frontend/components/documents/preview-panel/index.tsx`

**Step 1: Create the component**

```typescript
import { Button } from '@/components/ui/button'
import * as Icons from '@/components/icons'
import { cn } from '@/lib/utils'

interface PageNavigationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  variant?: 'overlay' | 'default'
  className?: string
}

export function PageNavigation({
  currentPage,
  totalPages,
  onPageChange,
  variant = 'default',
  className,
}: PageNavigationProps) {
  const isOverlay = variant === 'overlay'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Button
        variant={isOverlay ? 'ghost' : 'outline'}
        size="icon"
        className={cn(
          'size-8',
          isOverlay && 'text-white hover:bg-white/20 hover:text-white'
        )}
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        <Icons.ChevronLeft className="size-4" />
      </Button>

      <span
        className={cn(
          'text-sm tabular-nums min-w-[4rem] text-center',
          isOverlay ? 'text-white' : 'text-muted-foreground'
        )}
      >
        {currentPage} / {totalPages}
      </span>

      <Button
        variant={isOverlay ? 'ghost' : 'outline'}
        size="icon"
        className={cn(
          'size-8',
          isOverlay && 'text-white hover:bg-white/20 hover:text-white'
        )}
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        <Icons.ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
```

**Step 2: Export from barrel**

Add to `frontend/components/documents/preview-panel/index.tsx`:
```typescript
export { PageNavigation } from './page-navigation'
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
feat: add PageNavigation component

Reusable prev/next for PDF pages with overlay and default variants
EOF
)"
```

---

### Task 7: Create preview-controls.tsx

**Files:**
- Create: `frontend/components/documents/preview-panel/preview-controls.tsx`
- Modify: `frontend/components/documents/preview-panel/index.tsx`

**Step 1: Create the component**

```typescript
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import * as Icons from '@/components/icons'

interface PreviewControlsProps {
  isPdfAvailable: boolean
  onExpand: () => void
  onDownload: () => void
  canDownload: boolean  // Hide download button when no PDF URL available
}

export function PreviewControls({
  isPdfAvailable,
  onExpand,
  onDownload,
  canDownload,
}: PreviewControlsProps) {
  // Note: activeTab and onTabChange props removed - parent Tabs component
  // handles tab changes via onValueChange. TabsTrigger only needs value.
  return (
    <div className="flex items-center justify-between w-full">
      <TabsList className="h-7 p-0.5 bg-black/30">
        <TabsTrigger
          value="pdf"
          disabled={!isPdfAvailable}
          className="h-6 px-2.5 text-xs text-white/90 data-[state=active]:bg-white/20 data-[state=active]:text-white data-[disabled]:text-white/40"
        >
          PDF
        </TabsTrigger>
        <TabsTrigger
          value="text"
          className="h-6 px-2.5 text-xs text-white/90 data-[state=active]:bg-white/20 data-[state=active]:text-white"
        >
          Text
        </TabsTrigger>
      </TabsList>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-white hover:bg-white/20 hover:text-white"
          onClick={onExpand}
          aria-label="Expand preview"
        >
          <Icons.ArrowsMaximize className="size-4" />
        </Button>
        {canDownload && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white hover:bg-white/20 hover:text-white"
            onClick={onDownload}
            aria-label="Download document"
          >
            <Icons.Download className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Export from barrel**

Add to `frontend/components/documents/preview-panel/index.tsx`:
```typescript
export { PreviewControls } from './preview-controls'
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
feat: add PreviewControls component

Top bar with PDF/Text tabs and expand/download action buttons
EOF
)"
```

---

### Task 8: Create text-content.tsx

**Files:**
- Create: `frontend/components/documents/preview-panel/text-content.tsx`
- Modify: `frontend/components/documents/preview-panel/index.tsx`

**Step 1: Create the component**

```typescript
import Markdown, { Components } from 'react-markdown'

// Sanitize links to only allow safe protocols (prevent javascript: XSS)
const markdownComponents: Components = {
  a: ({ href, children }) => {
    const safeHref = href || ''
    if (!/^(https?:|mailto:)/i.test(safeHref)) {
      return <span className="text-muted-foreground">{children}</span>
    }
    return (
      <a href={safeHref} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
}

interface TextContentProps {
  text: string | null
}

export function TextContent({ text }: TextContentProps) {
  if (!text) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No OCR text available</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="prose prose-sm dark:prose-invert max-w-none
        prose-headings:font-medium prose-headings:text-foreground
        prose-p:text-foreground prose-p:leading-relaxed
        prose-strong:text-foreground
        prose-ul:text-foreground prose-ol:text-foreground
        prose-li:text-foreground
        prose-table:text-sm
        prose-th:bg-muted prose-th:px-3 prose-th:py-2
        prose-td:px-3 prose-td:py-2 prose-td:border-border">
        <Markdown components={markdownComponents}>{text}</Markdown>
      </div>
    </div>
  )
}
```

**Step 2: Export from barrel**

Add to `frontend/components/documents/preview-panel/index.tsx`:
```typescript
export { TextContent } from './text-content'
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
feat: add TextContent component

Markdown rendering for OCR text with sanitized links
EOF
)"
```

---

## Phase 4: Container Components (Tasks 9-11)

### Task 9: Create pdf-content.tsx

**Files:**
- Create: `frontend/components/documents/preview-panel/pdf-content.tsx`
- Modify: `frontend/components/documents/preview-panel/index.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import * as Icons from '@/components/icons'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfContentProps {
  url: string
  currentPage: number
  onLoadSuccess: (info: { numPages: number }) => void
  onLoadError?: (error: Error) => void
}

const BASE_WIDTH = 600

export function PdfContent({
  url,
  currentPage,
  onLoadSuccess,
  onLoadError,
}: PdfContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Scale PDF to fit container width
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries
      if (!entry) return

      const containerWidth = entry.contentRect.width - 32
      const newScale = Math.min(containerWidth / BASE_WIDTH, 1)
      setScale(newScale)
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  function handleLoadSuccess({ numPages }: { numPages: number }) {
    onLoadSuccess({ numPages })
  }

  function handleLoadError(error: Error) {
    setError(error.message)
    onLoadError?.(error)
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-destructive p-4 text-center">
        <div>
          <p className="font-medium">Failed to load PDF</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full overflow-auto flex justify-center px-4">
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          width: `${BASE_WIDTH}px`,
        }}
      >
        <Document
          file={url}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          loading={
            <div className="flex h-[600px] items-center justify-center">
              <Icons.Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            width={BASE_WIDTH}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  )
}
```

**Step 2: Export from barrel**

Add to `frontend/components/documents/preview-panel/index.tsx`:
```typescript
export { PdfContent } from './pdf-content'
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
feat: add PdfContent component

PDF rendering with page state controlled by parent, ResizeObserver scaling
EOF
)"
```

---

### Task 10: Create preview-container.tsx

**Files:**
- Create: `frontend/components/documents/preview-panel/preview-container.tsx`
- Modify: `frontend/components/documents/preview-panel/index.tsx`

**Step 1: Create the component**

```typescript
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useCallback } from 'react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { PreviewControls } from './preview-controls'
import { PageNavigation } from './page-navigation'
import { TextContent } from './text-content'
import { cn } from '@/lib/utils'
import * as Icons from '@/components/icons'

// Dynamic import to avoid SSR issues with react-pdf
const PdfContent = dynamic(
  () => import('./pdf-content').then((mod) => ({ default: mod.PdfContent })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Icons.Loader2 className="size-6 animate-spin text-muted-foreground/50" />
      </div>
    ),
  }
)

interface PreviewContainerProps {
  // Tab state
  activeTab: 'pdf' | 'text'
  onTabChange: (tab: 'pdf' | 'text') => void
  isPdfAvailable: boolean
  // PDF state
  pdfUrl: string | null
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onPdfLoad: (info: { numPages: number }) => void
  // Text content
  ocrText: string | null
  // Actions
  onExpand: () => void
  onDownload: () => void
  canDownload: boolean
}

export function PreviewContainer({
  activeTab,
  onTabChange,
  isPdfAvailable,
  pdfUrl,
  currentPage,
  totalPages,
  onPageChange,
  onPdfLoad,
  ocrText,
  onExpand,
  onDownload,
  canDownload,
}: PreviewContainerProps) {
  // Keyboard navigation for pages
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't navigate pages when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (activeTab !== 'pdf' || totalPages <= 1) return
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        onPageChange(currentPage - 1)
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        onPageChange(currentPage + 1)
      }
    },
    [activeTab, currentPage, totalPages, onPageChange]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Determine effective tab when PDF not available
  const effectiveTab = activeTab === 'pdf' && !isPdfAvailable ? 'text' : activeTab
  const showPageNav = effectiveTab === 'pdf' && totalPages > 1

  return (
    <Tabs value={effectiveTab} onValueChange={(v) => onTabChange(v as 'pdf' | 'text')} className="flex-1 min-h-0">
      <div className="group relative h-full rounded-lg overflow-hidden bg-muted">
        {/* Top controls - fade in on hover */}
        <div
          className={cn(
            'absolute inset-x-0 top-0 z-10',
            'flex items-center p-3',
            'bg-gradient-to-b from-black/60 via-black/30 to-transparent',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
          )}
        >
          <PreviewControls
            isPdfAvailable={isPdfAvailable}
            onExpand={onExpand}
            onDownload={onDownload}
            canDownload={canDownload}
          />
        </div>

        {/* Content area */}
        <TabsContent value="pdf" className="h-full m-0 data-[state=inactive]:hidden">
          {isPdfAvailable && pdfUrl ? (
            <PdfContent
              key={pdfUrl}
              url={pdfUrl}
              currentPage={currentPage}
              onLoadSuccess={onPdfLoad}
            />
          ) : isPdfAvailable && !pdfUrl ? (
            <div className="flex h-full items-center justify-center">
              <Icons.Loader2 className="size-6 animate-spin text-muted-foreground/50" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">PDF preview not available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="text" className="h-full m-0 data-[state=inactive]:hidden">
          <TextContent text={ocrText} />
        </TabsContent>

        {/* Bottom controls - PDF only, fade in on hover */}
        {showPageNav && (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 z-10',
              'flex items-center justify-center py-3',
              'bg-gradient-to-t from-black/60 via-black/30 to-transparent',
              'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
            )}
          >
            <PageNavigation
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              variant="overlay"
            />
          </div>
        )}
      </div>
    </Tabs>
  )
}
```

**Step 2: Export from barrel**

Add to `frontend/components/documents/preview-panel/index.tsx`:
```typescript
export { PreviewContainer } from './preview-container'
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
feat: add PreviewContainer component

Rounded container with hover-reveal controls and gradient overlays
EOF
)"
```

---

### Task 11: Create expand-modal.tsx

**Files:**
- Create: `frontend/components/documents/preview-panel/expand-modal.tsx`
- Modify: `frontend/components/documents/preview-panel/index.tsx`

**Step 1: Create the component**

```typescript
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Button } from '@/components/ui/button'
import { PageNavigation } from './page-navigation'
import { TextContent } from './text-content'
import * as Icons from '@/components/icons'

// Dynamic import to avoid SSR issues with react-pdf
const PdfContent = dynamic(
  () => import('./pdf-content').then((mod) => ({ default: mod.PdfContent })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Icons.Loader2 className="size-6 animate-spin text-muted-foreground/50" />
      </div>
    ),
  }
)

interface ExpandModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pdfUrl: string | null
  activeTab: 'pdf' | 'text'
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onPdfLoad: (info: { numPages: number }) => void
  ocrText: string | null
  filename: string
  onDownload: () => void
}

export function ExpandModal({
  open,
  onOpenChange,
  pdfUrl,
  activeTab,
  currentPage,
  totalPages,
  onPageChange,
  onPdfLoad,
  ocrText,
  filename,
  onDownload,
}: ExpandModalProps) {
  // Keyboard navigation for pages
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't navigate pages when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!open || activeTab !== 'pdf' || totalPages <= 1) return
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        onPageChange(currentPage - 1)
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        onPageChange(currentPage + 1)
      }
    },
    [open, activeTab, currentPage, totalPages, onPageChange]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const isPdf = activeTab === 'pdf'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col gap-0 p-0">
        {/* Visually hidden but accessible title - using Radix VisuallyHidden
            for better cross-browser support vs Tailwind sr-only */}
        <VisuallyHidden asChild>
          <DialogTitle>Document Preview</DialogTitle>
        </VisuallyHidden>

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-t-lg bg-muted m-4 mb-0">
          {isPdf && pdfUrl ? (
            <PdfContent
              url={pdfUrl}
              currentPage={currentPage}
              onLoadSuccess={onPdfLoad}
            />
          ) : (
            <TextContent text={ocrText} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm font-medium truncate max-w-[200px]" title={filename}>
            {filename}
          </span>

          {isPdf && totalPages > 1 && (
            <PageNavigation
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              variant="default"
            />
          )}

          <Button variant="outline" size="sm" onClick={onDownload}>
            <Icons.Download className="size-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Export from barrel**

Add to `frontend/components/documents/preview-panel/index.tsx`:
```typescript
export { ExpandModal } from './expand-modal'
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
feat: add ExpandModal component

Full-size document viewing with keyboard navigation and download
EOF
)"
```

---

## Phase 5: Main Component (Task 12)

### Task 12: Create New preview-panel.tsx

**Files:**
- Create: `frontend/components/documents/preview-panel/preview-panel.tsx`
- Modify: `frontend/components/documents/preview-panel/index.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { PreviewContainer } from './preview-container'
import { PreviewMetadata } from './preview-metadata'
import { ExpandModal } from './expand-modal'
import { usePreviewPanel } from '../preview-panel-context'

interface PreviewPanelProps {
  pdfUrl: string | null
  ocrText: string | null
  mimeType: string
  filename: string | null
  fileSize: number | null
  pageCount: number | null
  extractedFields: Record<string, unknown> | null
  onDownload?: () => void
}

export function PreviewPanel({
  pdfUrl,
  ocrText,
  mimeType,
  filename,
  fileSize,
  pageCount,
  extractedFields,
  onDownload,
}: PreviewPanelProps) {
  const { activeTab, setActiveTab } = usePreviewPanel()

  // Local state for PDF page and modal
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(pageCount ?? 0)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const isPdf = mimeType === 'application/pdf'

  // Reset page to 1 when document changes
  useEffect(() => {
    setCurrentPage(1)
  }, [pdfUrl])

  // Calculate field count for metadata
  const fieldCount = extractedFields ? Object.keys(extractedFields).length : null

  const handlePdfLoad = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const handleExpand = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload()
    } else if (pdfUrl) {
      // Fallback: open PDF URL in new tab
      window.open(pdfUrl, '_blank')
    }
  }, [onDownload, pdfUrl])

  // Only show download when we have a PDF URL (text download not implemented)
  const canDownload = !!pdfUrl

  // Empty state
  if (!filename) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a document to preview</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 gap-0">
      <PreviewContainer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPdfAvailable={isPdf}
        pdfUrl={pdfUrl}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onPdfLoad={handlePdfLoad}
        ocrText={ocrText}
        onExpand={handleExpand}
        onDownload={handleDownload}
        canDownload={canDownload}
      />

      <PreviewMetadata
        filename={filename}
        mimeType={mimeType}
        fileSize={fileSize}
        pageCount={totalPages > 0 ? totalPages : pageCount}
        fieldCount={fieldCount}
      />

      <ExpandModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        pdfUrl={pdfUrl}
        activeTab={activeTab}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onPdfLoad={handlePdfLoad}
        ocrText={ocrText}
        filename={filename}
        onDownload={handleDownload}
      />
    </div>
  )
}
```

**Step 2: Update barrel export**

Update `frontend/components/documents/preview-panel/index.tsx` to be the complete barrel:
```typescript
// Main component
export { PreviewPanel } from './preview-panel'

// Sub-components (exported for testing/reuse)
export { PreviewContainer } from './preview-container'
export { PreviewMetadata } from './preview-metadata'
export { PreviewControls } from './preview-controls'
export { PageNavigation } from './page-navigation'
export { TextContent } from './text-content'
export { PdfContent } from './pdf-content'
export { ExpandModal } from './expand-modal'
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
feat: add new PreviewPanel orchestrator component

Composes all preview components with state management and empty state
EOF
)"
```

---

## Review Checkpoints

| After Phase | Verify |
|-------------|--------|
| Phase 4 | All components build, no runtime errors |
