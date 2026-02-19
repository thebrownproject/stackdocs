# Sub-bar Toolbar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Updated:** 2024-12-24 (brainstorm session - use shadcn components, sub-bar in page content)

**Goal:** Add Linear-style sub-bar toolbar to documents list and document detail pages with search, filter placeholder, row selection, and relocated actions.

**Architecture:** Create reusable sub-bar component that renders **in page content** (inside DocumentsTable/DocumentDetailClient). Documents list gets row selection with bulk actions. Document detail gets relocated Stacks/Edit/Export. Both get search input and filter placeholder. Fix table scroll issues.

**Tech Stack:** React 19, Next.js 16, shadcn/ui (input-group, dropdown-menu, checkbox, button), TanStack Table (row selection), Tailwind CSS

---

## Phase 1: Foundation Components

### Task 1: Install shadcn InputGroup

**Step 1: Install the InputGroup component from shadcn**

Run:
```bash
cd /Users/fraserbrown/stackdocs/frontend && npx shadcn@latest add input-group
```

**Step 2: Verify installation**

Check that `frontend/components/ui/input-group.tsx` was created.

**Step 3: Commit**

```bash
git add frontend/components/ui/input-group.tsx
git commit -m "feat(ui): add shadcn input-group component"
```

---

### Task 2: Create Filter Button Component

**Files:**
- Create: `frontend/components/documents/filter-button.tsx`

**Step 1: Create the filter button placeholder component**

Uses shadcn Button + DropdownMenu. Located in `components/documents/` (not `ui/`).

```tsx
'use client'

import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface FilterButtonProps {
  className?: string
}

export function FilterButton({ className }: FilterButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          <Filter className="mr-1.5 size-4" />
          Filter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem disabled>
          <span className="text-muted-foreground">Coming soon</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/documents/filter-button.tsx
git commit -m "feat(documents): add filter button placeholder component"
```

---

### Task 3: Create Sub-bar Container Component

**Files:**
- Create: `frontend/components/documents/sub-bar.tsx`

**Step 1: Create the sub-bar container component**

```tsx
import { cn } from '@/lib/utils'

interface SubBarProps {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}

export function SubBar({ left, right, className }: SubBarProps) {
  return (
    <div
      className={cn(
        'flex h-12 shrink-0 items-center justify-between gap-4 border-b px-4',
        className
      )}
    >
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/documents/sub-bar.tsx
git commit -m "feat(documents): add sub-bar container component"
```

---

## Phase 2: Documents List - Row Selection & Sub-bar

### Task 4: Add Selection Column to Documents Table

**Files:**
- Modify: `frontend/components/documents/columns.tsx`

**Step 1: Add select column with hover-visible checkbox**

Add this import at the top:
```tsx
import { Checkbox } from '@/components/ui/checkbox'
```

Add this column at the beginning of the columns array (before the filename column):
```tsx
{
  id: 'select',
  header: ({ table }) => (
    <div className="px-1">
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="opacity-0 group-hover/header:opacity-100 data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100 transition-opacity"
      />
    </div>
  ),
  cell: ({ row }) => (
    <div className="px-1">
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover/row:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
      />
    </div>
  ),
  enableSorting: false,
  enableHiding: false,
},
```

