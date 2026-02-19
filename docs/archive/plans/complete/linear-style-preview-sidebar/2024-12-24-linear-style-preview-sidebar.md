# Linear-Style Preview Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the document detail page to have a Linear-style resizable right sidebar for the preview panel, with a toggle button in the header.

**Architecture:** Replace the current fixed-width left/right layout with `react-resizable-panels`. The preview panel becomes a collapsible right sidebar with a vertical border separator (no rounded box). Panel size persists to localStorage via manual `onLayout` callback. Header toggle button is a client component that communicates with the panel via a shared ref.

**Tech Stack:** react-resizable-panels (already installed via shadcn), localStorage for persistence, lucide-react icons

---

## Task 1: Create Preview Panel Context

**Files:**
- Create: `frontend/components/documents/preview-panel-context.tsx`

**Step 1: Create the context file**

This context allows the header toggle button (client component) to control the preview panel's collapse/expand state.

```tsx
'use client'

import { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react'
import type { ImperativeHandle as PanelImperativeHandle } from 'react-resizable-panels'

const STORAGE_KEY = 'stackdocs-preview-collapsed'

interface PreviewPanelContextValue {
  panelRef: React.RefObject<PanelImperativeHandle | null>
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  toggle: () => void
}

const PreviewPanelContext = createContext<PreviewPanelContextValue | null>(null)

export function PreviewPanelProvider({ children }: { children: ReactNode }) {
  const panelRef = useRef<PanelImperativeHandle | null>(null)

  // Initialize from localStorage to avoid hydration mismatch
  const [isCollapsed, setIsCollapsedState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    }
    return false
  })

  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(collapsed))
    }
  }, [])

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
    <PreviewPanelContext.Provider value={{ panelRef, isCollapsed, setIsCollapsed, toggle }}>
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

**Step 2: Verify the file was created**

Run: `cat frontend/components/documents/preview-panel-context.tsx | head -5`
Expected: Shows the 'use client' directive and imports

**Step 3: Commit**

```bash
git add frontend/components/documents/preview-panel-context.tsx
git commit -m "feat: add preview panel context for collapse state sharing"
```

---

## Task 2: Create Preview Toggle Button Component

**Files:**
- Create: `frontend/components/documents/preview-toggle.tsx`

**Step 1: Create the toggle button component**

```tsx
'use client'

import { PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePreviewPanel } from './preview-panel-context'
import { cn } from '@/lib/utils'

export function PreviewToggle() {
  const { isCollapsed, toggle } = usePreviewPanel()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={cn(
        'h-7 px-2 text-xs',
        !isCollapsed && 'bg-accent text-accent-foreground'
      )}
    >
      <PanelRight className="mr-1.5 size-3.5" />
      Preview
    </Button>
  )
}
```

**Step 2: Verify the file was created**

Run: `cat frontend/components/documents/preview-toggle.tsx | head -5`
Expected: Shows the 'use client' directive and imports

**Step 3: Commit**

```bash
git add frontend/components/documents/preview-toggle.tsx
git commit -m "feat: add preview toggle button component"
```

---

## Task 3: Update Document Detail Client with Resizable Panels

**Files:**
- Modify: `frontend/components/documents/document-detail-client.tsx`

**Step 1: Update imports**

Replace the current imports section (lines 1-8) with:

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
import type { DocumentWithExtraction } from '@/types/documents'

const LAYOUT_STORAGE_KEY = 'stackdocs-document-layout'
```

**Step 2: Add layout persistence and panel ref**

Inside the component function, after the existing state declarations (after line 20), add:

```tsx
  // Preview panel collapse/expand
  const { panelRef, setIsCollapsed } = usePreviewPanel()

  // Persist panel sizes to localStorage
  const [defaultLayout] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY)
      if (saved) {
        try {
          return JSON.parse(saved) as number[]
        } catch {
          return [60, 40]
        }
      }
    }
    return [60, 40]
  })

  const handleLayoutChange = useCallback((sizes: number[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(sizes))
    }
  }, [])
```

**Step 3: Replace the layout JSX**

Replace the return statement (lines 69-97) with:

```tsx
  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Main content - resizable layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0"
        onLayout={handleLayoutChange}
      >
        {/* Left: Extracted Data - main content, expands */}
        <ResizablePanel
          defaultSize={defaultLayout[0]}
          minSize={30}
          className="overflow-auto"
        >
          <div className="h-full p-4">
            <ExtractedDataTable
              fields={document.extracted_fields}
              confidenceScores={document.confidence_scores}
              changedFields={changedFields}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: Preview - collapsible sidebar */}
        <ResizablePanel
          ref={panelRef}
          defaultSize={defaultLayout[1]}
          minSize={20}
          maxSize={60}
          collapsible
          collapsedSize={0}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className="overflow-auto"
        >
          <div className="h-full border-l p-4">
            <PreviewPanel
              pdfUrl={signedUrl}
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
```

