# Unified Preview State Design

**Date:** 2025-12-27
**Status:** Ready for implementation
**Related:** layout-alignment plan (Phase 3-4)

---

## Problem

The preview panel state is fragmented across pages:
- Panel width stored separately per page (list vs detail)
- Active tab (PDF/Visual) not persisted at all
- Selected document clears on navigation
- Loading skeletons don't match actual layout, causing visual shift

**Result:** Jarring UX when navigating between documents list and document detail. The preview panel feels like two separate components instead of one persistent workspace.

---

## Solution

Unify preview state into shared React contexts so the preview panel feels seamless across navigation.

### Design Principles
- Preview panel is a **persistent workspace** that follows you across pages
- Panel preferences (width, tab) are **user settings** - persist to localStorage
- Selected document is **navigation state** - React state only, clears on refresh
- Loading skeletons match actual layout - no visual shift

---

## Architecture

### State Split

```
┌─────────────────────────────────────────────────────────────┐
│ PreviewPanelProvider (context + localStorage)               │
│ ─────────────────────────────────────────────────────────── │
│ • isCollapsed: boolean        (existing)                    │
│ • panelWidth: number          (NEW - percentage, e.g. 40)   │
│ • activeTab: 'pdf' | 'visual' (NEW - global preference)     │
│                                                             │
│ localStorage key: 'stackdocs-preview-panel'                 │
│ { collapsed: false, width: 40, tab: 'pdf' }                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SelectedDocumentProvider (context only, no persistence)     │
│ ─────────────────────────────────────────────────────────── │
│ • selectedDocId: string | null                              │
│ • signedUrl: string | null    (cached to prevent flash)     │
│                                                             │
│ Lives in memory, clears on refresh, persists across         │
│ client-side navigation.                                     │
└─────────────────────────────────────────────────────────────┘
```

### Provider Location

Both providers wrap the app layout (existing pattern for PreviewPanelProvider):

```tsx
// app/(app)/layout.tsx
<PreviewPanelProvider>
  <SelectedDocumentProvider>
    {children}
  </SelectedDocumentProvider>
</PreviewPanelProvider>
```

---

## Interface Definitions

### PreviewPanelProvider (extended)

```typescript
interface PreviewPanelContextValue {
  // Existing
  panelRef: React.RefObject<ImperativePanelHandle | null>
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  toggle: () => void

  // New
  panelWidth: number                           // percentage (e.g., 40)
  setPanelWidth: (width: number) => void
  activeTab: 'pdf' | 'visual'
  setActiveTab: (tab: 'pdf' | 'visual') => void
}
```

### SelectedDocumentProvider (new)

```typescript
interface SelectedDocumentContextValue {
  selectedDocId: string | null
  setSelectedDocId: (id: string | null) => void
  signedUrl: string | null
  setSignedUrl: (url: string | null) => void
}
```

---

## Behavior

### Navigation Flow: List → Detail → Back

1. **List page:** Click row → `setSelectedDocId(doc.id)` → fetch signed URL → `setSignedUrl(url)` → preview shows document
2. **Click filename:** Navigate to `/documents/[id]`
3. **Detail page:** Mounts with context intact → syncs `selectedDocId` to current document → preview shows same document (no flash, URL cached)
4. **Click back:** Return to list → `selectedDocId` preserved → row highlighted, preview shows same document

### Direct Navigation to Detail

1. Navigate directly to `/documents/abc-123` (e.g., bookmark)
2. Detail page mounts → sets `selectedDocId` to current document ID
3. Preview shows document
4. Click back to list → that document is selected

### Page Refresh

- `PreviewPanelProvider` state restored from localStorage (width, tab, collapsed)
- `SelectedDocumentProvider` state clears (starts fresh, no selection)

---

## Loading Skeletons

Skeletons consume `PreviewPanelProvider` context to render with correct layout:

```tsx
// loading.tsx
'use client'

import { usePreviewPanel } from '@/components/documents/preview-panel-context'

export default function Loading() {
  const { isCollapsed, panelWidth } = usePreviewPanel()

  return (
    <div className="flex h-full">
      <div style={{ width: isCollapsed ? '100%' : `${100 - panelWidth}%` }}>
        <TableSkeleton />
      </div>

      {!isCollapsed && (
        <div style={{ width: `${panelWidth}%` }}>
          <PreviewSkeleton />
        </div>
      )}
    </div>
  )
}
```

**Result:** Resize handle line stays in exact same position during navigation. No layout shift.

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `components/documents/selected-document-context.tsx` | React context for selection + cached URL |

### Modified Files

| File | Changes |
|------|---------|
| `components/documents/preview-panel-context.tsx` | Add `panelWidth`, `activeTab`, consolidate localStorage |
| `components/documents/documents-table.tsx` | Remove local layout state, use contexts |
| `components/documents/document-detail-client.tsx` | Remove local layout state, use contexts, sync selectedDocId |
| `components/documents/preview-panel.tsx` | Use `activeTab` from context instead of local state |
| `app/(app)/documents/loading.tsx` | Use context for skeleton layout |
| `app/(app)/documents/[id]/loading.tsx` | Use context for skeleton layout |
| `app/(app)/layout.tsx` | Add `SelectedDocumentProvider` wrapper |

### localStorage Changes

| Before | After |
|--------|-------|
| `stackdocs-preview-collapsed` | Remove |
| `stackdocs-document-layout` | Remove |
| `stackdocs-doc-list-layout` | Remove |
| — | `stackdocs-preview-panel` `{ collapsed, width, tab }` |

---

## Decisions Log

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Tab persistence | Global preference | Simpler than per-document, matches user intent |
| Width persistence | Global, shared | Preview should feel like one persistent panel |
| Selected doc persistence | React state only | Navigation state, not a long-term preference |
| Signed URL caching | In context | Prevents flash when navigating to same document |
| Header layout | No change | Current design works, no divider needed |

---

## Out of Scope

- Per-document tab memory (always uses global preference)
- URL-based selection persistence (would clutter URLs)
- Header divider alignment (not needed for seamless feel)
