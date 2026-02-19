# Agent UI Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove old upload dialog and chat bar components after new agent system is integrated.

**Architecture:** Delete deprecated files, update imports, verify build passes.

**Tech Stack:** Next.js, TypeScript

---

## Task 4.1: Update Files That Import Old Components

**Files:**
- Modify: `frontend/components/documents/document-detail-client.tsx`
- Modify: `frontend/components/layout/sidebar/sidebar-header-menu.tsx`
- Modify: `frontend/app/(app)/@subbar/documents/page.tsx`

**Step 1: Find all imports of deleted components**

```bash
grep -rE "upload-dialog|ai-chat-bar|ai-activity-panel|UploadDialogTrigger|UploadDialogContent|AiChatBar|AiActivityPanel|setAiChatBarContent" frontend/ --include="*.tsx" --include="*.ts"
```

**Step 2: Update document-detail-client.tsx**

Remove AiChatBar import and setAiChatBarContent usage (context already cleaned in 03-integration):

```typescript
// frontend/components/documents/document-detail-client.tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useExtractionRealtime, ExtractionUpdate } from '@/hooks/use-extraction-realtime'
import { ExtractedDataTable } from './extracted-data-table'
import { useSelectedDocument } from './selected-document-context'
import { useDocumentDetailFilter } from './document-detail-filter-context'
import { createClerkSupabaseClient } from '@/lib/supabase'
import type { DocumentWithExtraction } from '@/types/documents'

interface DocumentDetailClientProps {
  initialDocument: DocumentWithExtraction
  initialSignedUrl: string | null
}

export function DocumentDetailClient({
  initialDocument,
  initialSignedUrl,
}: DocumentDetailClientProps) {
  const [document, setDocument] = useState(initialDocument)
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set())

  const { getToken } = useAuth()

  const { setSelectedDocId, setSignedUrl, setSignedUrlDocId, signedUrlDocId, setMimeType, setOcrText } = useSelectedDocument()
  const { fieldSearch, setSelectedFieldCount } = useDocumentDetailFilter()

  // Sync selected document to context and fetch signed URL client-side
  useEffect(() => {
    let cancelled = false
    setSelectedDocId(initialDocument.id)
    setMimeType(initialDocument.mime_type)
    setOcrText(initialDocument.ocr_raw_text ?? null)

    if (signedUrlDocId === initialDocument.id) {
      return
    }

    if (initialSignedUrl) {
      setSignedUrl(initialSignedUrl)
      setSignedUrlDocId(initialDocument.id)
    } else if (initialDocument.file_path) {
      const supabase = createClerkSupabaseClient(getToken)
      supabase.storage
        .from('documents')
        .createSignedUrl(initialDocument.file_path, 3600)
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) {
            console.error('Failed to get signed URL:', error)
          }
          setSignedUrl(data?.signedUrl ?? null)
          setSignedUrlDocId(initialDocument.id)
        })
    }

    return () => {
      cancelled = true
    }
  }, [initialDocument.id, initialDocument.file_path, initialDocument.mime_type, initialDocument.ocr_raw_text, initialSignedUrl, signedUrlDocId, getToken, setSelectedDocId, setSignedUrl, setSignedUrlDocId, setMimeType, setOcrText])

  const documentRef = useRef(document)
  useEffect(() => {
    documentRef.current = document
  }, [document])

  const handleExtractionUpdate = useCallback(
    (update: ExtractionUpdate) => {
      const newChangedFields = new Set<string>()
      const oldFields = documentRef.current.extracted_fields || {}
      const newFields = update.extracted_fields || {}

      for (const key of Object.keys(newFields)) {
        if (JSON.stringify(oldFields[key]) !== JSON.stringify(newFields[key])) {
          newChangedFields.add(key)
        }
      }

      setDocument((prev) => ({
        ...prev,
        extracted_fields: update.extracted_fields,
        confidence_scores: update.confidence_scores,
      }))

      setChangedFields(newChangedFields)
    },
    []
  )

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

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 overflow-auto">
        <ExtractedDataTable
          fields={document.extracted_fields}
          confidenceScores={document.confidence_scores}
          changedFields={changedFields}
          searchFilter={fieldSearch}
          onSelectionChange={setSelectedFieldCount}
        />
      </div>
    </div>
  )
}
```

