# Agent UI Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the new agent components into the app layout (app-wide) and header.

**Architecture:** AgentContainer lives in root layout with self-managed visibility. It shows on `/documents` and `/stacks` routes. UploadButton in header triggers agent popup.

**Tech Stack:** Next.js App Router, Zustand, shadcn/ui

---

## Task 3.1: Add AgentContainer to Root Layout

**Files:**
- Modify: `frontend/app/(app)/layout.tsx`
- Modify: `frontend/app/(app)/documents/layout.tsx` (remove old aiChatBarContent)
- Modify: `frontend/components/documents/selected-document-context.tsx` (remove aiChatBarContent)
- Modify: `frontend/components/agent/agent-container.tsx` (add visibility logic)

**Step 1: Update AgentContainer with self-managed visibility**

The AgentContainer checks the current route and only renders on supported pages:

```typescript
// frontend/components/agent/agent-container.tsx
'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AgentBar } from './agent-bar'
import { AgentPopupContent } from './agent-popup-content'

const AGENT_ROUTES = ['/documents', '/stacks']

export function AgentContainer({ className }: { className?: string }) {
  const pathname = usePathname()

  const shouldShow = AGENT_ROUTES.some(route => pathname.startsWith(route))
  if (!shouldShow) return null

  // Mobile responsive: full width on mobile (<640px), max-width on sm+
  // Safe area padding at bottom avoids overlap with iOS home indicator/browser controls
  // Per Gemini code review recommendation for mobile UX
  return (
    <div className={cn(
      'relative w-full sm:max-w-xl mx-auto',  // 576px - consistent with codebase patterns
      'pb-[env(safe-area-inset-bottom)]',
      className
    )}>
      <div className="absolute bottom-full left-0 right-0">
        <AgentPopupContent />
      </div>
      <AgentBar />
    </div>
  )
}
```

**Step 2: Add AgentContainer to root layout**