**Step 2: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/documents/columns.tsx
git commit -m "feat(documents): add selection column with hover-visible checkboxes"
```

---

### Task 5: Add Row Selection State to Documents Table

**Files:**
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Import RowSelectionState and update table configuration**

Add to imports:
```tsx
import {
  ColumnFiltersState,
  SortingState,
  RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
```

**Step 2: Add row selection state**

Add after the columnFilters state:
```tsx
const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
```

**Step 3: Update useReactTable config**

Update the state object and add handlers:
```tsx
const table = useReactTable({
  data: documents,
  columns,
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onRowSelectionChange: setRowSelection,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  enableRowSelection: true,
  state: {
    sorting,
    columnFilters,
    rowSelection,
  },
})
```

**Step 4: Add group classes to header and rows for hover visibility**

Update TableHeader row:
```tsx
<TableRow key={headerGroup.id} className="hover:bg-transparent group/header">
```

Update TableBody row:
```tsx
<TableRow
  key={row.id}
  className="cursor-pointer hover:bg-muted/30 transition-colors duration-150 group/row"
  data-state={row.getIsSelected() && 'selected'}
  onClick={() => router.push(`/documents/${row.original.id}`)}
>
```

**Step 5: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/components/documents/documents-table.tsx
git commit -m "feat(documents): add row selection state to documents table"
```

---

### Task 6: Create Selection Actions Component

**Files:**
- Create: `frontend/components/documents/selection-actions.tsx`

**Step 1: Create the selection actions component**

```tsx
'use client'

import { Trash2, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SelectionActionsProps {
  selectedCount: number
  onDelete?: () => void
  onAddToStack?: () => void
}

export function SelectionActions({
  selectedCount,
  onDelete,
  onAddToStack,
}: SelectionActionsProps) {
  if (selectedCount === 0) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {selectedCount} selected
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onAddToStack} disabled>
            <FolderPlus className="mr-2 size-4" />
            Add to Stack
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            disabled
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/documents/selection-actions.tsx
git commit -m "feat(documents): add selection actions component"
```

---

### Task 7: Integrate Sub-bar into Documents Table

**Files:**
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Add imports for sub-bar components**

```tsx
import { Search } from 'lucide-react'
import { SubBar } from './sub-bar'
import { FilterButton } from './filter-button'
import { SelectionActions } from './selection-actions'
import { UploadDialogTrigger } from './upload-dialog'
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from '@/components/ui/input-group'
```

**Step 2: Replace existing filter div with sub-bar**

Remove the existing filter div (lines ~56-68) and replace with:

```tsx
{/* Sub-bar */}
<SubBar
  left={
    <>
      <FilterButton />
      <InputGroup className="w-64">
        <InputGroupInput
          placeholder="Search documents..."
          value={(table.getColumn('filename')?.getFilterValue() as string) ?? ''}
          onChange={(e) => table.getColumn('filename')?.setFilterValue(e.target.value)}
        />
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
      </InputGroup>
    </>
  }
  right={
    <>
      <SelectionActions
        selectedCount={table.getFilteredSelectedRowModel().rows.length}
      />
      <UploadDialogTrigger variant="subbar" />
    </>
  }
/>
```

**Step 3: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/components/documents/documents-table.tsx
git commit -m "feat(documents): integrate sub-bar into documents table"
```

---

### Task 8: Add Subbar Variant to Upload Dialog Trigger

**Files:**
- Modify: `frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx`

**Step 1: Add 'subbar' variant option**

Update the interface and component to support a 'subbar' variant:

```tsx
interface UploadDialogTriggerProps {
  variant?: 'header' | 'subbar'
}

export function UploadDialogTrigger({ variant = 'header' }: UploadDialogTriggerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      {variant === 'header' ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-7 px-2 text-xs">
          <Upload className="mr-1.5 size-3.5" />
          Upload
        </Button>
      ) : (
        <Button variant="default" size="sm" onClick={() => setOpen(true)}>
          <Upload className="mr-1.5 size-4" />
          Upload
        </Button>
      )}
      <UploadDialogContent open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx
git commit -m "feat(upload-dialog): add subbar variant to trigger button"
```

---

### Task 9: Remove Upload from Documents Header

**Files:**
- Modify: `frontend/app/(app)/@header/documents/page.tsx`

**Step 1: Remove UploadDialogTrigger from header**

Update the file to remove the actions prop:

```tsx
import { PageHeader } from '@/components/layout/page-header'

/**
 * Header slot for documents list page.
 * Shows breadcrumb only - actions moved to sub-bar.
 */
export default function DocumentsHeaderSlot() {
  return <PageHeader />
}
```

**Step 2: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/app/(app)/@header/documents/page.tsx
git commit -m "refactor(header): remove upload from documents header (moved to sub-bar)"
```

---

## Phase 3: Document Detail - Sub-bar & Header Cleanup

### Task 10: Create Document Detail Sub-bar Actions

**Files:**
- Create: `frontend/components/documents/document-detail-actions.tsx`

**Step 1: Create the document detail actions component**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { StacksDropdown } from '@/components/documents/stacks-dropdown'
import { Edit, Download } from 'lucide-react'

interface DocumentDetailActionsProps {
  assignedStacks: Array<{ id: string; name: string }>
}

export function DocumentDetailActions({ assignedStacks }: DocumentDetailActionsProps) {
  return (
    <>
      <StacksDropdown assignedStacks={assignedStacks} />
      <Button variant="ghost" size="sm" disabled className="h-8">
        <Edit className="mr-1.5 size-4" />
        Edit
      </Button>
      <Button variant="ghost" size="sm" disabled className="h-8">
        <Download className="mr-1.5 size-4" />
        Export
      </Button>
    </>
  )
}
```

**Step 2: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/documents/document-detail-actions.tsx
git commit -m "feat(documents): add document detail actions component for sub-bar"
```

---

### Task 11: Update Document Header Actions (Preview Only)

**Files:**
- Modify: `frontend/components/documents/document-header-actions.tsx`

**Step 1: Keep only PreviewToggle in header actions**

```tsx
'use client'

import { PreviewToggle } from './preview-toggle'

export function DocumentHeaderActions() {
  return <PreviewToggle />
}
```

**Step 2: Update the header slot to not pass assignedStacks**

Since we no longer need stacks in the header, update `@header/documents/[id]/page.tsx`:

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
 * Renders PageHeader with document title and preview toggle only.
 * Stacks/Edit/Export moved to sub-bar in page content.
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
      actions={<DocumentHeaderActions />}
    />
  )
}
```

**Step 3: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/components/documents/document-header-actions.tsx frontend/app/(app)/@header/documents/[id]/page.tsx
git commit -m "refactor(header): move stacks/edit/export to sub-bar, keep preview toggle in header"
```

