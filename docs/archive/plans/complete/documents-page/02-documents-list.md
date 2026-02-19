# Documents Page: Phase 2 - Documents List

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the documents list page with TanStack Table, types, and data fetching.

**Prereq:** `01-foundation.md` | **This plan:** Tasks 4-11 | **Next:** `03-document-detail.md`

**Architecture:** Server components fetch data from Supabase, pass to client table/detail components. Page header uses React Context for breadcrumbs and a portal pattern for actions. PDF viewing uses react-pdf with client-side rendering. AI chat uses SSE streaming to the existing extraction agent.

**Tech Stack:** Next.js 16, TanStack Table, shadcn/ui (table, dialog, badge, tabs, dropdown-menu, popover, checkbox, card), react-pdf, Supabase

---

## Design System: Linear-Inspired Precision

**Aesthetic Direction:** Extreme restraint. Let content speak. Every element earns its place.

**Typography:**
- Headers: `font-medium` only - never bold, never uppercase
- Table headers: `text-muted-foreground text-sm` - lowercase, understated
- IDs/codes: `font-mono text-muted-foreground text-sm` - like Linear's `BUI-1`
- Body: Default weight, generous line height

**Color Palette:**
- Base: Near-monochrome - `text-foreground` and `text-muted-foreground`
- Status icons only: Small colored dots/icons, never colored text blocks
- Backgrounds: `bg-transparent` or very subtle `hover:bg-muted/50`
- Borders: `border-border` - visible but not heavy
- **Dark mode safe colors:** Use CSS variables or explicit dark: variants for status indicators

**Spacing:**
- Rows: `py-3` minimum - content needs room to breathe
- Sections: `space-y-6` between major blocks
- Inline: `gap-3` for property pills

**Borders & Containers:**
- Tables: Single outer border, no internal row borders (use hover bg instead)
- Empty states: `border-dashed` with muted placeholder text and subtle icon
- Cards: `rounded-lg border` - subtle, not boxy

**Motion:**
- Transitions: `duration-150` - instant feel
- Hover: `bg-muted/50` - barely there
- No transforms, no scaling, no bounce

**Interactions:**
- Rows: Full clickable area, subtle bg on hover, `data-state="selected"` for selection styling
- Buttons: Ghost by default, outline for secondary, filled only for primary CTA
- Property pills: Inline badges with icons, clickable for dropdowns

---

## Phase 2: Documents List Page

### Task 4: Create Document Type Definitions

**Files:**
- Create: `frontend/types/documents.ts`

**Step 1: Create type definitions**

Create `frontend/types/documents.ts`:

```ts
export interface Stack {
  id: string
  name: string
}

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Document {
  id: string
  filename: string
  mime_type: string
  status: DocumentStatus
  uploaded_at: string
  stacks: Stack[]
}

export interface DocumentWithExtraction extends Document {
  extraction_id: string | null
  extracted_fields: Record<string, unknown> | null
  confidence_scores: Record<string, number> | null
  session_id: string | null
  ocr_raw_text: string | null
  file_path: string
}
```

**Step 2: Commit**

```bash
git add frontend/types
git commit -m "feat: add document type definitions"
```

---

### Task 5: Create Data Fetching Function

**Files:**
- Create: `frontend/lib/queries/documents.ts`

**Step 1: Create the documents query function**

Create `frontend/lib/queries/documents.ts`:

