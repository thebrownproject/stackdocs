# Unified Preview State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify preview panel state (width, tab, collapsed) and selected document across pages for seamless navigation.

**Architecture:** Extend existing `PreviewPanelProvider` with width and tab preferences. Create new `SelectedDocumentProvider` for document selection and cached signed URL. Loading skeletons consume context to prevent layout shift.

**Tech Stack:** React Context, localStorage, react-resizable-panels

**Design Doc:** `docs/plans/in-progress/layout-alignment/2025-12-27-unified-preview-state-design.md`

---

## Task 1: Extend PreviewPanelProvider

**Files:**
- Modify: `frontend/components/documents/preview-panel-context.tsx`

**Step 1: Update the context interface and storage key**

Replace the entire file:

```tsx
'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect, ReactNode } from 'react'
import type { ImperativePanelHandle } from 'react-resizable-panels'

const STORAGE_KEY = 'stackdocs-preview-panel'

interface PreviewPanelState {
  collapsed: boolean
  width: number
  tab: 'pdf' | 'visual'
}

const DEFAULT_STATE: PreviewPanelState = {
  collapsed: false,
  width: 40,
  tab: 'pdf',
}

interface PreviewPanelContextValue {
  panelRef: React.RefObject<ImperativePanelHandle | null>
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  toggle: () => void
  panelWidth: number
  setPanelWidth: (width: number) => void
  activeTab: 'pdf' | 'visual'
  setActiveTab: (tab: 'pdf' | 'visual') => void
}

const PreviewPanelContext = createContext<PreviewPanelContextValue | null>(null)

export function PreviewPanelProvider({ children }: { children: ReactNode }) {
  const panelRef = useRef<ImperativePanelHandle | null>(null)

  // Initialize with defaults for SSR, sync with localStorage after mount
  const [isCollapsed, setIsCollapsedState] = useState(DEFAULT_STATE.collapsed)
  const [panelWidth, setPanelWidthState] = useState(DEFAULT_STATE.width)
  const [activeTab, setActiveTabState] = useState<'pdf' | 'visual'>(DEFAULT_STATE.tab)

  // Sync with localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const state = JSON.parse(saved) as Partial<PreviewPanelState>
        if (typeof state.collapsed === 'boolean') setIsCollapsedState(state.collapsed)
        if (typeof state.width === 'number') setPanelWidthState(state.width)
        if (state.tab === 'pdf' || state.tab === 'visual') setActiveTabState(state.tab)
      } catch {
        // Invalid JSON, use defaults
      }
    }
    // Clean up old localStorage keys
    localStorage.removeItem('stackdocs-preview-collapsed')
    localStorage.removeItem('stackdocs-document-layout')
    localStorage.removeItem('stackdocs-doc-list-layout')
  }, [])

  const persistState = useCallback((updates: Partial<PreviewPanelState>) => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const current = saved ? JSON.parse(saved) : DEFAULT_STATE
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...updates }))
    } catch {
      // Reset to defaults if localStorage is corrupted
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_STATE, ...updates }))
    }
  }, [])

  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed)
    persistState({ collapsed })
  }, [persistState])

  const setPanelWidth = useCallback((width: number) => {
    setPanelWidthState(width)
    persistState({ width })
  }, [persistState])

  const setActiveTab = useCallback((tab: 'pdf' | 'visual') => {
    setActiveTabState(tab)
    persistState({ tab })
  }, [persistState])

  const toggle = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return

    if (panel.isCollapsed()) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }, [])

  return (
    <PreviewPanelContext.Provider value={{
      panelRef,
      isCollapsed,
      setIsCollapsed,
      toggle,
      panelWidth,
      setPanelWidth,
      activeTab,
      setActiveTab,
    }}>
      {children}
    </PreviewPanelContext.Provider>
  )
}

export function usePreviewPanel() {
  const context = useContext(PreviewPanelContext)
  if (!context) {
    throw new Error('usePreviewPanel must be used within PreviewPanelProvider')
  }
  return context
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors related to preview-panel-context

**Step 3: Commit**

```bash
git add frontend/components/documents/preview-panel-context.tsx
git commit -m "feat: extend PreviewPanelProvider with width and tab state"
```

---

## Task 2: Create SelectedDocumentProvider

**Files:**
- Create: `frontend/components/documents/selected-document-context.tsx`

**Step 1: Create the new context file**

```tsx
'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface SelectedDocumentContextValue {
  selectedDocId: string | null
  setSelectedDocId: (id: string | null) => void
  signedUrl: string | null
  setSignedUrl: (url: string | null) => void
  clearSelection: () => void
}