**Step 3: Update sidebar-header-menu.tsx**

Replace UploadDialogContent with UploadButton from the new agent system:

```typescript
// frontend/components/layout/sidebar/sidebar-header-menu.tsx
"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import * as Icons from "@/components/icons"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarHeader, SidebarMenuButton } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GlobalSearchDialog } from "@/components/layout/global-search-dialog"
import { useAgentStore, initialUploadData } from "@/components/agent"

export function SidebarHeaderMenu() {
  const { theme, setTheme } = useTheme()
  const [searchOpen, setSearchOpen] = React.useState(false)
  const openFlow = useAgentStore((s) => s.openFlow)

  const handleUpload = () => {
    openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })
  }

  return (
    <>
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <SidebarHeader className="h-[47px] flex flex-row items-center justify-between gap-2 px-2 py-0">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="flex-1 h-8 gap-1.5 data-[state=open]:bg-sidebar-accent">
                  <Icons.Stack className="size-6" />
                  <span className="font-semibold">Stackdocs</span>
                  <Icons.ChevronDown className="size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Workspace settings
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem disabled>
              <Icons.Settings className="size-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="#">
                <Icons.Lifebuoy className="size-4" />
                <span>Support</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="#">
                <Icons.Send className="size-4" />
                <span>Feedback</span>
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Icons.Sun className="size-4 dark:hidden" />
                <Icons.Moon className="size-4 hidden dark:block" />
                <span>Theme</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Icons.DeviceDesktop className="size-4" />
                  <span>Auto</span>
                  {theme === "system" && <Icons.Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Icons.Sun className="size-4" />
                  <span>Light</span>
                  {theme === "light" && <Icons.Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Icons.Moon className="size-4" />
                  <span>Dark</span>
                  {theme === "dark" && <Icons.Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setSearchOpen(true)}
              >
                <Icons.Search className="size-4" />
                <span className="sr-only">Search</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Search (Cmd+K)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleUpload}
              >
                <Icons.Upload className="size-4" />
                <span className="sr-only">Upload</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Upload document</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
    </>
  )
}
```

**Step 4: Update documents subbar**

Remove UploadDialogTrigger (upload now happens via AgentBar actions or header button):

```typescript
// frontend/app/(app)/@subbar/documents/page.tsx
'use client'

import { SubBar } from '@/components/layout/sub-bar'
import { FilterButton } from '@/components/layout/filter-button'
import { ExpandableSearch } from '@/components/layout/expandable-search'
import { SelectionActions } from '@/components/layout/selection-actions'
import { useDocumentsFilter } from '@/components/documents/documents-filter-context'

export default function DocumentsSubBar() {
  const { filterValue, setFilterValue, selectedCount } = useDocumentsFilter()

  return (
    <SubBar
      left={
        <>
          <FilterButton />
          <ExpandableSearch
            value={filterValue}
            onChange={setFilterValue}
            placeholder="Search documents..."
          />
        </>
      }
      right={<SelectionActions selectedCount={selectedCount} />}
    />
  )
}
```

**Step 5: Verify compiles before deletion**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit import updates**

```bash
git add frontend/components/documents/document-detail-client.tsx frontend/components/layout/sidebar/sidebar-header-menu.tsx frontend/app/(app)/@subbar/documents/page.tsx
git commit -m "refactor(agent): update imports to use new agent system"
```

---

## Task 4.2: Delete Old Components

**Files:**
- Delete: `frontend/components/layout/upload-dialog/` (entire folder)
- Delete: `frontend/components/layout/ai-chat-bar.tsx`
- Delete: `frontend/components/layout/ai-activity-panel.tsx`

**Step 1: Delete old files**

```bash
rm -rf frontend/components/layout/upload-dialog/
rm frontend/components/layout/ai-chat-bar.tsx
rm frontend/components/layout/ai-activity-panel.tsx
```

**Step 2: Verify no broken imports**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit deletions**

```bash
git add -A
git commit -m "refactor(agent): remove old upload dialog and chat bar components"
```

---

## Task 4.3: Update Documentation

**Files:**
- Modify: `frontend/CLAUDE.md`

