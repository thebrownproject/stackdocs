# Realtime Updates & Extracted Fields Table UX - Design

**Date:** 2025-12-23
**Status:** Design Complete
**Feature:** Document detail page enhancements

---

## Overview

Two-stage enhancement to the document detail page:

1. **Stage 1 - Realtime Updates**: When AI agent updates an extraction, the page updates in place without reload
2. **Stage 2 - Extracted Fields Table Redesign**: Spreadsheet-style grid with smart accordion rendering for nested data

---

## Stage 1: Realtime Updates

### Problem

Currently the document detail page is a server component that fetches data once. When the AI chat bar corrects an extraction, users must manually refresh to see the updated data.

### Solution

Add a client wrapper component with Supabase realtime subscription. When the extraction updates, React state changes and the table re-renders with new data.

### Architecture

```
page.tsx (server component)
  └── fetches document with extraction (SSR)
  └── fetches signed PDF URL
  └── renders <DocumentDetailClient initialDocument={...} signedUrl={...} />

DocumentDetailClient (client component)
  └── useState(initialDocument)
  └── useExtractionRealtime hook subscribes to changes
  └── on UPDATE: merge new data, track changed fields
  └── renders ExtractedDataTable, PreviewPanel, AiChatBar
```

### New Hook: `useExtractionRealtime`

Location: `frontend/hooks/use-extraction-realtime.ts`

```typescript
interface UseExtractionRealtimeOptions {
  documentId: string
  onUpdate: (extraction: { extracted_fields: Record<string, unknown>, confidence_scores: Record<string, number> }) => void
}

function useExtractionRealtime({ documentId, onUpdate }: UseExtractionRealtimeOptions): {
  status: 'connecting' | 'connected' | 'disconnected'
}
```

Subscribes to:
```typescript
supabase
  .channel(`extraction:${documentId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'extractions',
    filter: `document_id=eq.${documentId}`
  }, callback)
  .subscribe()
```

### Changed Field Highlight

When new data arrives:
1. Compare old `extracted_fields` keys/values with new
2. Add changed keys to `changedFields: Set<string>` state
3. Pass `changedFields` to ExtractedDataTable
4. Rows with changed fields get `bg-primary/10` that fades out over 1.5s
5. Clear `changedFields` after animation

### File Changes

| File | Change |
|------|--------|
| `frontend/app/(app)/documents/[id]/page.tsx` | Extract rendering to DocumentDetailClient, pass initial data |
| `frontend/components/documents/document-detail-client.tsx` | New client component with state + realtime |
| `frontend/hooks/use-extraction-realtime.ts` | New hook for Supabase subscription |
| `frontend/components/documents/extracted-data-table.tsx` | Accept `changedFields` prop for highlight |

---

## Stage 2: Extracted Fields Table Redesign

### Problem

Current table shows "Object >" badges that require clicking to open a modal with raw JSON. Poor UX:
- No preview of nested data
- Requires modal interaction to see anything
- Confidence scores hidden on hover
- No visual hierarchy

### Solution

Spreadsheet-style grid with smart accordion rendering. Familiar Excel-like aesthetic that users trust, with inline expansion for nested data.

### Layout

Three-column grid:

```
┌─────────────────┬────────────────────────┬────────┐
│ Field           │ Value                  │ Conf.  │
├─────────────────┼────────────────────────┼────────┤
│ Document Type   │ cover_letter           │   98%  │
├─────────────────┼────────────────────────┼────────┤
│ ▼ Applicant     │ 7 fields               │   95%  │
│   Name          │ Fraser Brown           │        │
│   Email         │ fraserbrown@live.com   │        │
│   Phone         │ 0402 481 060           │        │
├─────────────────┼────────────────────────┼────────┤
│ ▶ Key Skills    │ 8 items                │   92%  │
└─────────────────┴────────────────────────┴────────┘
```

### Styling

- **shadcn TanStack Table style**: Header row, horizontal dividers only (no cell borders)
- **No vertical borders**: Columns defined by spacing and alignment, not grid lines
- **Typography**: Monospace for values, `tabular-nums` for numbers/percentages
- **Linear-inspired**: Refined minimal with tight but readable spacing
- **Nested rows**: Indented field names, same row styling as parent

### Smart Renderer

Detect data shape and pick appropriate display:

| Shape | Detection | Render As |
|-------|-----------|-----------|
| `primitive` | string, number, boolean, null | Inline value |
| `key-value` | Object with primitive values | Accordion → indented key-value rows |
| `string-array` | Array of strings | Accordion → inline tags with `·` separator |
| `grouped-arrays` | Object where all values are string arrays | Accordion → category labels with inline tags |
| `object-array` | Array of objects | Accordion → mini-table with column headers |

### Confidence Indicators

Always visible, color-coded:

| Range | Color | CSS Class |
|-------|-------|-----------|
| ≥ 90% | Green | `text-emerald-600` |
| 70-89% | Amber | `text-amber-500` |
| < 70% | Red | `text-red-500` |

Right-aligned in Confidence column, small text (11-12px).

### Accordion Behavior

- **Collapsed**: Field name + summary ("7 fields", "8 items") + confidence
- **Expanded**: Nested rows appear below with indentation
- **Chevron**: ▶ collapsed, ▼ expanded in Field column
- **Animation**: Smooth height transition on expand/collapse
- **Nested confidence**: Only parent shows confidence score

### Rendering Examples

**Key-value object (Applicant):**
```
▼ Applicant         7 fields                    95%
   Name             Fraser Brown
   Email            fraserbrown@live.com
   Phone            0402 481 060
   Title            Full-Stack Developer
   GitHub           github.com/thebrownproject
   LinkedIn         linkedin.com/in/fraserbrown-dev
   Location         Melbourne, Australia
