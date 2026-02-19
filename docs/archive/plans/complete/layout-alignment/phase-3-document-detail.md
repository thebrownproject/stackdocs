# Phase 3: Document Detail Page

**Tasks:** 8-12
**Focus:** Checkboxes, indicator column, column resizing, floating chat bar

> **Note:** Throughout Phase 3, the `cn` utility from `@/lib/utils` is used in code snippets. This import already exists in extracted-columns.tsx and extracted-data-table.tsx.

---

## Task 8: Add Checkboxes to Extracted Data Table

**Files:**
- Modify: `frontend/components/documents/extracted-columns.tsx`
- Modify: `frontend/components/documents/extracted-data-table.tsx`

**Step 1: Add row selection state**

In extracted-data-table.tsx:

```tsx
import { RowSelectionState } from '@tanstack/react-table'

const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

const table = useReactTable({
  // ... existing config
  enableRowSelection: true,
  onRowSelectionChange: setRowSelection,
  state: {
    expanded,
    globalFilter: searchFilter,
    rowSelection,
  },
})
```

**Step 2: Add select column to extracted-columns.tsx**

Add Checkbox import to the existing imports:

```tsx
// Add to existing imports at top:
import { Checkbox } from '@/components/ui/checkbox'

export const extractedColumns: ColumnDef<ExtractedFieldRow>[] = [
  {
    id: 'select',
    enableResizing: false,
    size: 40,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="opacity-0 group-hover/header:opacity-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100 transition-opacity"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover/row:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  // ... rest of columns
]
```

**Step 3: Add group classes to table rows**

In extracted-data-table.tsx:

```tsx
<TableRow key={headerGroup.id} className="hover:bg-transparent group/header">

<TableRow
  key={row.id}
  className={cn(
    'hover:bg-muted/30 transition-colors group/row',
    row.getCanExpand() && 'cursor-pointer',
    isChanged && 'animate-highlight-fade'
  )}
>
```

**Step 4: Verify checkboxes appear**

- Checkboxes appear on row hover
- Stay visible when selected
- Header checkbox selects all

**Step 5: Commit**

```bash
git add frontend/components/documents/extracted-columns.tsx frontend/components/documents/extracted-data-table.tsx
git commit -m "feat: add row selection checkboxes to extracted data table"
```

---

## Task 9: Move Chevron/Confidence to Column 2

**Files:**
- Modify: `frontend/components/documents/extracted-columns.tsx`

**Step 1: Create ConfidenceCircle component**

Add this helper component in extracted-columns.tsx (note: `cn` already imported):

```tsx
function ConfidenceCircle({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return null

  const percentage = Math.round(confidence * 100)
  const colorClass =
    percentage >= 90
      ? 'bg-emerald-500'
      : percentage >= 70
        ? 'bg-amber-500'
        : 'bg-red-500'

  return (
    <div className="flex items-center gap-1">
      <div className={cn('size-2 rounded-full', colorClass)} />
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {percentage}%
      </span>
    </div>
  )
}
```

**Step 2: Create combined indicator column**

Add new column after select (note: ChevronRight/ChevronDown already imported from lucide-react):

```tsx
{
  id: 'indicator',
  enableResizing: false,
  size: 50,
  header: () => null,
  cell: ({ row }) => {
    const canExpand = row.getCanExpand()
    const isExpanded = row.getIsExpanded()
    const confidence = row.original.confidence
    const isSelected = row.getIsSelected()

    // Show chevron for expandable rows
    if (canExpand) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
          className="p-0.5 hover:bg-muted rounded"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
        </button>
      )
    }

    // Show confidence for leaf rows (on hover or when selected)
    return (
      <div className={cn(
        'opacity-0 group-hover/row:opacity-100 transition-opacity',
        isSelected && 'opacity-100'
      )}>
        <ConfidenceCircle confidence={confidence} />
      </div>
    )
  },
},
```

**Step 3: Update Field column - remove chevron logic**