---

### Task 12: Add Sub-bar to Document Detail Client

**Files:**
- Modify: `frontend/components/documents/document-detail-client.tsx`

**Step 1: Add imports**

```tsx
import { Search } from 'lucide-react'
import { SubBar } from './sub-bar'
import { FilterButton } from './filter-button'
import { DocumentDetailActions } from './document-detail-actions'
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from '@/components/ui/input-group'
```

**Step 2: Add search state and filter function**

Add after the changedFields state:
```tsx
const [fieldSearch, setFieldSearch] = React.useState('')
```

**Step 3: Update props interface to receive stacks**

```tsx
interface DocumentDetailClientProps {
  initialDocument: DocumentWithExtraction
  signedUrl: string | null
}
```

Note: The document already contains stacks info via `initialDocument.stacks`.

**Step 4: Add sub-bar before ResizablePanelGroup**

Insert this after the opening `<div className="flex flex-1 flex-col min-h-0">`:

```tsx
{/* Sub-bar */}
<SubBar
  left={
    <>
      <FilterButton />
      <InputGroup className="w-64">
        <InputGroupInput
          placeholder="Search fields..."
          value={fieldSearch}
          onChange={(e) => setFieldSearch(e.target.value)}
        />
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
      </InputGroup>
    </>
  }
  right={
    <DocumentDetailActions assignedStacks={document.stacks ?? []} />
  }
/>
```

**Step 5: Pass fieldSearch to ExtractedDataTable**

Update the ExtractedDataTable component call:
```tsx
<ExtractedDataTable
  fields={document.extracted_fields}
  confidenceScores={document.confidence_scores}
  changedFields={changedFields}
  searchFilter={fieldSearch}
/>
```