```typescript
// frontend/app/(app)/layout.tsx
import { cookies } from "next/headers";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar-server";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PreviewPanelProvider } from "@/components/documents/preview-panel-context";
import { SelectedDocumentProvider } from "@/components/documents/selected-document-context";
import { DocumentsFilterProvider } from "@/components/documents/documents-filter-context";
import { DocumentDetailFilterProvider } from "@/components/documents/document-detail-filter-context";
import { StacksFilterProvider } from "@/components/stacks/stacks-filter-context";
import { StackDetailFilterProvider } from "@/components/stacks/stack-detail-filter-context";
import { AgentContainer } from "@/components/agent";

export default async function AppLayout({
  children,
  header,
  subbar,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  subbar: React.ReactNode;
}) {
  // Sidebar state persistence
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh overflow-hidden"
    >
      <AppSidebar />
      <SidebarInset>
        <PreviewPanelProvider>
          <SelectedDocumentProvider>
            <DocumentsFilterProvider>
              <DocumentDetailFilterProvider>
                <StacksFilterProvider>
                  <StackDetailFilterProvider>
                    <header className="flex h-12 shrink-0 items-center gap-2 px-4 border-b">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarTrigger className="ml-2.5" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Toggle sidebar
                        </TooltipContent>
                      </Tooltip>
                      <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                      />
                      {header}
                    </header>
                    {/* SubBar slot - rendered between header and content */}
                    {subbar}
                    <div className="flex flex-1 flex-col min-h-0">{children}</div>

                    <AgentContainer className="p-4" />
                  </StackDetailFilterProvider>
                </StacksFilterProvider>
              </DocumentDetailFilterProvider>
            </DocumentsFilterProvider>
          </SelectedDocumentProvider>
        </PreviewPanelProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

**Step 3: Remove aiChatBarContent from documents layout**

Update documents layout to remove the old chat bar slot:

```typescript
// frontend/app/(app)/documents/layout.tsx
'use client'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { PreviewPanel } from '@/components/documents/preview-panel'
import { usePreviewPanel } from '@/components/documents/preview-panel-context'
import { useSelectedDocument } from '@/components/documents/selected-document-context'

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { panelRef, setIsCollapsed, panelWidth, setPanelWidth } = usePreviewPanel()
  const { signedUrl, ocrText, mimeType } = useSelectedDocument()

  const mainPanelSize = 100 - panelWidth

  const handleLayoutChange = (sizes: number[]) => {
    if (sizes[1] !== undefined) {
      setPanelWidth(sizes[1])
    }
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="flex-1 min-h-0 overflow-hidden"
      onLayout={handleLayoutChange}
    >
      {/* Main content panel - pages render here */}
      <ResizablePanel
        defaultSize={mainPanelSize}
        minSize={40}
        className="overflow-hidden min-w-0 flex flex-col"
      >
        {children}
      </ResizablePanel>

      <ResizableHandle />

      {/* Preview panel - persists across navigation */}
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
            ocrText={ocrText}
            mimeType={mimeType}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
```

**Step 4: Clean up SelectedDocumentContext**

Remove `aiChatBarContent` and `setAiChatBarContent` from the context - they're no longer needed.

```typescript
// frontend/components/documents/selected-document-context.tsx
'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

interface SelectedDocumentContextValue {
  selectedDocId: string | null
  setSelectedDocId: (id: string | null) => void
  signedUrl: string | null
  setSignedUrl: (url: string | null) => void
  signedUrlDocId: string | null
  setSignedUrlDocId: (id: string | null) => void
  mimeType: string
  setMimeType: (type: string) => void
  ocrText: string | null
  setOcrText: (text: string | null) => void
}

const SelectedDocumentContext = createContext<SelectedDocumentContextValue | null>(null)

export function SelectedDocumentProvider({ children }: { children: ReactNode }) {
  const [selectedDocId, setSelectedDocIdState] = useState<string | null>(null)
  const [signedUrl, setSignedUrlState] = useState<string | null>(null)
  const [signedUrlDocId, setSignedUrlDocIdState] = useState<string | null>(null)
  const [mimeType, setMimeTypeState] = useState<string>('')
  const [ocrText, setOcrTextState] = useState<string | null>(null)

  const setSelectedDocId = useCallback((id: string | null) => {
    setSelectedDocIdState(id)
  }, [])

  const setSignedUrl = useCallback((url: string | null) => {
    setSignedUrlState(url)
  }, [])

  const setSignedUrlDocId = useCallback((id: string | null) => {
    setSignedUrlDocIdState(id)
  }, [])

  const setMimeType = useCallback((type: string) => {
    setMimeTypeState(type)
  }, [])

  const setOcrText = useCallback((text: string | null) => {
    setOcrTextState(text)
  }, [])

  const contextValue = useMemo(() => ({
    selectedDocId,
    setSelectedDocId,
    signedUrl,
    setSignedUrl,
    signedUrlDocId,
    setSignedUrlDocId,
    mimeType,
    setMimeType,
    ocrText,
    setOcrText,
  }), [selectedDocId, setSelectedDocId, signedUrl, setSignedUrl, signedUrlDocId, setSignedUrlDocId, mimeType, setMimeType, ocrText, setOcrText])

  return (
    <SelectedDocumentContext.Provider value={contextValue}>
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

**Step 5: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Test locally**

Run: `npm run dev`
- Navigate to `/documents` - AgentBar should appear at bottom
- Navigate to `/stacks` - AgentBar should appear at bottom
- Navigate to `/settings` or other pages - AgentBar should NOT appear
- Focus on bar reveals action buttons

**Step 7: Commit**

```bash
git add frontend/app/(app)/layout.tsx frontend/app/(app)/documents/layout.tsx frontend/components/documents/selected-document-context.tsx frontend/components/agent/agent-container.tsx
git commit -m "feat(agent): add AgentContainer to root layout with self-managed visibility"
```

---

## Task 3.1.5: Add viewport-fit=cover for iOS Safe Areas

> **Note (Gemini Code Review):** The `pb-[env(safe-area-inset-bottom)]` in AgentContainer requires
> `viewport-fit=cover` in the viewport meta tag to work on iOS devices.

**Files:**
- Modify: `frontend/app/layout.tsx`

**Step 1: Add viewport export with viewport-fit=cover**

Next.js 14+ uses the `viewport` export for viewport meta configuration:

```typescript
// frontend/app/layout.tsx
import type { Metadata, Viewport } from 'next'

// Add this export after the metadata export
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
```

**Step 2: Verify the meta tag is rendered**

Run dev server and inspect the `<head>`:
- Expected: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`

**Step 3: Commit**

```bash
git add frontend/app/layout.tsx
git commit -m "feat(viewport): add viewport-fit=cover for iOS safe area support"
```

---

## Task 3.2: Add Upload Button to Header Actions

**Files:**
- Modify: `frontend/app/(app)/@header/documents/page.tsx`
- Create: `frontend/components/agent/upload-button.tsx`

**Step 1: Create UploadButton component**

```typescript
// frontend/components/agent/upload-button.tsx
'use client'

import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useAgentStore, initialUploadData } from './stores/agent-store'

export function UploadButton() {
  const openFlow = useAgentStore((s) => s.openFlow)

  const handleClick = () => {
    openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })
  }

  return (
    <Button size="sm" onClick={handleClick}>
      <Icons.Upload className="size-4 mr-1.5" />
      Upload
    </Button>
  )
}
```

**Step 2: Add to barrel export**

Add UploadButton to the existing exports:

```typescript
// frontend/components/agent/index.ts
export { AgentContainer } from './agent-container'
export { AgentBar } from './agent-bar'
export { AgentPopup } from './agent-popup'
export { AgentActions } from './agent-actions'
export { UploadButton } from './upload-button'
export { useAgentStore, useAgentFlow, useAgentStatus, useAgentPopup, useAgentEvents, initialUploadData } from './stores/agent-store'
export type { AgentFlow, UploadFlowData, AgentStatus } from './stores/agent-store'
```

**Step 3: Update documents list header**

```typescript
// frontend/app/(app)/@header/documents/page.tsx
import { PageHeader } from '@/components/layout/page-header'
import { PreviewToggle } from '@/components/documents/preview-toggle'
import { UploadButton } from '@/components/agent/upload-button'