**Step 1: Update directory structure**

Remove `upload-dialog/` from the directory structure in `frontend/CLAUDE.md`:

```markdown
## Directory Structure

```
frontend/
├── app/
│   ├── (app)/                    # Protected routes (requires auth)
│   │   ├── @header/              # Parallel route for page headers
│   │   │   ├── documents/        # Documents list header
│   │   │   └── documents/[id]/   # Document detail header
│   │   ├── documents/            # Documents list and detail pages
│   │   ├── stacks/               # Stacks feature (placeholder)
│   │   └── extractions/          # Extractions feature (placeholder)
│   └── api/webhooks/clerk/       # Clerk webhook for user sync
├── components/
│   ├── agent/                    # Agent system (bar, popup, flows)
│   ├── documents/                # Document tables, columns, preview, detail views
│   ├── icons/                    # Centralized Tabler icon barrel export
│   ├── layout/                   # App-level layout components
│   │   └── sidebar/              # Sidebar and navigation components
│   ├── providers/                # Context providers (theme)
│   ├── shared/                   # Reusable components (file-type-icon, stack-badges)
│   └── ui/                       # shadcn/ui primitives
├── lib/
│   ├── queries/                  # Data fetching with React cache()
│   └── supabase/                 # Supabase client setup
├── hooks/                        # Custom React hooks
└── types/                        # TypeScript type definitions
```
```

**Step 2: Commit documentation update**

```bash
git add frontend/CLAUDE.md
git commit -m "docs(frontend): update directory structure after agent migration"
```

---

## Task 4.4: Final Verification

**Files:** None (verification only)

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (or only pre-existing ones)

**Step 3: Test production build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup after agent UI refactor"
```

---

## Success Criteria

After completing all phases, verify:

- [ ] Upload button in header opens agent popup (not modal)
- [ ] Sidebar upload button opens agent popup (not modal)
- [ ] Dropzone -> Configure -> Processing -> Complete flow works
- [ ] User can rename document in configure step
- [ ] Bar shows dynamic status during upload/extraction
- [ ] Popup auto-collapses during processing
- [ ] Actions appear on bar focus, hidden otherwise
- [ ] Actions change based on current route
- [ ] Close mid-flow shows confirmation dialog
- [ ] No regressions in upload/extraction functionality
- [ ] Old upload dialog components deleted
- [ ] No unused imports remain
- [ ] Build passes with no TypeScript errors
- [ ] frontend/CLAUDE.md updated to reflect new structure

---

## Files Summary

### Created (all phases)
- `frontend/components/agent/stores/agent-store.ts`
- `frontend/components/agent/agent-bar.tsx`
- `frontend/components/agent/agent-popup.tsx`
- `frontend/components/agent/agent-popup-content.tsx`
- `frontend/components/agent/agent-actions.tsx`
- `frontend/components/agent/agent-container.tsx`
- `frontend/components/agent/upload-button.tsx`
- `frontend/components/agent/index.ts`
- `frontend/components/agent/flows/documents/upload-flow.tsx`
- `frontend/components/agent/flows/documents/upload-dropzone.tsx`
- `frontend/components/agent/flows/documents/upload-configure.tsx`
- `frontend/components/agent/flows/documents/upload-fields.tsx`
- `frontend/components/agent/flows/documents/upload-extracting.tsx`
- `frontend/components/agent/flows/documents/upload-complete.tsx`
- `frontend/components/agent/panels/confirm-close.tsx`

### Modified (all phases)
- `frontend/app/(app)/layout.tsx`
- `frontend/app/(app)/documents/layout.tsx`
- `frontend/app/(app)/@header/documents/page.tsx`
- `frontend/app/(app)/@subbar/documents/page.tsx`
- `frontend/components/documents/selected-document-context.tsx`
- `frontend/components/documents/document-detail-client.tsx`
- `frontend/components/layout/sidebar/sidebar-header-menu.tsx`
- `frontend/CLAUDE.md`

### Deleted (this phase)
- `frontend/components/layout/upload-dialog/` (entire folder)
- `frontend/components/layout/ai-chat-bar.tsx`
- `frontend/components/layout/ai-activity-panel.tsx`