const SelectedDocumentContext = createContext<SelectedDocumentContextValue | null>(null)

export function SelectedDocumentProvider({ children }: { children: ReactNode }) {
  const [selectedDocId, setSelectedDocIdState] = useState<string | null>(null)
  const [signedUrl, setSignedUrlState] = useState<string | null>(null)

  const setSelectedDocId = useCallback((id: string | null) => {
    setSelectedDocIdState(id)
    // Always clear URL - will be fetched by consumer if needed
    setSignedUrlState(null)
  }, [])

  const setSignedUrl = useCallback((url: string | null) => {
    setSignedUrlState(url)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedDocIdState(null)
    setSignedUrlState(null)
  }, [])

  return (
    <SelectedDocumentContext.Provider value={{
      selectedDocId,
      setSelectedDocId,
      signedUrl,
      setSignedUrl,
      clearSelection,
    }}>
      {children}
    </SelectedDocumentContext.Provider>
  )
}

export function useSelectedDocument() {
  const context = useContext(SelectedDocumentContext)
  if (!context) {
    throw new Error('useSelectedDocument must be used within SelectedDocumentProvider')
  }
  return context
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/documents/selected-document-context.tsx
git commit -m "feat: add SelectedDocumentProvider for document selection state"
```

---

## Task 3: Add SelectedDocumentProvider to Layout

**Files:**
- Modify: `frontend/app/(app)/layout.tsx`

**Step 1: Import and wrap with SelectedDocumentProvider**

Add import at top:
```tsx
import { SelectedDocumentProvider } from "@/components/documents/selected-document-context";
```

Update the JSX to wrap children with SelectedDocumentProvider (inside PreviewPanelProvider):

```tsx
<PreviewPanelProvider>
  <SelectedDocumentProvider>
    <header className="flex h-12 shrink-0 items-center gap-2 px-4 border-b">
      <SidebarTrigger className="ml-2.5" />
      <Separator
        orientation="vertical"
        className="mr-2 data-[orientation=vertical]:h-4"
      />
      {header}
    </header>
    <div className="flex flex-1 flex-col min-h-0">{children}</div>
  </SelectedDocumentProvider>
</PreviewPanelProvider>
```

**Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/app/(app)/layout.tsx
git commit -m "feat: add SelectedDocumentProvider to app layout"
```

---

## Task 4: Update PreviewPanel to Use Context Tab

**Files:**
- Modify: `frontend/components/documents/preview-panel.tsx`

**Step 1: Update to use activeTab from context**

Replace the entire file:

```tsx
'use client'

import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VisualPreview } from '@/components/visual-preview'
import { usePreviewPanel } from './preview-panel-context'
import { Loader2 } from 'lucide-react'

// Dynamic import to avoid SSR issues with react-pdf
const PdfViewer = dynamic(
  () => import('@/components/pdf-viewer').then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground/50" />
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
  const { activeTab, setActiveTab } = usePreviewPanel()
  const isPdf = mimeType === 'application/pdf'

  // Determine effective tab: if PDF not available and tab is 'pdf', show visual
  const effectiveTab = (activeTab === 'pdf' && !isPdf) ? 'visual' : activeTab

  return (
    <Tabs value={effectiveTab} onValueChange={(v) => setActiveTab(v as 'pdf' | 'visual')} className="flex flex-col h-full">
      {/* Header bar - matches table header height */}
      <div className="flex h-[40.5px] shrink-0 items-center px-4 border-b">
        <TabsList className="h-7 p-0.5 bg-muted/50">
          <TabsTrigger
            value="pdf"
            disabled={!isPdf}
            className="h-6 px-2.5 text-xs rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            PDF
          </TabsTrigger>
          <TabsTrigger
            value="visual"
            className="h-6 px-2.5 text-xs rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Visual
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Content area */}
      <TabsContent value="pdf" className="flex-1 mt-0 overflow-hidden">
        {isPdf && pdfUrl ? (
          <PdfViewer url={pdfUrl} />
        ) : (
          <div className="flex h-[600px] items-center justify-center">
            <p className="text-sm text-muted-foreground">PDF preview not available</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="visual" className="flex-1 mt-0 overflow-hidden">
        <VisualPreview markdown={ocrText} />
      </TabsContent>
    </Tabs>
  )
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/documents/preview-panel.tsx
git commit -m "feat: update PreviewPanel to use activeTab from context"
```

---

## Task 5: Update DocumentsTable to Use Contexts

**Files:**
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Replace entire file with context-integrated version**

```tsx
'use client'

import * as React from 'react'
import { useAuth } from '@clerk/nextjs'
import {
  ColumnFiltersState,
  SortingState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { createClerkSupabaseClient } from '@/lib/supabase'
import { columns } from './columns'
import { SubBar } from './sub-bar'
import { FilterButton } from './filter-button'
import { SelectionActions } from './selection-actions'
import { UploadDialogTrigger } from './upload-dialog'
import { PreviewPanel } from './preview-panel'
import { usePreviewPanel } from './preview-panel-context'
import { useSelectedDocument } from './selected-document-context'
import type { Document } from '@/types/documents'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentsTableProps {
  documents: Document[]
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  // Auth for Supabase client
  const { getToken } = useAuth()

  // Shared state from contexts
  const { selectedDocId, setSelectedDocId, signedUrl, setSignedUrl } = useSelectedDocument()
  const { panelRef, isCollapsed, setIsCollapsed, panelWidth, setPanelWidth } = usePreviewPanel()

  // Panel width from context (percentage for preview panel)
  const mainPanelSize = 100 - panelWidth

  // Find selected document from documents array
  const selectedDoc = React.useMemo(() => {
    if (!selectedDocId) return null
    return documents.find((d) => d.id === selectedDocId) ?? null
  }, [selectedDocId, documents])

  // Fetch signed URL when selected document changes
  React.useEffect(() => {
    const filePath = selectedDoc?.file_path
    if (!filePath) {
      setSignedUrl(null)
      return
    }

    // Track if this effect has been superseded by a newer one
    let isCancelled = false

    const fetchSignedUrl = async () => {
      try {
        const supabase = createClerkSupabaseClient(getToken)
        const { data } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePath, 3600) // 1 hour expiry

        // Only update state if this request is still current
        if (!isCancelled) {
          setSignedUrl(data?.signedUrl ?? null)
        }
      } catch (error) {
        console.error('Failed to fetch signed URL:', error)
        if (!isCancelled) {
          setSignedUrl(null)
        }
      }
    }

    fetchSignedUrl()

    // Cleanup: mark this effect as cancelled when a new one starts
    return () => {
      isCancelled = true
    }
  }, [selectedDocId, selectedDoc?.file_path, getToken, setSignedUrl])

  // Update panel width in context when resized
  const handleLayoutChange = React.useCallback((sizes: number[]) => {
    if (sizes[1] !== undefined) {
      setPanelWidth(sizes[1])
    }
  }, [setPanelWidth])

  // Note: We intentionally do NOT clear selection when preview collapses
  // This allows the user to toggle preview and see the same document again

  const table = useReactTable({
    data: documents,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  })

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Sub-bar */}
      <SubBar
        left={
          <>
            <FilterButton />
            <ExpandableSearch
              value={(table.getColumn('filename')?.getFilterValue() as string) ?? ''}
              onChange={(value) => table.getColumn('filename')?.setFilterValue(value)}
              placeholder="Search documents..."
            />
          </>
        }
        right={
          <>
            <SelectionActions
              selectedCount={table.getFilteredSelectedRowModel().rows.length}
            />
            <UploadDialogTrigger />
          </>
        }
      />

      {/* Main content - resizable layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 overflow-hidden"
        onLayout={handleLayoutChange}
      >
        {/* Left: Documents table - main content */}
        <ResizablePanel
          defaultSize={mainPanelSize}
          minSize={40}
          className="overflow-hidden min-w-0"
        >
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30 group/header">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "h-9 text-sm font-normal text-muted-foreground",
                          header.column.id === 'select' && "w-4",
                          header.column.id === 'uploaded_at' && "w-24 text-right pr-5"
                        )}
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
              <TableBody className="[&_tr:last-child]:border-b">
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "h-12 hover:bg-muted/30 transition-colors duration-150 group/row",
                        selectedDocId === row.original.id && !isCollapsed && "bg-muted/50"
                      )}
                      data-state={row.getIsSelected() && 'selected'}
                      onClick={() => {
                        if (selectedDocId === row.original.id) {
                          // Same row clicked - toggle the panel
                          if (panelRef.current?.isCollapsed()) {
                            panelRef.current?.expand()
                          } else {
                            panelRef.current?.collapse()
                          }
                        } else {
                          // Different row clicked - select and ensure panel is open
                          setSelectedDocId(row.original.id)
                          if (panelRef.current?.isCollapsed()) {
                            panelRef.current?.expand()
                          }
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "py-3",
                            cell.column.id === 'select' && "w-4",
                            cell.column.id === 'filename' && "max-w-0",
                            cell.column.id === 'stacks' && "max-w-0",
                            cell.column.id === 'uploaded_at' && "w-24"
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length} className="h-48">
                      <div className="flex flex-col items-center justify-center text-center py-8">
                        <div className="rounded-full bg-muted/50 p-4 mb-4">
                          <FileText className="size-8 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium">No documents yet</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                          Upload a document to start extracting data
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Preview - collapsible sidebar */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={panelWidth}
          minSize={30}
          maxSize={50}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="overflow-hidden"
        >
          <div className="h-full">
            <PreviewPanel
              pdfUrl={signedUrl}
              ocrText={null}
              mimeType={selectedDoc?.mime_type ?? ''}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Test manually**

1. Open documents list
2. Resize preview panel
3. Navigate to a document detail
4. Verify panel width matches
5. Navigate back to list
6. Verify panel width persisted

**Step 4: Commit**

```bash
git add frontend/components/documents/documents-table.tsx
git commit -m "feat: update DocumentsTable to use shared contexts"
```

---

## Task 6: Update DocumentDetailClient to Use Contexts

**Files:**
- Modify: `frontend/components/documents/document-detail-client.tsx`

**Step 1: Replace entire file with context-integrated version**

Note: The prop `signedUrl` is renamed to `initialSignedUrl` to avoid collision with context.

```tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { useExtractionRealtime, ExtractionUpdate } from '@/hooks/use-extraction-realtime'
import { ExtractedDataTable } from './extracted-data-table'
import { PreviewPanel } from './preview-panel'
import { AiChatBar } from './ai-chat-bar'
import { usePreviewPanel } from './preview-panel-context'
import { useSelectedDocument } from './selected-document-context'
import { SubBar } from './sub-bar'
import { FilterButton } from './filter-button'
import { DocumentDetailActions } from './document-detail-actions'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import type { DocumentWithExtraction } from '@/types/documents'

interface DocumentDetailClientProps {
  initialDocument: DocumentWithExtraction
  initialSignedUrl: string | null  // Renamed from signedUrl to avoid context collision
}

export function DocumentDetailClient({
  initialDocument,
  initialSignedUrl,
}: DocumentDetailClientProps) {
  const [document, setDocument] = useState(initialDocument)
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set())
  const [fieldSearch, setFieldSearch] = useState('')

  // Shared state from contexts
  const { panelRef, setIsCollapsed, panelWidth, setPanelWidth } = usePreviewPanel()
  const { setSelectedDocId, setSignedUrl, signedUrl } = useSelectedDocument()

  // Panel width from context
  const mainPanelSize = 100 - panelWidth

  // Sync selected document to context on mount
  useEffect(() => {
    setSelectedDocId(initialDocument.id)
    if (initialSignedUrl) {
      setSignedUrl(initialSignedUrl)
    }
  }, [initialDocument.id, initialSignedUrl, setSelectedDocId, setSignedUrl])

  // Update panel width in context when resized
  const handleLayoutChange = useCallback((sizes: number[]) => {
    if (sizes[1] !== undefined) {
      setPanelWidth(sizes[1])
    }
  }, [setPanelWidth])

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

  useExtractionRealtime({
    documentId: document.id,
    onUpdate: handleExtractionUpdate,
  })

  // Use context signedUrl (which was set from initialSignedUrl on mount)
  const previewUrl = signedUrl ?? initialSignedUrl

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Sub-bar */}
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
          <DocumentDetailActions assignedStacks={document.stacks ?? []} />
        }
      />

      {/* Main content - resizable layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0"
        onLayout={handleLayoutChange}
      >
        {/* Left: Extracted Data - main content, expands */}
        <ResizablePanel
          defaultSize={mainPanelSize}
          minSize={30}
          className="overflow-auto"
        >
          <div className="h-full">
            <ExtractedDataTable
              fields={document.extracted_fields}
              confidenceScores={document.confidence_scores}
              changedFields={changedFields}
              searchFilter={fieldSearch}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Preview - collapsible sidebar */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={panelWidth}
          minSize={30}
          maxSize={60}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="overflow-auto"
        >
          <div className="h-full">
            <PreviewPanel
              pdfUrl={previewUrl}
              ocrText={document.ocr_raw_text}
              mimeType={document.mime_type}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* AI Chat Bar - inline at bottom */}
      <div className="shrink-0">
        <AiChatBar documentId={document.id} />
      </div>
    </div>
  )
}
```

**Step 2: Update the page.tsx that renders DocumentDetailClient**

The parent page component needs to pass `initialSignedUrl` instead of `signedUrl`. Find the file that renders `<DocumentDetailClient>` (likely `app/(app)/documents/[id]/page.tsx`) and update the prop name:

```tsx
// Change from:
<DocumentDetailClient initialDocument={document} signedUrl={signedUrl} />