```

**Grouped arrays (Technical Skills):**
```
▼ Technical Skills  5 categories                91%
   AI/ML            RAG pipeline · LangChain · FastAPI · OpenAI API · Claude API
   Tools            Jira · Git
   Languages        TypeScript · Python
   Frameworks       Next.js
   Technologies     relational databases · REST APIs · modern frameworks
```

**Array of objects (Line Items):**
```
▼ Line Items        2 items                     94%
   ┌──────────────┬─────┬──────────┬───────────┐
   │ Product      │ Qty │ Price    │ Amount    │
   ├──────────────┼─────┼──────────┼───────────┤
   │ Cloud Hosting│ 1   │ $1200.00 │ $1200.00  │
   │ SLA Support  │ 1   │ $120.00  │ $120.00   │
   └──────────────┴─────┴──────────┴───────────┘
```

### TanStack Table Implementation

Migrate from custom div layout to TanStack Table for consistency with documents list.

**Mirror `documents-table.tsx` patterns:**
- Same shadcn components: `Table`, `TableRow`, `TableCell`, `TableHeader`, `TableHead`
- Same styling: `hover:bg-muted/30`, `text-muted-foreground` for headers, `py-3` cells
- Same code structure: separate columns definition, `useReactTable` hook, `flexRender`
- Add `getExpandedRowModel()` for nested row expansion

**Why**: Consistency makes future updates easier - style changes apply uniformly across tables.

**Additional features:**
- Transform extracted fields into row data with `subRows` for nested content
- Column definitions for Field, Value, Confidence

**Data transformation:**
```typescript
// Transform { applicant: { name: "Fraser", ... }, document_type: "cover_letter" }
// Into rows with optional subRows:
[
  { field: "document_type", value: "cover_letter", confidence: 0.98 },
  {
    field: "applicant",
    value: "7 fields",
    confidence: 0.95,
    subRows: [
      { field: "name", value: "Fraser Brown" },
      { field: "email", value: "fraserbrown@live.com" },
      ...
    ]
  }
]
```

### File Changes

| File | Change |
|------|--------|
| `frontend/components/documents/extracted-data-table.tsx` | Rewrite with TanStack Table + expanding rows |

---

## Implementation Order

### Stage 1: Realtime Updates
1. Create `use-extraction-realtime.ts` hook
2. Create `document-detail-client.tsx` wrapper component
3. Update `page.tsx` to pass initial data to client component
4. Add `changedFields` prop and highlight animation to table

### Stage 2: Table Redesign
5. Implement data shape detection utility
6. Build grid layout with header row
7. Implement primitive value renderer
8. Implement key-value accordion renderer
9. Implement string-array renderer (inline tags)
10. Implement grouped-arrays renderer (category + tags)
11. Implement object-array renderer (mini-table)
12. Add confidence color coding
13. Add expand/collapse animations

---

## Success Criteria

- [ ] AI chat bar correction updates table without page reload
- [ ] Changed fields highlight briefly after update
- [ ] All nested data viewable inline (no modals)
- [ ] Spreadsheet-style grid aesthetic
- [ ] Confidence scores always visible with color coding
- [ ] Smooth accordion animations