**Step 6: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: Errors about searchFilter prop (we'll add it in next task)

**Step 7: Commit**

```bash
git add frontend/components/documents/document-detail-client.tsx
git commit -m "feat(documents): add sub-bar to document detail page"
```

---

### Task 13: Add Search Filter to Extracted Data Table

**Files:**
- Modify: `frontend/components/documents/extracted-data-table.tsx`

**Step 1: Add searchFilter prop**

Update the interface:
```tsx
interface ExtractedDataTableProps {
  fields: Record<string, unknown> | null
  confidenceScores: Record<string, number> | null
  changedFields?: Set<string>
  searchFilter?: string
}
```

**Step 2: Add searchFilter to component params**

```tsx
export function ExtractedDataTable({
  fields,
  confidenceScores,
  changedFields = new Set(),
  searchFilter = '',
}: ExtractedDataTableProps) {
```

**Step 3: Add global filter state to table**

Update the table config:
```tsx
const table = useReactTable({
  data,
  columns: extractedColumns,
  state: {
    expanded,
    globalFilter: searchFilter,
  },
  onExpandedChange: setExpanded,
  getSubRows: (row) => row.subRows,
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  globalFilterFn: (row, _columnId, filterValue) => {
    const fieldName = row.original.field?.toLowerCase() || ''
    return fieldName.includes(filterValue.toLowerCase())
  },
})
```

Add getFilteredRowModel import:
```tsx
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  useReactTable,
  ExpandedState,
} from '@tanstack/react-table'
```

**Step 4: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/components/documents/extracted-data-table.tsx
git commit -m "feat(documents): add field search filter to extracted data table"
```

---

## Phase 4: Bug Fixes & Polish

### Task 14: Fix Table Scroll Issue

**Files:**
- Modify: `frontend/components/documents/extracted-data-table.tsx`
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Fix extracted-data-table scroll**

Wrap the Table in a scrollable container:
```tsx
return (
  <div className="h-full overflow-auto">
    <Table>
      {/* ... existing table content ... */}
    </Table>
  </div>
)
```

**Step 2: Fix documents-table scroll**

Update the table wrapper div:
```tsx
<div className="flex-1 overflow-auto">
  <Table>
    {/* ... existing table content ... */}
  </Table>
</div>
```

**Step 3: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/components/documents/extracted-data-table.tsx frontend/components/documents/documents-table.tsx
git commit -m "fix(documents): add overflow-auto to table containers for scrolling"
```

---

### Task 15: Update Documents List Wrapper for Full Height

**Files:**
- Modify: `frontend/components/documents/documents-list.tsx`
- Modify: `frontend/components/documents/documents-table.tsx`

**Step 1: Update documents-list.tsx**

```tsx
'use client'

import { DocumentsTable } from './documents-table'
import type { Document } from '@/types/documents'

interface DocumentsListProps {
  documents: Document[]
}

export function DocumentsList({ documents }: DocumentsListProps) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <DocumentsTable documents={documents} />
    </div>
  )
}
```

**Step 2: Update documents-table outer structure**

The component should return a flex column layout:
```tsx
return (
  <div className="flex flex-1 flex-col min-h-0">
    {/* Sub-bar */}
    <SubBar ... />

    {/* Table - scrollable */}
    <div className="flex-1 overflow-auto">
      <Table>
        {/* ... */}
      </Table>
    </div>

    {/* Pagination - fixed at bottom */}
    <div className="flex items-center justify-end space-x-2 py-4 px-4 border-t">
      {/* ... pagination content ... */}
    </div>
  </div>
)
```

**Step 3: Verify component compiles**

Run: `cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/components/documents/documents-list.tsx frontend/components/documents/documents-table.tsx
git commit -m "fix(documents): update layout for proper flex height and scrolling"
```

---

### Task 16: Update Skeletons for New Layout

**Files:**
- Create or modify skeleton components as needed

**Step 1: Identify existing skeleton usage**

Check if there are existing skeleton loaders in the documents components. If not, this task can be skipped or deferred.

Run: `grep -r "Skeleton" frontend/components/documents/`

**Step 2: If skeletons exist, update them**

Add sub-bar skeleton row matching the h-12 height with skeleton elements for filter, search, and actions.

**Step 3: Commit (if changes made)**

```bash
git add frontend/components/documents/
git commit -m "feat(documents): update skeleton loaders for sub-bar layout"
```

---

## Phase 5: Final Testing & Cleanup

### Task 17: Manual Testing Checklist

**Step 1: Test Documents List Page**

- [ ] Sub-bar displays with Filter button and collapsed search pill
- [ ] Search pill expands on click, filters documents by name
- [ ] Search collapses when empty and clicked outside
- [ ] Checkboxes appear on row hover
- [ ] Selecting rows shows "X selected" and Actions dropdown
- [ ] Actions dropdown shows disabled Delete and Add to Stack
- [ ] Upload button works in sub-bar
- [ ] Table scrolls properly with many documents
- [ ] Pagination still works

**Step 2: Test Document Detail Page**

- [ ] Sub-bar displays with Filter button and collapsed search pill
- [ ] Search pill expands and filters extracted fields by name
- [ ] Stacks dropdown appears in sub-bar
- [ ] Edit and Export buttons appear in sub-bar (disabled)
- [ ] Preview toggle remains in main header
- [ ] Preview panel toggle still works
- [ ] Table scrolls properly with many fields
- [ ] AI chat bar still works

**Step 3: Final commit**

If all tests pass:
```bash
git add -A
git commit -m "feat(documents): complete sub-bar toolbar implementation"
```

---

## Files Summary

### Install from shadcn
- `frontend/components/ui/input-group.tsx` - InputGroup for search inputs (via `npx shadcn@latest add input-group`)

### New Files (in `components/documents/`)
- `sub-bar.tsx` - Sub-bar container with left/right slots
- `filter-button.tsx` - Filter button + dropdown (uses shadcn Button + DropdownMenu)
- `selection-actions.tsx` - Selection count + actions dropdown
- `document-detail-actions.tsx` - Stacks/Edit/Export for detail page

### Modified Files
- `frontend/components/documents/columns.tsx` - Add select column
- `frontend/components/documents/documents-table.tsx` - Add row selection, sub-bar, remove old filter
- `frontend/components/documents/documents-list.tsx` - Update layout
- `frontend/components/documents/upload-dialog/upload-dialog-trigger.tsx` - Add subbar variant
- `frontend/components/documents/document-detail-client.tsx` - Add sub-bar, search state
- `frontend/components/documents/extracted-data-table.tsx` - Add search filter, fix scroll
- `frontend/components/documents/document-header-actions.tsx` - Keep only preview toggle
- `frontend/app/(app)/@header/documents/page.tsx` - Remove upload action
- `frontend/app/(app)/@header/documents/[id]/page.tsx` - Remove stacks prop