// To:
<DocumentDetailClient initialDocument={document} initialSignedUrl={signedUrl} />
```

**Step 3: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Test manually**

1. Resize preview on detail page
2. Navigate back to list
3. Verify width matches
4. Click a different document
5. Verify it opens with same width

**Step 5: Commit**

```bash
git add frontend/components/documents/document-detail-client.tsx frontend/app/\(app\)/documents/\[id\]/page.tsx
git commit -m "feat: update DocumentDetailClient to use shared contexts"
```

---

## Task 7: Update Documents List Loading Skeleton

**Files:**
- Modify: `frontend/app/(app)/documents/loading.tsx`

**Step 1: Convert to client component and use context**

Replace entire file:

```tsx
'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { usePreviewPanel } from '@/components/documents/preview-panel-context'

export default function DocumentsLoading() {
  const { isCollapsed, panelWidth } = usePreviewPanel()
  const mainWidth = isCollapsed ? 100 : 100 - panelWidth

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Sub-bar skeleton */}
      <div className="flex h-10 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-7" />
        </div>
        <Skeleton className="h-7 w-20" />
      </div>

      {/* Main content with preview split */}
      <div className="flex flex-1 min-h-0">
        {/* Table area */}
        <div style={{ width: `${mainWidth}%` }} className="overflow-hidden border-r">
          {/* Table header skeleton */}
          <div className="flex h-9 items-center gap-4 border-b bg-muted/30 px-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          {/* Table rows skeleton */}
          <div className="p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-12 items-center gap-4 border-b px-4">
                <Skeleton className="h-4 w-4" />
                <div className="flex items-center gap-2 flex-1">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Preview area skeleton (if not collapsed) */}
        {!isCollapsed && (
          <div style={{ width: `${panelWidth}%` }} className="overflow-hidden">
            {/* Preview header skeleton */}
            <div className="flex h-[40.5px] items-center px-4 border-b">
              <Skeleton className="h-7 w-24" />
            </div>
            {/* Preview content skeleton */}
            <div className="p-4">
              <Skeleton className="h-[500px] w-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/app/(app)/documents/loading.tsx
git commit -m "feat: update documents list skeleton to use preview context"
```

---

## Task 8: Update Document Detail Loading Skeleton

**Files:**
- Modify: `frontend/app/(app)/documents/[id]/loading.tsx`

**Step 1: Convert to client component and use context**

Replace entire file:

```tsx
'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { usePreviewPanel } from '@/components/documents/preview-panel-context'

export default function DocumentDetailLoading() {
  const { isCollapsed, panelWidth } = usePreviewPanel()
  const mainWidth = isCollapsed ? 100 : 100 - panelWidth

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Sub-bar skeleton */}
      <div className="flex h-10 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-7" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>

      {/* Main content with preview split */}
      <div className="flex flex-1 min-h-0">
        {/* Extracted data area */}
        <div style={{ width: `${mainWidth}%` }} className="overflow-hidden border-r">
          {/* Table header skeleton */}
          <div className="flex h-9 items-center gap-4 border-b bg-muted/30 px-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          {/* Table rows skeleton */}
          <div className="p-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex h-12 items-center gap-4 border-b px-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Preview area skeleton (if not collapsed) */}
        {!isCollapsed && (
          <div style={{ width: `${panelWidth}%` }} className="overflow-hidden">
            {/* Preview header skeleton */}
            <div className="flex h-[40.5px] items-center px-4 border-b">
              <Skeleton className="h-7 w-24" />
            </div>
            {/* Preview content skeleton */}
            <div className="p-4">
              <Skeleton className="h-[500px] w-full" />
            </div>
          </div>
        )}
      </div>

      {/* AI Chat bar skeleton */}
      <div className="shrink-0 border-t p-3">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  )
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/app/(app)/documents/[id]/loading.tsx
git commit -m "feat: update document detail skeleton to use preview context"
```

---

## Task 9: Manual Testing

**Step 1: Test navigation flow**

1. Open documents list
2. Click a row to select document → preview opens
3. Resize preview panel to ~35%
4. Switch to Visual tab
5. Click filename to navigate to detail page
6. **Verify:** Preview is same width (~35%), Visual tab selected
7. Resize preview to ~45%
8. Switch to PDF tab
9. Click browser back button
10. **Verify:** List shows same document selected, preview at ~45%, PDF tab

**Step 2: Test loading skeletons**

1. Open Network tab, enable throttling (Slow 3G)
2. Navigate from list to detail
3. **Verify:** Loading skeleton matches preview layout (no jump)
4. Navigate back to list
5. **Verify:** Loading skeleton matches preview layout

**Step 3: Test persistence**

1. Set preview to specific width and tab
2. Close browser tab completely
3. Reopen the app
4. **Verify:** Width and tab restored from localStorage
5. **Verify:** No document selected (React state cleared on refresh)

**Step 4: Clean up old localStorage**

1. Open DevTools → Application → Local Storage
2. **Verify:** Old keys removed:
   - `stackdocs-preview-collapsed` (removed)
   - `stackdocs-document-layout` (removed)
   - `stackdocs-doc-list-layout` (removed)
3. **Verify:** New key exists:
   - `stackdocs-preview-panel` with `{ collapsed, width, tab }`

---

## Task 10: Final Commit

**Step 1: Verify all changes**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: No errors

**Step 2: Final commit if any uncommitted changes**

```bash
git status
# If changes exist:
git add -A
git commit -m "chore: unified preview state cleanup"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Extend PreviewPanelProvider | preview-panel-context.tsx |
| 2 | Create SelectedDocumentProvider | selected-document-context.tsx (new) |
| 3 | Add provider to layout | layout.tsx |
| 4 | Update PreviewPanel for context tab | preview-panel.tsx |
| 5 | Update DocumentsTable to use contexts | documents-table.tsx |
| 6 | Update DocumentDetailClient to use contexts | document-detail-client.tsx |
| 7 | Update list loading skeleton | documents/loading.tsx |
| 8 | Update detail loading skeleton | documents/[id]/loading.tsx |
| 9 | Manual testing | — |
| 10 | Final verification | — |
