# Phase 3: Stack Dropdown (Toggle)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable stack membership toggle via checkbox dropdown in document detail.

**Architecture:** Server component fetches allStacks, client component handles toggle via Supabase direct.

**Tech Stack:** Supabase JS, shadcn/ui DropdownMenuCheckboxItem, Sonner toast

**Note:** `StacksDropdown` component already exists with checkbox UI structure. We're enhancing it with DB operations and wiring up the `documentId` prop for mutations.

---

## Task 8: Add getAllStacks Query

**Files:**
- Modify: `frontend/lib/queries/stacks.ts`

> **Note:** `getStacksForSidebar()` already exists but has `limit(10)` and orders by `updated_at`.
> We need `getAllStacks()` without a limit, ordered alphabetically by `name` for dropdown UX.

**Step 1: Add cached query for all user stacks**

```tsx
/**
 * Get all stacks for the current user (minimal data for dropdowns).
 * Wrapped with React cache() to deduplicate requests.
 *
 * Unlike getStacksForSidebar(), this has no limit and orders by name.
 */
export const getAllStacks = cache(async function getAllStacks(): Promise<StackSummary[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('stacks')
    .select('id, name')
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching all stacks:', error)
    return []
  }

  return data || []
})
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/lib/queries/stacks.ts
git commit -m "feat: add getAllStacks query for stack dropdown"
```

---

## Task 8: Fetch allStacks in SubBar Server Component

**Files:**
- Modify: `frontend/app/(app)/@subbar/documents/[id]/page.tsx`

**Step 1: Fetch both assignedStacks and allStacks**

```tsx
import { getDocumentStacks } from '@/lib/queries/documents'
import { getAllStacks } from '@/lib/queries/stacks'
import { DocumentDetailSubBar } from '@/components/documents/document-detail-sub-bar'

interface DocumentDetailSubBarPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailSubBarPage({ params }: DocumentDetailSubBarPageProps) {
  const { id } = await params

  // Fetch in parallel for faster loading
  const [assignedStacks, allStacks] = await Promise.all([
    getDocumentStacks(id),
    getAllStacks(),
  ])

  return <DocumentDetailSubBar documentId={id} assignedStacks={assignedStacks} allStacks={allStacks} />
}
```

**Step 2: Update DocumentDetailSubBar props**

Modify `frontend/components/documents/document-detail-sub-bar.tsx` to accept `documentId` and `allStacks` props and pass them to `DocumentDetailActions`:

```tsx
// frontend/components/documents/document-detail-sub-bar.tsx
import type { StackSummary } from '@/types/stacks'

interface DocumentDetailSubBarProps {
  documentId: string
  assignedStacks: StackSummary[]
  allStacks: StackSummary[]
}

export function DocumentDetailSubBar({
  documentId,
  assignedStacks,
  allStacks,
}: DocumentDetailSubBarProps) {
  const { fieldSearch, setFieldSearch, selectedFieldCount } = useDocumentDetailFilter()

  return (
    <SubBar
      left={
        <>
          <FilterButton />
          <ExpandableSearch
            value={fieldSearch}
            onChange={setFieldSearch}
            placeholder="Search fields..."
          />
        </>
      }
      right={
        <>
          <SelectionActions selectedCount={selectedFieldCount} />
          <DocumentDetailActions
            documentId={documentId}
            assignedStacks={assignedStacks}
            allStacks={allStacks}
          />
        </>
      }
    />
  )
}
```

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/app/(app)/@subbar/documents/[id]/page.tsx frontend/components/documents/document-detail-sub-bar.tsx
git commit -m "feat: fetch allStacks for stack dropdown in document detail"
```

---

## Task 8: Wire Up Stack Dropdown with DB Operations

**Files:**
- Modify: `frontend/components/documents/stacks-dropdown.tsx`
- Modify: `frontend/components/documents/document-detail-actions.tsx`

**Breaking Change:** The existing `StacksDropdown` interface changes:
- `onToggleStack?: (stackId, assigned) => void` is REMOVED (handled internally now)
- `documentId: string` is ADDED (required for DB operations)
- `allStacks` becomes required (was optional)
- Empty state logic changes: now shows "No stacks" when `allStacks.length === 0` (not when `assignedStacks.length === 0`)

**Key Implementation Details:**
- Add `documentId` prop (required for DB operations)
- Delete from junction table requires **two** `.eq()` conditions (document_id AND stack_id)
- Error handling with toast notifications for user feedback
- `router.refresh()` to update server data after mutation

**Step 1: Add toggle handler to StacksDropdown**

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useSupabase } from '@/hooks/use-supabase'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { StackSummary } from '@/types/stacks'
import * as Icons from '@/components/icons'

interface StacksDropdownProps {
  documentId: string  // Required for DB operations
  assignedStacks: StackSummary[]
  allStacks: StackSummary[]
}

export function StacksDropdown({
  documentId,
  assignedStacks,
  allStacks,
}: StacksDropdownProps) {
  const supabase = useSupabase()
  const router = useRouter()
  const assignedIds = new Set(assignedStacks.map((s) => s.id))

  const handleToggleStack = async (stackId: string, stackName: string, shouldAssign: boolean) => {

    try {
      if (shouldAssign) {
        const { error } = await supabase
          .from('stack_documents')
          .insert({ document_id: documentId, stack_id: stackId })

        if (error) throw error
        toast.success(`Added to "${stackName}"`)
      } else {
        // Junction table delete requires BOTH conditions
        const { error } = await supabase
          .from('stack_documents')
          .delete()
          .eq('document_id', documentId)
          .eq('stack_id', stackId)

        if (error) throw error
        toast.success(`Removed from "${stackName}"`)
      }

      router.refresh()
    } catch (error) {
      console.error('Stack toggle failed:', error)
      toast.error(shouldAssign ? 'Failed to add to stack' : 'Failed to remove from stack')
    }
  }

  // Button label
  const count = assignedStacks.length
  const displayText = count === 0
    ? 'No stacks'
    : count === 1
    ? assignedStacks[0].name
    : `${count} Stacks`

  if (allStacks.length === 0) {
    return (
      <span className="text-xs text-muted-foreground/60 px-2">
        No stacks
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          {displayText}
          <Icons.ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Stacks
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allStacks.map((stack) => (
          <DropdownMenuCheckboxItem
            key={stack.id}
            checked={assignedIds.has(stack.id)}
            onCheckedChange={(checked) => handleToggleStack(stack.id, stack.name, checked)}
            className="text-sm"
          >
            {stack.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: Update DocumentDetailActions to pass props**

```tsx
interface DocumentDetailActionsProps {
  documentId: string
  assignedStacks: StackSummary[]
  allStacks: StackSummary[]
}

export function DocumentDetailActions({ documentId, assignedStacks, allStacks }: DocumentDetailActionsProps) {
  return (
    <>
      <StacksDropdown documentId={documentId} assignedStacks={assignedStacks} allStacks={allStacks} />
      {/* ... rest of actions */}
    </>
  )
}
```

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/components/documents/stacks-dropdown.tsx frontend/components/documents/document-detail-actions.tsx
git commit -m "feat: wire up stack dropdown with Supabase operations"
```