export default function DocumentsHeaderSlot() {
  return (
    <PageHeader
      actions={
        <div className="flex items-center gap-2">
          <UploadButton />
          <PreviewToggle />
        </div>
      }
    />
  )
}
```

**Step 4: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Test locally**

Run: `npm run dev`
- Click Upload button in header
- Verify popup opens with dropzone
- Complete full upload flow

**Step 6: Commit**

```bash
git add frontend/app/(app)/@header/documents/page.tsx frontend/components/agent/upload-button.tsx frontend/components/agent/index.ts
git commit -m "feat(agent): add Upload button to documents header"
```

---

## Task 3.3: End-to-End Flow Testing

**Files:** None (manual testing)

**Step 1: Test upload flow end-to-end**

Run: `npm run dev`

Test cases:
1. Upload button in header opens popup
2. Dropzone accepts PDF/JPG/PNG files
3. File validation rejects invalid types/sizes
4. Document rename field works
5. Auto Extract → Extract triggers SSE streaming
6. Custom Fields → Next → Fields step works
7. Popup collapses during extraction
8. Bar shows dynamic status during extraction
9. Complete step shows success + actions
10. View Document navigates correctly
11. Upload Another resets flow
12. Close mid-flow shows confirmation
13. Focus on bar reveals action buttons
14. **AgentBar only visible on /documents and /stacks routes**
15. **AgentBar hidden on other routes (settings, etc.)**

**Step 2: Test mobile responsive layout**

Use browser DevTools to test at mobile viewport sizes:

1. Open DevTools → Toggle device toolbar (Cmd+Shift+M / Ctrl+Shift+M)
2. Select iPhone 14 Pro or similar device preset
3. Verify AgentContainer takes full width on mobile (<640px)
4. Switch to tablet/desktop view (>640px) and verify max-width constraint applies
5. Test on iOS Safari (real device or simulator) to verify safe area padding:
   - AgentBar should not overlap with iOS home indicator
   - Bottom padding should adjust dynamically on devices with notches/home bars

**Step 3: Fix any issues found**

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(agent): address issues found during e2e testing"
```
