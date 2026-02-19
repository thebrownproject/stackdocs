# Header Filters Feature

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move document filter controls from page content to header bar, add stack filtering

**Architecture:** URL search params as single source of truth for filter state. Both `@header` slot and main page read from URL. Use `nuqs` library for type-safe URL state management with debouncing.

**Tech Stack:** nuqs, Next.js App Router searchParams, TanStack Table controlled filters

---

## Context

Currently the filter input lives in `DocumentsTable` component. This feature moves it to the `@header/documents/page.tsx` parallel route slot so filtering controls appear in the header bar (consistent with Linear-style design).

## Research Summary

URL-based filtering is recommended because:
- Both parallel route slots naturally share URL state
- Shareable/bookmarkable filtered views
- Browser back/forward works
- No context providers needed
- Pattern used by Linear, Vercel Dashboard

## Implementation Overview

### Files to Create

| File | Purpose |
|------|---------|
| `lib/hooks/use-document-filters.ts` | Custom hook for URL filter state |
| `components/documents/documents-header-filters.tsx` | Filter inputs for header |

### Files to Modify

| File | Changes |
|------|---------|
| `app/(app)/layout.tsx` | Add NuqsAdapter provider |
| `@header/documents/page.tsx` | Add DocumentsHeaderFilters component |
| `components/documents/documents-table.tsx` | Remove filter input, read from hook |

---

## Key Code Patterns

### Filter Hook (with nuqs)

```typescript
// lib/hooks/use-document-filters.ts
'use client'

import { useQueryState, parseAsString, parseAsArrayOf } from 'nuqs'

export function useDocumentFilters() {
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))
  const [stacks, setStacks] = useQueryState(
    'stacks',
    parseAsArrayOf(parseAsString).withDefault([])
  )

  return {
    search,
    setSearch,
    stacks,
    setStacks,
    clearFilters: () => {
      setSearch(null)
      setStacks(null)
    },
  }
}
```

### Header Filter Component

```typescript
// components/documents/documents-header-filters.tsx
'use client'

import { Input } from '@/components/ui/input'
import { useDocumentFilters } from '@/lib/hooks/use-document-filters'
import { Search } from 'lucide-react'

export function DocumentsHeaderFilters() {
  const { search, setSearch } = useDocumentFilters()

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value || null)}
        placeholder="Filter..."
        className="pl-8 h-7 w-[160px] text-xs"
      />
    </div>
  )
}
```

### TanStack Table Integration

```typescript
// In documents-table.tsx
const { search, stacks } = useDocumentFilters()

const columnFilters = React.useMemo(() => {
  const filters: ColumnFiltersState = []
  if (search) {
    filters.push({ id: 'filename', value: search })
  }
  return filters
}, [search])

const table = useReactTable({
  // ...
  state: { sorting, columnFilters },
})
```

---

## Dependencies

```bash
npm install nuqs
```

## Estimated Effort

~30 minutes implementation + testing

## Related

- Parallel routes architecture: `docs/plans/complete/documents-page/`
- Current filter location: `components/documents/documents-table.tsx:55-67`
