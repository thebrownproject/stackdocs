# Phase 2: Documents List Page

**Tasks:** 3-7
**Focus:** Column layout, resizing, row interactions, preview panel

> **Note:** Throughout Phase 2, the `cn` utility from `@/lib/utils` is used in code snippets. This import already exists in the files being modified.

---

## Task 3: Remove Size Column and Pagination Footer

**Files:**
- Modify: `frontend/components/documents/columns.tsx`
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Remove size column from columns.tsx**

Delete the entire `file_size_bytes` column definition (lines ~103-119):

```tsx
// DELETE this entire column:
{
  accessorKey: 'file_size_bytes',
  header: ({ column }) => ( ... ),
  cell: ({ row }) => ( ... ),
},
```

**Step 2: Remove pagination footer from documents-table.tsx**

Delete the pagination div (lines ~143-166):

```tsx
// DELETE this entire block:
{/* Pagination */}
<div className="flex items-center justify-end space-x-2 py-4">
  ...
</div>
```

**Step 3: Verify table renders without size column and pagination**

Run: `npm run dev`
Navigate to `/documents` - table should show: Checkbox | Name | Stacks | Date (no Size, no pagination)

**Step 4: Commit**

```bash
git add frontend/components/documents/columns.tsx frontend/components/documents/documents-table.tsx
git commit -m "refactor: remove size column and pagination from documents table"
```

---

## Task 4: Implement Column Resizing with localStorage

**Files:**
- Modify: `frontend/components/documents/columns.tsx`
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Add column sizing configuration to columns**

Update columns.tsx to add size constraints:

```tsx
// Select column - fixed, no resize
{
  id: 'select',
  enableResizing: false,
  size: 40,
  // ... rest of config
},

// Filename column - resizable
{
  accessorKey: 'filename',
  enableResizing: true,
  size: 300,
  minSize: 150,
  // ... rest of config
},

// Stacks column - resizable
{
  accessorKey: 'stacks',
  enableResizing: true,
  size: 150,
  minSize: 100,
  // ... rest of config
},

// Date column - fixed, pushed right
{
  accessorKey: 'uploaded_at',
  enableResizing: false,
  size: 100,
  // ... rest of config
},
```

**Step 2: Add column resizing state to documents-table.tsx**

Add `ColumnSizingState` to the existing TanStack Table imports (don't create a separate import):

```tsx
// Update the existing import at the top of the file:
import {
  ColumnFiltersState,
  ColumnSizingState,  // Add this
  SortingState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

const COLUMN_SIZING_KEY = 'stackdocs-doc-list-columns'

// Inside component:
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

**Step 3: Configure table for column resizing**

```tsx
const table = useReactTable({
  data: documents,
  columns,
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
  // ... existing options
  state: {
    sorting,
    columnFilters,
    rowSelection,
    columnSizing,
  },
})
```

**Step 4: Add resize handle to table headers**

Update TableHead rendering (note: `cn` utility already imported):

```tsx
<TableHead
  key={header.id}
  className="h-10 text-sm font-normal text-muted-foreground relative"
  style={{ width: header.getSize() }}
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

**Step 5: Apply column width to cells**

```tsx
<TableCell
  key={cell.id}
  className="py-3"
  style={{ width: cell.column.getSize() }}
>
```

**Step 6: Verify column resizing works and persists**

1. Drag a column header edge to resize
2. Refresh the page - sizes should persist

**Step 7: Commit**

```bash
git add frontend/components/documents/columns.tsx frontend/components/documents/documents-table.tsx
git commit -m "feat: add column resizing with localStorage persistence"
```

---

## Task 5: Align Columns and Tighten Spacing

**Files:**
- Modify: `frontend/components/documents/columns.tsx`
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Remove extra padding from checkbox column**

In columns.tsx, update select column cell:

```tsx
{
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={...}
      onCheckedChange={...}
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
  // ...
},
```

**Step 2: Verify filename column header alignment**

The "Name" header should align with filename text, not the icon. The current code already has this (`className="-ml-4 group"`), so this step is verifying existing behavior:

```tsx
{
  accessorKey: 'filename',
  header: ({ column }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="-ml-4 group"  // This negative margin aligns "Name" with text
    >
      Name
      <SortIcon isSorted={column.getIsSorted()} />
    </Button>
  ),
  cell: ({ row }) => {
    const doc = row.original
    return (
      <div className="flex items-center gap-2">
        <FileTypeIcon mimeType={doc.mime_type} className="shrink-0" />
        <span className="font-medium">{doc.filename}</span>
      </div>
    )
  },
},
```

**Note:** No changes needed to this column - the alignment is already correct.

**Step 3: Verify alignment**

- Checkbox should align with sidebar toggle above
- Icon should align with Filter icon in sub-bar
- "Name" header text should align with filename text (not icon)

**Step 4: Commit**

```bash
git add frontend/components/documents/columns.tsx frontend/components/documents/documents-table.tsx
git commit -m "fix: align columns and tighten checkbox-to-icon spacing"
```

---

## Task 6: Implement Row Click for Preview vs Filename Click for Navigate

**Files:**
- Modify: `frontend/components/documents/columns.tsx`
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Add selected document state**

In documents-table.tsx:

```tsx
const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null)
```

**Step 2: Update filename cell to be clickable link**

In columns.tsx, add Link to the existing imports at the top of the file:

```tsx
// Add to existing imports at top:
import Link from 'next/link'

// Then update the filename cell:
cell: ({ row }) => {
  const doc = row.original
  return (
    <div className="flex items-center gap-2">
      <FileTypeIcon mimeType={doc.mime_type} className="shrink-0" />
      <Link
        href={`/documents/${doc.id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium hover:underline"
      >
        {doc.filename}
      </Link>
    </div>
  )
},
```

**Step 3: Clear selection when preview closes**

Add logic to clear selectedDocId when preview panel is collapsed:

```tsx
// Import the preview panel context
import { usePreviewPanel } from './preview-panel-context'

