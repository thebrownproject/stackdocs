# @subbar Architecture for Stacks + Documents Refactor

**Date:** 2025-12-30
**Status:** Implementation Complete ✅
**Goal:** Consistent @subbar parallel route architecture across Stacks and Documents

---

## Overview

Add `@subbar` parallel routes for Stacks (list and detail pages) to match the Documents pattern. Also refactor Documents to use a cleaner pattern where SubBars fetch their own server data instead of receiving it through context.

**Principle:** SubBars fetch their own server data. Context holds only client state.

---

## Architecture

### Pattern

```
@subbar/[route]/page.tsx (async server component)
├── Fetches server data it needs (tables, stacks, etc.)
└── Renders client SubBar component with data as props

[route]/layout.tsx
└── Wraps with FilterProvider (client state only)
    ├── @subbar slot (reads context for client state)
    └── {children} (page content, uses context)
```

### Data Flow

| Data Type | Source | Example |
|-----------|--------|---------|
| Server data | SubBar fetches directly | `tables`, `assignedStacks` |
| Client state | Context | `searchFilter`, `selectedCount` |
| Navigation state | URL params | `?tab=...`, `?table=...` |

---

## Stacks List (`/stacks`)

### SubBar Content
- **Left:** ExpandableSearch (filter stacks by name)
- **Right:** "New Stack" button

### Files

```
app/(app)/
├── @subbar/stacks/
│   ├── page.tsx           ← Client component, uses StacksFilterContext
│   └── default.tsx        ← Returns null
└── stacks/
    ├── layout.tsx         ← NEW: wraps with StacksFilterProvider
    └── page.tsx           ← Fetches stacks, passes to StacksList
```

### Context

```typescript
// components/stacks/stacks-filter-context.tsx
interface StacksFilterContext {
  filterValue: string
  setFilterValue: (value: string) => void
}
```

### Component Changes

**StacksList:**
- Remove SubBar rendering
- Receive `stacks` as prop
- Use `filterValue` from context to filter client-side
- Render filtered grid of stack cards

---

## Stacks Detail (`/stacks/[id]`)

### SubBar Content
- **Left:** Tab navigation (Docs | Table 1 | Table 2... | + Create table)
- **Right:** SelectionActions, ExpandableSearch, context-sensitive button (Add docs / Export CSV)

### Files

```
app/(app)/
├── @subbar/stacks/[id]/
│   ├── page.tsx           ← Async server, fetches tables, renders StackDetailSubBar
│   └── default.tsx        ← Returns null
└── stacks/[id]/
    ├── layout.tsx         ← NEW: wraps with StackDetailFilterProvider
    └── page.tsx           ← Fetches full stack, renders StackDetailClient
```

### Context

```typescript
// components/stacks/stack-detail-filter-context.tsx
interface StackDetailFilterContext {
  searchFilter: string
  setSearchFilter: (value: string) => void
  selectedDocCount: number
  setSelectedDocCount: (count: number) => void
}
```

### SubBar Component

```typescript
// @subbar/stacks/[id]/page.tsx
export default async function StackDetailSubBarPage({ params }) {
  const { id } = await params
  const stack = await getStackWithDetails(id)  // cached query
  if (!stack) return null

  return <StackDetailSubBar tables={stack.tables} stackId={id} />
}
```

**StackDetailSubBar (client):**
- Receives `tables` and `stackId` as props
- Reads `searchFilter`, `selectedDocCount` from context
- Reads URL params for active tab (`useSearchParams`)
- Navigates via `router.push()` on tab click
- Shows context-sensitive actions based on active tab

### Component Changes

**StackDetailClient:**
- Remove SubBar rendering from JSX
- Remove local state for `searchFilter`, `selectedDocCount`
- Use context instead: `useStackDetailFilter()`
- Keep tab content rendering (StackDocumentsTab, StackTableView)

---

## Documents Refactor

### Problem
Current Documents detail SubBar receives `assignedStacks` through context, which is populated by the page via `setAssignedStacks()`. This mixes server data with client state.

### Solution
SubBar fetches `assignedStacks` directly. Context holds only client state.

### Context Changes

```typescript
// document-detail-filter-context.tsx (BEFORE)
interface DocumentDetailFilterContext {
  fieldSearch: string
  setFieldSearch: (value: string) => void
  selectedFieldCount: number
  setSelectedFieldCount: (count: number) => void
  assignedStacks: StackSummary[]           // ← REMOVE
  setAssignedStacks: (stacks) => void      // ← REMOVE
}

// document-detail-filter-context.tsx (AFTER)
interface DocumentDetailFilterContext {
  fieldSearch: string
  setFieldSearch: (value: string) => void
  selectedFieldCount: number
  setSelectedFieldCount: (count: number) => void
}
```

### SubBar Changes

```typescript
// @subbar/documents/[id]/page.tsx (BEFORE)
'use client'
export default function DocumentDetailSubBar() {
  const { assignedStacks } = useDocumentDetailFilter()  // from context
  // ...
}

// @subbar/documents/[id]/page.tsx (AFTER)
export default async function DocumentDetailSubBarPage({ params }) {
  const { id } = await params
  const assignedStacks = await getDocumentStacks(id)  // fetch directly
  return <DocumentDetailSubBar assignedStacks={assignedStacks} />
}
```

### Files Changed
- `components/documents/document-detail-filter-context.tsx` - remove assignedStacks
- `@subbar/documents/[id]/page.tsx` - convert to async server, fetch stacks
- `components/documents/document-detail-sub-bar.tsx` - receive stacks as prop (may need to extract)

---

## File Summary

### New Files (Stacks)
| File | Purpose |
|------|---------|
| `@subbar/stacks/page.tsx` | List SubBar (search + new button) |
| `@subbar/stacks/default.tsx` | Fallback |
| `@subbar/stacks/[id]/page.tsx` | Detail SubBar server wrapper |
| `@subbar/stacks/[id]/default.tsx` | Fallback |
| `stacks/layout.tsx` | Wraps with StacksFilterProvider |
| `stacks/[id]/layout.tsx` | Wraps with StackDetailFilterProvider |
| `components/stacks/stacks-filter-context.tsx` | List filter context |
| `components/stacks/stack-detail-filter-context.tsx` | Detail filter context |
| `components/stacks/stack-detail-sub-bar.tsx` | Detail SubBar client component |

### Modified Files (Stacks)
| File | Changes |
|------|---------|
| `components/stacks/stacks-list.tsx` | Remove SubBar, use filter context |
| `components/stacks/stack-detail-client.tsx` | Remove SubBar, use context |

### Modified Files (Documents)
| File | Changes |
|------|---------|
| `components/documents/document-detail-filter-context.tsx` | Remove assignedStacks |
| `@subbar/documents/[id]/page.tsx` | Async server, fetch stacks |

---

## Query Strategy

Use existing cached queries. React `cache()` dedupes calls within the same request.

- `getStackWithDetails(id)` - used by both page and SubBar (via cache)
- `getStacksWithCounts()` - used by stacks list page
- `getDocumentStacks(id)` - new lightweight query for Documents SubBar

---

## Implementation Order

1. **Stacks contexts** - Create filter contexts
2. **Stacks layouts** - Add layout wrappers with providers
3. **Stacks SubBar routes** - Create @subbar parallel routes
4. **Stacks component refactor** - Update StacksList, StackDetailClient
5. **Documents refactor** - Update context and SubBar

---

## Notes

- Tab navigation uses URL params (`?tab=...&table=...`) - no change needed
- Selection actions already exist as shared component
- "Create table" and "Add docs" buttons are placeholders (functionality comes with Stack Agent)