**Step 4: Verify the changes compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```bash
git add frontend/components/documents/document-detail-client.tsx
git commit -m "feat: replace fixed layout with resizable panels"
```

---

## Task 4: Update Preview Panel Styles

**Files:**
- Modify: `frontend/components/documents/preview-panel.tsx`

**Step 1: Remove rounded borders from TabsContent**

In `preview-panel.tsx`, update line 52 to remove `rounded-lg`:

```tsx
      <TabsContent value="pdf" className="flex-1 mt-0 border bg-muted/20 overflow-hidden">
```

And line 62:

```tsx
      <TabsContent value="visual" className="flex-1 mt-0 border bg-muted/20 overflow-hidden">
```

**Step 2: Verify the changes**

Run: `grep "rounded-lg" frontend/components/documents/preview-panel.tsx`
Expected: No output (no matches)

**Step 3: Commit**

```bash
git add frontend/components/documents/preview-panel.tsx
git commit -m "style: remove rounded borders from preview panel"
```

---

## Task 5: Create Document Detail Layout with Provider

**Files:**
- Create: `frontend/app/(app)/documents/[id]/layout.tsx`

**Why:** The header slot and page content are siblings rendered by the parent layout. For the PreviewToggle in the header to communicate with the panel in the page, they must share a context provider. Creating a layout at the `[id]` level wraps both.

**Step 1: Create the layout file**

```tsx
import { PreviewPanelProvider } from '@/components/documents/preview-panel-context'

export default function DocumentDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PreviewPanelProvider>{children}</PreviewPanelProvider>
}
```

**Step 2: Verify the file was created**

Run: `cat frontend/app/\\(app\\)/documents/\\[id\\]/layout.tsx`
Expected: Shows the layout code

**Step 3: Commit**

```bash
git add frontend/app/(app)/documents/[id]/layout.tsx
git commit -m "feat: add document detail layout with preview panel provider"
```

---

## Task 6: Add Preview Toggle to Header

**Files:**
- Create: `frontend/components/documents/document-header-actions.tsx`
- Modify: `frontend/app/(app)/@header/documents/[id]/page.tsx`

**Step 1: Create the client component for header actions**

The header slot is a server component but needs to render a client component for the toggle.

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { PreviewToggle } from './preview-toggle'
import { Edit, Download } from 'lucide-react'

interface DocumentHeaderActionsProps {
  assignedStacks: Array<{ id: string; name: string }>
}

export function DocumentHeaderActions({ assignedStacks }: DocumentHeaderActionsProps) {
  return (
    <>
      <StacksDropdown assignedStacks={assignedStacks} />
      <PreviewToggle />
      <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs">
        <Edit className="mr-1.5 size-3.5" />
        Edit
      </Button>
      <Button variant="ghost" size="sm" disabled className="h-7 px-2 text-xs">
        <Download className="mr-1.5 size-3.5" />
        Export
      </Button>
    </>
  )
}
```

**Step 2: Update the header slot to use the new component**

Replace `frontend/app/(app)/@header/documents/[id]/page.tsx` contents with:

```tsx
import { notFound } from 'next/navigation'
import { getDocumentWithExtraction } from '@/lib/queries/documents'
import { PageHeader } from '@/components/layout/page-header'
import { DocumentHeaderActions } from '@/components/documents/document-header-actions'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Header slot for document detail page.
 * Renders PageHeader with document title and actions in the layout's header bar.
 */
export default async function DocumentHeaderSlot({ params }: PageProps) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  if (!document) {
    notFound()
  }

  return (
    <PageHeader
      title={document.filename}
      actions={<DocumentHeaderActions assignedStacks={document.stacks} />}
    />
  )
}
```

**Step 3: Verify the changes compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add frontend/components/documents/document-header-actions.tsx frontend/app/(app)/@header/documents/[id]/page.tsx
git commit -m "feat: add preview toggle button to document header"
```

---

## Task 7: Manual Testing

**Step 1: Start the dev server**

Run: `cd frontend && npm run dev`

**Step 2: Test the following scenarios**

1. Navigate to a document detail page
2. Verify the preview panel appears on the right with a vertical border (not rounded box)
3. Drag the resize handle - panel should resize
4. Refresh the page - panel size should persist
5. Click the "Preview" button in header - panel should collapse
6. Click again - panel should expand
7. Verify the button is highlighted when panel is open
8. Collapse panel, refresh page - should stay collapsed

**Step 3: Fix any issues found during testing**

---

## Task 8: Final Commit

**Step 1: Ensure all changes are committed**

Run: `git status`
Expected: Working tree clean

**Step 2: If any uncommitted changes, commit them**

```bash
git add -A
git commit -m "feat: complete Linear-style preview sidebar implementation"
```