// Inside component, get preview state:
const { isCollapsed } = usePreviewPanel()

// Clear selection when preview closes
React.useEffect(() => {
  if (isCollapsed) {
    setSelectedDocId(null)
  }
}, [isCollapsed])
```

**Step 4: Update row click behavior**

In documents-table.tsx, change row onClick:

```tsx
<TableRow
  key={row.id}
  className={cn(
    'hover:bg-muted/30 transition-colors duration-150 group/row',
    selectedDocId === row.original.id && 'bg-muted/50'
  )}
  data-state={row.getIsSelected() && 'selected'}
  onClick={() => setSelectedDocId(row.original.id)}
>
```

**Step 5: Remove cursor-pointer from row, keep on checkbox**

Update row className to not have cursor-pointer:

```tsx
className={cn(
  'hover:bg-muted/30 transition-colors duration-150 group/row',
  selectedDocId === row.original.id && 'bg-muted/50'
)}
```

**Step 6: Verify interactions**

- Click row anywhere except filename → row highlights (preview will show)
- Click filename → navigates to detail page
- Filename shows underline on hover
- Close preview → row highlight clears

**Step 7: Commit**

```bash
git add frontend/components/documents/columns.tsx frontend/components/documents/documents-table.tsx
git commit -m "feat: separate row click (preview) from filename click (navigate)"
```

---

## Task 7: Add Preview Panel to Documents List

**Files:**
- Modify: `frontend/components/documents/documents-table.tsx`
- Modify: `frontend/components/documents/documents-list.tsx`
- Modify: `frontend/app/(app)/@header/documents/page.tsx`

**Step 1: Add preview state and fetch logic**

In documents-table.tsx:

```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { PreviewPanel } from './preview-panel'
import { usePreviewPanel } from './preview-panel-context'

const LAYOUT_STORAGE_KEY = 'stackdocs-doc-list-layout'

// Inside component, get preview panel ref and state:
const { panelRef, setIsCollapsed } = usePreviewPanel()

// Selected document state is already added in Task 6
// const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null)

// Find selected document from the documents array
const selectedDoc = React.useMemo(() => {
  if (!selectedDocId) return null
  return documents.find(d => d.id === selectedDocId) ?? null
}, [selectedDocId, documents])

// TODO: Fetch signed URL and OCR text for preview when selectedDocId changes
// This will be implemented during Task 7 or as a follow-up task
// For now, preview will show "PDF preview not available" message

// Add layout persistence:
const [defaultLayout] = React.useState(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved) as number[]
      } catch {
        return [70, 30]
      }
    }
  }
  return [70, 30]
})

const handleLayoutChange = React.useCallback((sizes: number[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(sizes))
  }
}, [])
```

**Step 2: Wrap table in ResizablePanelGroup**

```tsx
return (
  <div className="flex flex-1 flex-col min-h-0">
    <SubBar ... />

    <ResizablePanelGroup
      direction="horizontal"
      className="flex-1 min-h-0"
      onLayout={handleLayoutChange}
    >
      <ResizablePanel defaultSize={defaultLayout[0]} minSize={40}>
        <div className="h-full overflow-auto">
          <Table>...</Table>
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel
        ref={panelRef}
        defaultSize={defaultLayout[1]}
        minSize={25}
        maxSize={50}
        collapsible
        collapsedSize={0}
        onCollapse={() => setIsCollapsed(true)}
        onExpand={() => setIsCollapsed(false)}
      >
        <div className="h-full overflow-auto">
          <PreviewPanel
            pdfUrl={selectedDoc ? `${selectedDoc.file_path}` : null}
            ocrText={null}
            mimeType={selectedDoc?.mime_type ?? ''}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
)
```

**Note:** The `ref`, `onCollapse`, and `onExpand` props are needed to sync the panel state with the preview context. This allows the preview toggle button to programmatically collapse/expand the panel.

**Step 3: Add preview toggle to header**

In `frontend/app/(app)/@header/documents/page.tsx`:

```tsx
import { PageHeader } from '@/components/layout/page-header'
import { PreviewToggle } from '@/components/documents/preview-toggle'

export default function DocumentsHeaderSlot() {
  return <PageHeader actions={<PreviewToggle />} />
}
```

**Step 4: Update PreviewToggle to be icon-only**

In preview-toggle.tsx, update to icon-only (remove "Preview" text):

```tsx
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

**Note:** The ActionButton component currently requires `children` prop. This implementation passes the icon as a child, which works but shows the icon with text spacing. If you want a true icon-only button, you may need to update ActionButton to make `children` optional or create a separate `IconButton` component.

**Step 5: Verify preview panel works**

- Click a row → preview panel shows document
- Toggle preview button hides/shows panel
- Panel sizes persist

**Step 6: Commit**

```bash
git add frontend/components/documents/documents-table.tsx frontend/components/documents/documents-list.tsx frontend/app/(app)/@header/documents/page.tsx frontend/components/documents/preview-toggle.tsx
git commit -m "feat: add preview panel to documents list page"
```
