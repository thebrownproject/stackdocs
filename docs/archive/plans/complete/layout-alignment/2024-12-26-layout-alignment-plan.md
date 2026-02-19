# Layout Alignment System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a Linear-inspired 3-column alignment system across documents pages with column resizing, preview panel, and floating chat bar.

**Architecture:** All pages follow a consistent 3-column grid (checkbox | icon | content). Tables use TanStack Table's column resizing with localStorage persistence. The preview panel uses shadcn's ResizablePanelGroup. The AI chat bar becomes a floating component with rounded corners and elevation.

**Tech Stack:** TanStack Table (column resizing), shadcn/ui (resizable, table, checkbox), localStorage (persistence), Tailwind CSS

---

## Phase 1: Global Foundation

### Task 1: Add Icons to Breadcrumb Component

**Files:**
- Modify: `frontend/components/layout/page-header.tsx`

**Step 1: Add icon mapping to PageHeader**

Add a `segmentIcons` mapping alongside the existing `segmentLabels`:

```tsx
import { FileText, Layers, Settings, Upload } from 'lucide-react'

// Map route segments to display labels
const segmentLabels: Record<string, string> = {
  documents: 'Documents',
  stacks: 'Stacks',
  settings: 'Settings',
  upload: 'Upload',
}

// Map route segments to icons
const segmentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  documents: FileText,
  stacks: Layers,
  settings: Settings,
  upload: Upload,
}
```

**Step 2: Update BreadcrumbItem to render icons**

In the breadcrumbs map, render the icon before the label:

```tsx
{breadcrumbs.map((item, index) => {
  const Icon = segmentIcons[item.segment]

  return (
    <Fragment key={item.href}>
      {index > 0 && <BreadcrumbSeparator />}
      <BreadcrumbItem>
        {item.isLast ? (
          <BreadcrumbPage className="flex items-center gap-1.5">
            {Icon && <Icon className="size-4" />}
            {item.label}
          </BreadcrumbPage>
        ) : (
          <BreadcrumbLink asChild>
            <Link href={item.href} className="flex items-center gap-1.5">
              {Icon && <Icon className="size-4" />}
              {item.label}
            </Link>
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
    </Fragment>
  )
})}
```

**Step 3: Verify breadcrumb displays icon**

Run: `npm run dev`
Navigate to `/documents` - should see FileText icon next to "Documents"

**Step 4: Commit**

```bash
git add frontend/components/layout/page-header.tsx
git commit -m "feat: add icons to breadcrumb navigation"
```

---

### Task 2: Support Dynamic Icons for Document Detail Breadcrumb

**Files:**
- Modify: `frontend/components/layout/page-header.tsx`
- Modify: `frontend/app/(app)/@header/documents/[id]/page.tsx`

**Step 1: Add icon prop to PageHeader**

```tsx
interface PageHeaderProps {
  /** Override the last breadcrumb label */
  title?: string
  /** Icon component for the last breadcrumb (e.g., file type icon) */
  icon?: React.ReactNode
  /** Action buttons to render on the right side */
  actions?: ReactNode
}
```

**Step 2: Use icon prop in last breadcrumb**

Update the last breadcrumb rendering to support custom icon prop:

```tsx
{item.isLast ? (
  <BreadcrumbPage className="flex items-center gap-1.5">
    {icon || (Icon && <Icon className="size-4" />)}
    {item.label}
  </BreadcrumbPage>
) : (
  <BreadcrumbLink asChild>
    <Link href={item.href} className="flex items-center gap-1.5">
      {Icon && <Icon className="size-4" />}
      {item.label}
    </Link>
  </BreadcrumbLink>
)}
```

**Step 3: Pass file type icon from document detail header**

In `frontend/app/(app)/@header/documents/[id]/page.tsx`, add FileTypeIcon import and pass as icon prop:

```tsx
// Add this import to the existing imports
import { FileTypeIcon } from '@/components/file-type-icon'

// Existing imports to preserve:
// import { notFound } from 'next/navigation'
// import { getDocumentWithExtraction } from '@/lib/queries/documents'
// import { PageHeader } from '@/components/layout/page-header'
// import { DocumentHeaderActions } from '@/components/documents/document-header-actions'

export default async function DocumentHeaderSlot({ params }: Props) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  if (!document) {
    notFound()
  }

  return (
    <PageHeader
      title={document.filename}
      icon={<FileTypeIcon mimeType={document.mime_type} />}
      actions={<DocumentHeaderActions />}
    />
  )
}
```