```ts
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Document, DocumentWithExtraction, DocumentStatus } from '@/types/documents'

export async function getDocumentsWithStacks(): Promise<Document[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('documents')
    .select(`
      id,
      filename,
      mime_type,
      status,
      uploaded_at,
      stack_documents (
        stacks (
          id,
          name
        )
      )
    `)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }

  // Transform the nested structure
  return (data || []).map((doc) => ({
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    status: doc.status as DocumentStatus,
    uploaded_at: doc.uploaded_at,
    stacks: (doc.stack_documents || [])
      .map((sd: { stacks: { id: string; name: string } | null }) => sd.stacks)
      .filter((s): s is { id: string; name: string } => s !== null),
  }))
}

export async function getDocumentWithExtraction(
  documentId: string
): Promise<DocumentWithExtraction | null> {
  const supabase = await createServerSupabaseClient()

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select(`
      id,
      filename,
      mime_type,
      status,
      uploaded_at,
      file_path,
      stack_documents (
        stacks (
          id,
          name
        )
      )
    `)
    .eq('id', documentId)
    .single()

  if (docError || !doc) {
    console.error('Error fetching document:', docError)
    return null
  }

  // Get latest extraction
  const { data: extraction } = await supabase
    .from('extractions')
    .select('id, extracted_fields, confidence_scores, session_id')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get OCR text
  const { data: ocr } = await supabase
    .from('ocr_results')
    .select('raw_text')
    .eq('document_id', documentId)
    .single()

  return {
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    status: doc.status as DocumentStatus,
    uploaded_at: doc.uploaded_at,
    file_path: doc.file_path,
    stacks: (doc.stack_documents || [])
      .map((sd: { stacks: { id: string; name: string } | null }) => sd.stacks)
      .filter((s): s is { id: string; name: string } => s !== null),
    extraction_id: extraction?.id || null,
    extracted_fields: extraction?.extracted_fields || null,
    confidence_scores: extraction?.confidence_scores || null,
    session_id: extraction?.session_id || null,
    ocr_raw_text: ocr?.raw_text || null,
  }
}
```

**Step 2: Commit**

```bash
git add frontend/lib/queries
git commit -m "feat: add document data fetching functions"
```

---

### Task 6: Create File Type Icon Component

**Files:**
- Create: `frontend/components/file-type-icon.tsx`

**Step 1: Create the FileTypeIcon component**

Create `frontend/components/file-type-icon.tsx`:

```tsx
import { FileText, Image } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileTypeIconProps {
  mimeType: string
  className?: string
}

export function FileTypeIcon({ mimeType, className }: FileTypeIconProps) {
  const iconClass = cn('size-4', className)

  if (mimeType === 'application/pdf') {
    return <FileText className={cn(iconClass, 'text-red-500 dark:text-red-400')} />
  }

  if (mimeType.startsWith('image/')) {
    return <Image className={cn(iconClass, 'text-blue-500 dark:text-blue-400')} />
  }

  return <FileText className={cn(iconClass, 'text-muted-foreground')} />
}
```

**Step 2: Commit**

```bash
git add frontend/components/file-type-icon.tsx
git commit -m "feat: add FileTypeIcon component"
```

---

### Task 7: Create Stack Badges Component

**Files:**
- Create: `frontend/components/stack-badges.tsx`

**Step 1: Create the StackBadges component**

Create `frontend/components/stack-badges.tsx`:

```tsx
import { Badge } from '@/components/ui/badge'
import type { Stack } from '@/types/documents'

interface StackBadgesProps {
  stacks: Stack[]
  maxVisible?: number
}

export function StackBadges({ stacks, maxVisible = 2 }: StackBadgesProps) {
  if (stacks.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  const visible = stacks.slice(0, maxVisible)
  const overflow = stacks.length - maxVisible

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((stack) => (
        <Badge key={stack.id} variant="secondary" className="text-xs">
          {stack.name}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="text-xs">
          +{overflow}
        </Badge>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/stack-badges.tsx
git commit -m "feat: add StackBadges component"
```

---

### Task 8: Create Documents Table Component (Full shadcn Pattern)

**Files:**
- Create: `frontend/components/documents/columns.tsx`
- Create: `frontend/components/documents/documents-table.tsx`

**Step 1: Create column definitions with actions**

Create `frontend/components/documents/columns.tsx`:

```tsx
'use client'

import { ColumnDef } from '@tanstack/react-table'
import { FileTypeIcon } from '@/components/file-type-icon'
import { StackBadges } from '@/components/stack-badges'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Document } from '@/types/documents'
import { Loader2, AlertCircle, MoreHorizontal, Eye, Trash2, ArrowUpDown } from 'lucide-react'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const columns: ColumnDef<Document>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'filename',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          Name
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const doc = row.original
      return (
        <div className="flex items-center gap-2">
          <FileTypeIcon mimeType={doc.mime_type} />
          <span className="font-medium">{doc.filename}</span>
          {doc.status === 'processing' && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          {doc.status === 'failed' && (
            <AlertCircle className="size-4 text-destructive" />
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'stacks',
    header: 'Stacks',
    cell: ({ row }) => <StackBadges stacks={row.original.stacks} />,
    enableSorting: false,
  },
  {
    accessorKey: 'uploaded_at',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          Date
          <ArrowUpDown className="ml-2 size-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.uploaded_at)}
      </span>
    ),
  },
  {
    id: 'actions',
    enableHiding: false,
    cell: ({ row }) => {
      const doc = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(doc.id)
              }}
            >
              Copy document ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
              <Eye className="mr-2 size-4" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => e.stopPropagation()}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
```

**Step 2: Create the DataTable component with full state management**

Create `frontend/components/documents/documents-table.tsx`:

```tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { columns } from './columns'
import type { Document } from '@/types/documents'
import { ChevronDown, FileText } from 'lucide-react'

interface DocumentsTableProps {
  documents: Document[]
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data: documents,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex items-center py-4 gap-2">
        <Input
          placeholder="Filter documents..."
          value={(table.getColumn('filename')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('filename')?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 text-sm font-normal text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="cursor-pointer border-0 hover:bg-muted/50 transition-colors duration-150"
                  onClick={() => router.push(`/documents/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText className="size-12 text-muted-foreground/50 mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">No documents</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Upload your first document to get started
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add frontend/components/documents
git commit -m "feat: add DocumentsTable with full TanStack Table features"
```

---

### Task 9: Create Documents List Page Client Wrapper

**Files:**
- Create: `frontend/components/documents/documents-list.tsx`

**Step 1: Create the client wrapper with breadcrumbs**

Create `frontend/components/documents/documents-list.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useBreadcrumbs } from '@/contexts/page-header-context'
import { PageHeader } from '@/components/page-header'
import { DocumentsTable } from './documents-table'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import type { Document } from '@/types/documents'

interface DocumentsListProps {
  documents: Document[]
}

export function DocumentsList({ documents }: DocumentsListProps) {
  const { setBreadcrumbs } = useBreadcrumbs()

  useEffect(() => {
    setBreadcrumbs([
      { id: 'workspace', label: 'Workspace', href: '/' },
      { id: 'documents', label: 'Documents' },
    ])
  }, [setBreadcrumbs])

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button disabled>
            <Upload className="mr-2 size-4" />
            Upload
          </Button>
        }
      />
      <DocumentsTable documents={documents} />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/documents-list.tsx
git commit -m "feat: add DocumentsList client wrapper with breadcrumbs"
```

---

### Task 10: Create Loading State for Documents Page

**Files:**
- Create: `frontend/app/(app)/documents/loading.tsx`

**Step 1: Create the loading skeleton**

Create `frontend/app/(app)/documents/loading.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function DocumentsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Filter skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-24 ml-auto" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border">
        <div className="p-4 space-y-4">
          {/* Header row */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          {/* Data rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/app/\(app\)/documents/loading.tsx
git commit -m "feat: add loading skeleton for documents page"
```

---

### Task 11: Update Documents Page

**Files:**
- Modify: `frontend/app/(app)/documents/page.tsx`

**Step 1: Update the documents page to fetch and display data**

Replace `frontend/app/(app)/documents/page.tsx`:

```tsx
import { getDocumentsWithStacks } from '@/lib/queries/documents'
import { DocumentsList } from '@/components/documents/documents-list'

export default async function DocumentsPage() {
  const documents = await getDocumentsWithStacks()

  return <DocumentsList documents={documents} />
}
```

**Step 2: Verify the page works**

Run:
```bash
cd frontend && npm run dev
```

Navigate to http://localhost:3000/documents - should see the table (may be empty if no documents exist).

**Step 3: Commit**

```bash
git add frontend/app/\(app\)/documents/page.tsx
git commit -m "feat: implement documents list page with server-side data fetching"
```

---