```tsx
{
  accessorKey: 'field',
  header: () => <span className="text-muted-foreground">Field</span>,
  enableResizing: true,
  size: 200,
  minSize: 100,
  cell: ({ row }) => {
    const depth = row.original.depth

    return (
      <span
        className={cn(depth === 0 ? 'font-medium' : 'text-muted-foreground')}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {row.original.field}
      </span>
    )
  },
},
```

**Step 4: Remove Conf. column entirely**

Delete the confidence column:

```tsx
// DELETE this entire column:
{
  accessorKey: 'confidence',
  header: () => ( ... ),
  cell: ({ row }) => ( ... ),
  size: 60,
},
```

**Step 5: Add column resizing support**

Update Value column:

```tsx
{
  accessorKey: 'displayValue',
  header: () => <span className="text-muted-foreground">Value</span>,
  enableResizing: true,
  size: 300,
  minSize: 150,
  cell: ({ row }) => {
    // ... existing cell logic
  },
},
```

**Step 6: Verify indicator column works**

- Expandable rows show chevron
- Leaf rows show confidence on hover
- Confidence stays visible when checkbox selected

**Step 7: Commit**

```bash
git add frontend/components/documents/extracted-columns.tsx
git commit -m "feat: move chevron/confidence to indicator column, remove Conf. column"
```

---

## Task 10: Add Column Resizing to Extracted Data Table

**Files:**
- Modify: `frontend/components/documents/extracted-data-table.tsx`

**Step 1: Add column sizing state with persistence**

Add `ColumnSizingState` to existing TanStack Table imports:

```tsx
// Update existing import to include ColumnSizingState:
import {
  ColumnDef,
  ColumnSizingState,  // Add this
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table'

const COLUMN_SIZING_KEY = 'stackdocs-extracted-columns'

const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(COLUMN_SIZING_KEY)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return {}
      }
    }
  }
  return {}
})
```

**Step 2: Configure table for resizing**

```tsx
const table = useReactTable({
  data,
  columns: extractedColumns,
  enableColumnResizing: true,
  columnResizeMode: 'onChange',
  onColumnSizingChange: (updater) => {
    setColumnSizing((old) => {
      const newSizing = typeof updater === 'function' ? updater(old) : updater
      if (typeof window !== 'undefined') {
        localStorage.setItem(COLUMN_SIZING_KEY, JSON.stringify(newSizing))
      }
      return newSizing
    })
  },
  state: {
    expanded,
    globalFilter: searchFilter,
    rowSelection,
    columnSizing,
  },
  // ... rest of config
})
```

**Step 3: Add resize handles to headers**

```tsx
<TableHead
  key={header.id}
  className="h-10 text-sm font-normal text-muted-foreground relative"
  style={{ width: header.column.getSize() }}
>
  {header.isPlaceholder
    ? null
    : flexRender(header.column.columnDef.header, header.getContext())}
  {header.column.getCanResize() && (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className={cn(
        'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none',
        'hover:bg-primary/50',
        header.column.getIsResizing() && 'bg-primary'
      )}
    />
  )}
</TableHead>
```

**Step 4: Apply column widths to cells**

```tsx
<TableCell
  key={cell.id}
  className="py-2.5 whitespace-normal"
  style={{ width: cell.column.getSize() }}
>
```

**Step 5: Verify resizing works**

- Drag Field/Value column edges to resize
- Refresh page - sizes persist

**Step 6: Commit**

```bash
git add frontend/components/documents/extracted-data-table.tsx
git commit -m "feat: add column resizing to extracted data table"
```

---

## Task 11: Implement Floating AI Chat Bar

**Files:**
- Modify: `frontend/components/documents/ai-chat-bar.tsx`
- Modify: `frontend/components/documents/document-detail-client.tsx`

**Step 1: Update chat bar styling to floating design**

In ai-chat-bar.tsx:

```tsx
return (
  <div className="relative px-4 pb-4">
    {/* Activity Panel - floats above input */}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[480px] z-10">
      <AiActivityPanel
        status={status}
        events={events}
        error={error}
        onClose={reset}
      />
    </div>

    {/* Floating Chat Input */}
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        'bg-background border rounded-xl shadow-sm',
        isDisabled && 'opacity-50'
      )}
    >
      <Input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask AI to correct or refine extraction..."
        aria-label="AI chat input"
        disabled={isDisabled}
        className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
      />
      <kbd className="text-[11px] text-muted-foreground/40 font-mono px-1.5 py-0.5 rounded border border-border/50">
        Enter
      </kbd>
    </div>
  </div>
)
```

**Step 2: Update document-detail-client layout**

Move chat bar outside of ResizablePanelGroup (two-layer wrapper pattern):

```tsx
return (
  <div className="flex flex-1 flex-col min-h-0">
    {/* Sub-bar */}
    <SubBar ... />

    {/* Main content - resizable layout */}
    <ResizablePanelGroup
      direction="horizontal"
      className="flex-1 min-h-0"
      onLayout={handleLayoutChange}
    >
      {/* Left: Extracted Data */}
      <ResizablePanel ...>
        <div className="h-full overflow-auto">
          <ExtractedDataTable ... />
        </div>
      </ResizablePanel>

      <ResizableHandle />

      {/* Right: Preview */}
      <ResizablePanel ...>
        <div className="h-full overflow-auto">
          <PreviewPanel ... />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>

    {/* AI Chat Bar - floating at bottom, outside panels */}
    {/* Outer wrapper: Page margins (px-4 pb-4 pt-2) */}
    {/* Inner wrapper (in ai-chat-bar.tsx): Card styling (rounded-xl border shadow-sm) */}
    <div className="shrink-0 px-4 pb-4 pt-2">
      <AiChatBar documentId={document.id} />
    </div>
  </div>
)
```

**Note:** The double-wrapper pattern is intentional:
- Outer `<div>` (document-detail-client.tsx): Adds page margins and spacing from panels
- Inner wrapper (ai-chat-bar.tsx Step 1): Adds floating card styling (rounded corners, border, shadow)

**Step 3: Verify floating chat bar**

- Chat bar has rounded corners and elevation
- Sits below both panels with margins
- Resize handle stops above chat bar

**Step 4: Commit**

```bash
git add frontend/components/documents/ai-chat-bar.tsx frontend/components/documents/document-detail-client.tsx
git commit -m "feat: implement floating AI chat bar design"
```

---

## Task 12: Update Document Detail Header to Icon-Only Preview Toggle

**Files:**
- Modify: `frontend/components/documents/document-header-actions.tsx`
- Modify: `frontend/components/documents/preview-toggle.tsx`

**Step 1: Update preview-toggle to be icon-only**

```tsx
'use client'

import { PanelRight } from 'lucide-react'
import { ActionButton } from '@/components/layout/action-button'
import { usePreviewPanel } from './preview-panel-context'

export function PreviewToggle() {
  const { isCollapsed, toggle } = usePreviewPanel()

  return (
    <ActionButton
      onClick={toggle}
      aria-label={isCollapsed ? 'Show preview' : 'Hide preview'}
      aria-pressed={!isCollapsed}
      className={!isCollapsed ? 'bg-accent text-accent-foreground' : undefined}
    >
      <PanelRight className="size-4" />
    </ActionButton>
  )
}
```

**Note:** The current ActionButton component has an optional `icon` prop and requires `children`. This code passes the icon as `children`, which works but may have different spacing than intended. If you want a true icon-only button, consider:
1. Making ActionButton's `children` prop optional, OR
2. Creating a dedicated `IconButton` component for icon-only actions

**Step 2: Verify icon-only toggle**

- Preview button shows only icon, no text
- Toggles preview panel correctly

**Step 3: Commit**

```bash
git add frontend/components/documents/preview-toggle.tsx frontend/components/documents/document-header-actions.tsx
git commit -m "refactor: update preview toggle to icon-only"
```