**Step 4: Verify document detail shows file icon**

Navigate to `/documents/[id]` - breadcrumb should show: `[FileText] Documents > [PDF icon] filename.pdf`

**Step 5: Commit**

```bash
git add frontend/components/layout/page-header.tsx frontend/app/(app)/@header/documents/[id]/page.tsx
git commit -m "feat: add file type icon to document detail breadcrumb"
```

---

## Phase 2: Documents List Page

> **Note:** Throughout Phase 2, the `cn` utility from `@/lib/utils` is used in code snippets. This import already exists in the files being modified.

### Task 3: Remove Size Column and Pagination Footer

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

### Task 4: Implement Column Resizing with localStorage

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

### Task 5: Align Columns and Tighten Spacing

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

### Task 6: Implement Row Click for Preview vs Filename Click for Navigate

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

### Task 7: Add Preview Panel to Documents List

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

---

## Phase 3: Document Detail Page

> **Note:** Throughout Phase 3, the `cn` utility from `@/lib/utils` is used in code snippets. This import already exists in extracted-columns.tsx and extracted-data-table.tsx.

### Task 8: Add Checkboxes to Extracted Data Table

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

### Task 9: Move Chevron/Confidence to Column 2

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

### Task 10: Add Column Resizing to Extracted Data Table

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

### Task 11: Implement Floating AI Chat Bar

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

### Task 12: Update Document Detail Header to Icon-Only Preview Toggle

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

---

## Phase 4: Polish & Testing

### Task 13: Update Loading Skeletons

**Files:**
- Modify: `frontend/app/(app)/@header/documents/[id]/loading.tsx`

**Step 1: Update header skeleton to include icon placeholder**

```tsx
export default function HeaderLoading() {
  return (
    <div
      className="flex items-center justify-between shrink-0 w-full"
      role="status"
      aria-label="Loading document header"
    >
      {/* Breadcrumb skeleton with icons */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-20" />
        <span className="text-muted-foreground/30">/</span>
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      {/* Actions skeleton - icon only */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7" />
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/app/(app)/@header/documents/[id]/loading.tsx
git commit -m "fix: update loading skeletons for new layout"
```

---

### Task 14: Manual Testing Checklist

**Run through these tests manually:**

**Documents List Page:**
- [ ] Breadcrumb shows Documents with FileText icon
- [ ] Sub-bar Filter icon aligns with breadcrumb icon
- [ ] Table checkbox aligns with sidebar toggle
- [ ] Table file icon aligns with Filter icon
- [ ] "Name" header aligns with filename text
- [ ] No Size column visible
- [ ] No pagination footer visible
- [ ] Column resize drag handles appear on hover
- [ ] Column widths persist after refresh
- [ ] Row click highlights row (preview shows)
- [ ] Filename click navigates to detail
- [ ] Filename shows underline on hover
- [ ] Preview toggle is icon-only
- [ ] Preview panel shows/hides correctly

**Document Detail Page:**
- [ ] Breadcrumb: Documents icon > file type icon + filename
- [ ] Checkboxes appear in extracted data table on hover
- [ ] Chevron shows for expandable rows
- [ ] Confidence circle shows for leaf rows on hover
- [ ] Confidence stays visible when row selected
- [ ] No separate Conf. column
- [ ] Column resize works for Field/Value
- [ ] Column widths persist after refresh
- [ ] Chat bar is floating with rounded corners
- [ ] Chat bar has margins from edges
- [ ] Resize handle stops above chat bar
- [ ] Preview toggle is icon-only

**Step 1: Complete testing**

Run through each item and verify

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete layout alignment system implementation"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-2 | Global foundation: breadcrumb icons |
| 2 | 3-7 | Documents list: columns, resizing, preview |
| 3 | 8-12 | Document detail: checkboxes, indicators, floating chat |
| 4 | 13-14 | Polish and testing |

**Total Tasks:** 14

**localStorage Keys:**
- `stackdocs-doc-list-columns` - Documents list column widths
- `stackdocs-doc-list-layout` - Documents list panel sizes
- `stackdocs-document-layout` - Document detail panel sizes (existing)
- `stackdocs-extracted-columns` - Extracted data column widths
