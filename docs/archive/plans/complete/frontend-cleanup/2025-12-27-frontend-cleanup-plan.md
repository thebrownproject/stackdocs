# Frontend Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize components into logical folders, migrate all icons to Tabler with centralized barrel export, and add tooltips throughout the app.

**Architecture:** Move files with git mv to preserve history, update all import paths, create icons barrel export with namespace pattern (`import * as Icons`), add shadcn tooltips to icon-only buttons and sortable column headers.

**Tech Stack:** Next.js 16, TypeScript, Tabler Icons, shadcn/ui

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Create Icon Barrel | ✅ DONE | Task 1 complete |
| Phase 2: Migrate shadcn UI | ✅ DONE | Tasks 2-9 complete |
| Phase 3: Migrate App Components | ✅ DONE | Tasks 10-13 complete; Task 14 skipped (keep lucide-react) |
| Phase 4: Component Organization | ✅ DONE | Tasks 15-18.5 complete + extra layout moves |
| Phase 5: Add Tooltips | ✅ DONE | All tooltips complete |
| Phase 6: Documentation | ✅ DONE | Tasks 23-24 complete |

**STATUS: COMPLETE** - All phases finished, ready to move to `plans/complete/`

**Session 63 additions (not in original plan):**
- Moved ai-chat-bar, ai-activity-panel → layout/
- Moved upload-dialog/ → layout/upload-dialog/
- Moved sub-bar, filter-button, selection-actions → layout/
- Moved global-search-dialog → layout/ (instead of search/)
- Removed upload-dialog barrel file (direct imports)

**Session 64 additions (not in original plan):**
- Set global tooltip delay to 700ms (was 0)
- Added tooltip to Stackdocs dropdown with `onCloseAutoFocus` fix
- Added tooltips to Documents/Extractions nav items ("Go to X")
- Added tooltip to Clerk UserButton ("Account settings")
- Added tooltips to breadcrumb links ("Go to X")
- Added tooltip to PreviewToggle (dynamic "Show/Hide preview")

**Session 65 additions:**
- Completed Tasks 20-21 (table column sort tooltips, PDF nav tooltips)
- Added sub-bar tooltips (Filter, Search, Edit, Export, Selection actions)
- Updated frontend CLAUDE.md with Icons and Tooltips documentation
- Full build verification passed

---

## Phase 1: Create Icon Barrel (Foundation)

Create the centralized icon export first - this unblocks all subsequent file moves since we'll update imports to use the new pattern.

### Task 1: Create icons barrel file

**Files:**
- Create: `frontend/components/icons/index.ts`

**Step 1: Create the icons directory and barrel file**

```typescript
// frontend/components/icons/index.ts

// Re-export Tabler icons with stripped prefixes for cleaner usage
//
// Usage:
//   import * as Icons from "@/components/icons"
//   <Icons.Check className="size-4" />
//
// Type imports:
//   import type { Icon } from "@/components/icons"

export {
  // Checkmarks & validation
  IconCheck as Check,
  IconCircle as Circle,

  // Navigation & chevrons
  IconChevronRight as ChevronRight,
  IconChevronDown as ChevronDown,
  IconChevronLeft as ChevronLeft,
  IconArrowUp as ArrowUp,
  IconArrowDown as ArrowDown,
  IconSelector as ChevronsUpDown,

  // Close & actions
  IconX as X,
  IconDotsHorizontal as DotsHorizontal,
  IconDotsVertical as DotsVertical,
  IconGripVertical as GripVertical,

  // Layout & panels
  IconLayoutSidebar as PanelLeft,

  // Search
  IconSearch as Search,

  // Files & documents
  IconFileText as FileText,
  IconPhoto as Image,
  IconUpload as Upload,
  IconFolder as Folder,

  // App-specific
  IconStack2 as Stack,
  IconLayersLinked as LayersLinked,
  IconSettings as Settings,
  IconLifebuoy as Lifebuoy,
  IconSend as Send,
  IconShare as Share,
  IconTrash as Trash,

  // Theme
  IconSun as Sun,
  IconMoon as Moon,
  IconDeviceDesktop as DeviceDesktop,

  // Loading
  IconLoader2 as Loader2,
} from "@tabler/icons-react"

// Re-export the Icon type for component props
export type { Icon } from "@tabler/icons-react"
```

**Step 2: Verify the file was created**

Run: `cat frontend/components/icons/index.ts | head -20`

**Step 3: Commit**

```bash
git add frontend/components/icons/index.ts
git commit -m "feat: add centralized icon barrel export"
```

---

## Phase 2: Migrate shadcn UI Components to Tabler

Update all shadcn ui primitives to use the new icon barrel instead of lucide-react.

### Task 2: Update checkbox.tsx

**Files:**
- Modify: `frontend/components/ui/checkbox.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { CheckIcon } from "lucide-react"
```

With:
```typescript
import * as Icons from "@/components/icons"
```

Replace all `<CheckIcon` with `<Icons.Check`.

**Step 2: Verify build**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add frontend/components/ui/checkbox.tsx
git commit -m "refactor(ui): migrate checkbox to icon barrel"
```

---

### Task 3: Update command.tsx

**Files:**
- Modify: `frontend/components/ui/command.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { SearchIcon } from "lucide-react"
```

With:
```typescript
import * as Icons from "@/components/icons"
```

Replace all `<SearchIcon` with `<Icons.Search`.

**Step 2: Commit**

```bash
git add frontend/components/ui/command.tsx
git commit -m "refactor(ui): migrate command to icon barrel"
```

---

### Task 4: Update dialog.tsx

**Files:**
- Modify: `frontend/components/ui/dialog.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { XIcon } from "lucide-react"
```

With:
```typescript
import * as Icons from "@/components/icons"
```

Replace all `<XIcon` with `<Icons.X`.

**Step 2: Commit**

```bash
git add frontend/components/ui/dialog.tsx
git commit -m "refactor(ui): migrate dialog to icon barrel"
```

---

### Task 5: Update sheet.tsx

**Files:**
- Modify: `frontend/components/ui/sheet.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { XIcon } from "lucide-react"
```

With:
```typescript
import * as Icons from "@/components/icons"
```

Replace all `<XIcon` with `<Icons.X`.

**Step 2: Commit**

```bash
git add frontend/components/ui/sheet.tsx
git commit -m "refactor(ui): migrate sheet to icon barrel"
```

---

### Task 6: Update dropdown-menu.tsx

**Files:**
- Modify: `frontend/components/ui/dropdown-menu.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
```

With:
```typescript
import * as Icons from "@/components/icons"
```

Replace:
- `<CheckIcon` → `<Icons.Check`
- `<ChevronRightIcon` → `<Icons.ChevronRight`
- `<CircleIcon` → `<Icons.Circle`

**Step 2: Commit**

```bash
git add frontend/components/ui/dropdown-menu.tsx
git commit -m "refactor(ui): migrate dropdown-menu to icon barrel"
```

---

### Task 7: Update breadcrumb.tsx

**Files:**
- Modify: `frontend/components/ui/breadcrumb.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { ChevronRight, MoreHorizontal } from "lucide-react"
```

With:
```typescript
import * as Icons from "@/components/icons"
```

Replace:
- `<ChevronRight` → `<Icons.ChevronRight`
- `<MoreHorizontal` → `<Icons.DotsHorizontal`

**Step 2: Commit**

```bash
git add frontend/components/ui/breadcrumb.tsx
git commit -m "refactor(ui): migrate breadcrumb to icon barrel"
```

---

### Task 8: Update resizable.tsx

**Files:**
- Modify: `frontend/components/ui/resizable.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { GripVerticalIcon } from "lucide-react"
```

With:
```typescript
import * as Icons from "@/components/icons"
```

Replace all `<GripVerticalIcon` with `<Icons.GripVertical`.

**Step 2: Commit**

```bash
git add frontend/components/ui/resizable.tsx
git commit -m "refactor(ui): migrate resizable to icon barrel"
```

---

### Task 9: Update sidebar.tsx

**Files:**
- Modify: `frontend/components/ui/sidebar.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { PanelLeftIcon } from "lucide-react"
```

With:
```typescript
import * as Icons from "@/components/icons"
```

Replace all `<PanelLeftIcon` with `<Icons.PanelLeft`.

**Step 2: Verify build**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/components/ui/sidebar.tsx
git commit -m "refactor(ui): migrate sidebar to icon barrel"
```

---

## Phase 3: Migrate App Components to Icon Barrel

### Task 10: Update columns.tsx (documents)

**Files:**
- Modify: `frontend/components/documents/columns.tsx`

**Step 1: Update imports**

Replace:
```typescript
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
```

With:
```typescript
import * as Icons from "@/components/icons";
```

**Step 2: Update SortIcon function**

Replace:
```typescript
function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ArrowUp className="ml-2 size-3" />;
  if (isSorted === "desc") return <ArrowDown className="ml-2 size-3" />;
  return (
    <ChevronsUpDown className="ml-2 size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
  );
}
```

With:
```typescript
function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <Icons.ArrowUp className="ml-2 size-3" />;
  if (isSorted === "desc") return <Icons.ArrowDown className="ml-2 size-3" />;
  return (
    <Icons.ChevronsUpDown className="ml-2 size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
  );
}
```

**Step 3: Commit**

```bash
git add frontend/components/documents/columns.tsx
git commit -m "refactor(documents): migrate columns to icon barrel"
```

---

### Task 11: Update file-type-icon.tsx

**Files:**
- Modify: `frontend/components/file-type-icon.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { FileText, Image } from 'lucide-react'
```

With:
```typescript
import * as Icons from '@/components/icons'
```

Replace:
- `<FileText` → `<Icons.FileText`
- `<Image` → `<Icons.Image`

**Step 2: Commit**

```bash
git add frontend/components/file-type-icon.tsx
git commit -m "refactor: migrate file-type-icon to icon barrel"
```

---

### Task 12: Update pdf-viewer.tsx

**Files:**
- Modify: `frontend/components/pdf-viewer.tsx`

**Step 1: Update imports and usage**

Replace:
```typescript
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
```

With:
```typescript
import * as Icons from '@/components/icons'
```

Replace:
- `<ChevronLeft` → `<Icons.ChevronLeft`
- `<ChevronRight` → `<Icons.ChevronRight`
- `<Loader2` → `<Icons.Loader2`

**Step 2: Commit**

```bash
git add frontend/components/pdf-viewer.tsx
git commit -m "refactor: migrate pdf-viewer to icon barrel"
```

---

### Task 13: Update sidebar components to icon barrel

**Files:**
- Modify: `frontend/components/app-sidebar.tsx`
- Modify: `frontend/components/nav-main.tsx`
- Modify: `frontend/components/nav-projects.tsx`
- Modify: `frontend/components/sidebar-header-menu.tsx`
- Modify: `frontend/components/global-search-dialog.tsx`

**Step 1: Update app-sidebar.tsx**

Replace:
```typescript
import {
  IconFileText,
  IconLayersLinked,
  IconStack2,
} from "@tabler/icons-react";
```

With:
```typescript
import * as Icons from "@/components/icons";
```

Update data object to use `Icons.Stack`, `Icons.FileText`, `Icons.LayersLinked`.

**Step 2: Update nav-main.tsx**

Replace:
```typescript
import { IconChevronRight, type Icon } from "@tabler/icons-react"
```

With:
```typescript
import * as Icons from "@/components/icons"
import type { Icon } from "@/components/icons"
```

Replace `<IconChevronRight` → `<Icons.ChevronRight`.

**Step 3: Update nav-projects.tsx**

Replace the Tabler import block with:
```typescript
import * as Icons from "@/components/icons"
import type { Icon } from "@/components/icons"
```

Replace all icon usages:
- `<IconFolder` → `<Icons.Folder`
- `<IconDotsVertical` → `<Icons.DotsVertical`
- `<IconShare` → `<Icons.Share`
- `<IconTrash` → `<Icons.Trash`
- `<IconChevronRight` → `<Icons.ChevronRight`

**Step 4: Update sidebar-header-menu.tsx**

Replace the Tabler import block with:
```typescript
import * as Icons from "@/components/icons"
```

Replace all icon usages (IconStack2 → Icons.Stack, IconChevronDown → Icons.ChevronDown, etc.).

**Step 5: Update global-search-dialog.tsx**

Replace the Tabler import block with:
```typescript
import * as Icons from "@/components/icons"
```

Replace all icon usages.

**Step 6: Verify build**

Run: `cd frontend && npx tsc --noEmit`

If there are errors, fix them before committing.

**Step 7: Commit**

```bash
git add frontend/components/app-sidebar.tsx frontend/components/nav-main.tsx frontend/components/nav-projects.tsx frontend/components/sidebar-header-menu.tsx frontend/components/global-search-dialog.tsx
git commit -m "refactor: migrate sidebar components to icon barrel"
```

---

### Task 14: Remove lucide-react dependency

**Files:**
- Modify: `frontend/package.json`

**Step 1: Verify no lucide imports remain**

Run the following commands to check all relevant directories:

```bash
grep -r "lucide-react" frontend/components --include="*.tsx" --include="*.ts"
grep -r "lucide-react" frontend/components/ui --include="*.tsx"
grep -r "lucide-react" frontend/app --include="*.tsx" --include="*.ts"
```

Expected: No output (no remaining imports from lucide-react)

**Step 2: Remove the dependency**

Run: `cd frontend && npm uninstall lucide-react`

**Step 3: Verify build still works**

Run: `cd frontend && npm run build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: remove lucide-react dependency"
```

---

## Phase 4: Component Organization

Move components into organized folder structure.

### Task 15: Create folder structure

**Step 1: Create new directories**

```bash
mkdir -p frontend/components/layout/sidebar
mkdir -p frontend/components/search
mkdir -p frontend/components/shared
mkdir -p frontend/components/providers
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: create component folder structure"
```

---

### Task 16: Move sidebar components

**Files:**
- Move: `frontend/components/app-sidebar.tsx` → `frontend/components/layout/sidebar/`
- Move: `frontend/components/sidebar-header-menu.tsx` → `frontend/components/layout/sidebar/`
- Move: `frontend/components/nav-main.tsx` → `frontend/components/layout/sidebar/`
- Move: `frontend/components/nav-projects.tsx` → `frontend/components/layout/sidebar/`

**Step 1: Move files with git**

```bash
git mv frontend/components/app-sidebar.tsx frontend/components/layout/sidebar/
git mv frontend/components/sidebar-header-menu.tsx frontend/components/layout/sidebar/
git mv frontend/components/nav-main.tsx frontend/components/layout/sidebar/
git mv frontend/components/nav-projects.tsx frontend/components/layout/sidebar/
```

**Step 2: Update imports in moved files**

Update `app-sidebar.tsx`:
```typescript
import { NavMain } from "@/components/layout/sidebar/nav-main";
import { NavProjects } from "@/components/layout/sidebar/nav-projects";
import { SidebarHeaderMenu } from "@/components/layout/sidebar/sidebar-header-menu";
```

Update `sidebar-header-menu.tsx`:
```typescript
import { GlobalSearchDialog } from "@/components/search/global-search-dialog"
```
(Note: global-search-dialog will be moved in Task 18)

**Step 3: Update imports in consuming files**

Update `frontend/app/(app)/layout.tsx`:
```typescript
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
```

**Step 4: Verify build**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move sidebar components to layout/sidebar/"
```

---

### Task 17: Move document-related components

**Files:**
- Move: `frontend/components/pdf-viewer.tsx` → `frontend/components/documents/`
- Move: `frontend/components/visual-preview.tsx` → `frontend/components/documents/`

**Step 1: Move files**

```bash
git mv frontend/components/pdf-viewer.tsx frontend/components/documents/
git mv frontend/components/visual-preview.tsx frontend/components/documents/
```

**Step 2: Update imports in consuming files**

Search for imports and update paths. Files using these:
- `frontend/components/documents/preview-panel.tsx` - likely imports pdf-viewer and visual-preview

Update any imports from `@/components/pdf-viewer` to `@/components/documents/pdf-viewer`.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move pdf-viewer and visual-preview to documents/"
```

---

### Task 18: Move search, shared, and provider components

**Files:**
- Move: `frontend/components/global-search-dialog.tsx` → `frontend/components/search/`
- Move: `frontend/components/file-type-icon.tsx` → `frontend/components/shared/`
- Move: `frontend/components/stack-badges.tsx` → `frontend/components/shared/`
- Move: `frontend/components/theme-provider.tsx` → `frontend/components/providers/`

**Step 1: Move files**

```bash
git mv frontend/components/global-search-dialog.tsx frontend/components/search/
git mv frontend/components/file-type-icon.tsx frontend/components/shared/
git mv frontend/components/stack-badges.tsx frontend/components/shared/
git mv frontend/components/theme-provider.tsx frontend/components/providers/
```

**Step 2: Update imports**

Update `frontend/components/layout/sidebar/sidebar-header-menu.tsx`:
```typescript
import { GlobalSearchDialog } from "@/components/search/global-search-dialog"
```

Update `frontend/components/documents/columns.tsx`:
```typescript
import { FileTypeIcon } from "@/components/shared/file-type-icon";
import { StackBadges } from "@/components/shared/stack-badges";
```

Update `frontend/app/layout.tsx`:
```typescript
import { ThemeProvider } from '@/components/providers/theme-provider'
```

**Step 3: Verify build**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move search, shared, and provider components"
```

---

### Task 18.5: Fix upload dialog wrapper in sidebar-header-menu

**Files:**
- Modify: `frontend/components/layout/sidebar/sidebar-header-menu.tsx`

**Step 1: Add Dialog wrapper for upload**

The file has `uploadOpen` state but no Dialog component wrapper. Add the following after the GlobalSearchDialog component:

```tsx
<Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
  <UploadDialogContent />
</Dialog>
```

This should be placed in the JSX return statement, after the GlobalSearchDialog component.

**Step 2: Verify Dialog and UploadDialogContent imports exist**

Check that the file imports:
```typescript
import { Dialog } from "@/components/ui/dialog"
import { UploadDialogContent } from "@/components/upload-dialog-content" // or wherever it's imported from
```

**Step 3: Commit**

```bash
git add frontend/components/layout/sidebar/sidebar-header-menu.tsx
git commit -m "fix: add missing Dialog wrapper for upload in sidebar header"
```

---

## Phase 5: Add Tooltips

> **Note on TooltipProvider:** Our custom `tooltip.tsx` component automatically wraps each `<Tooltip>` in its own `<TooltipProvider>`, so we don't need a root-level provider in the app layout. This is why we can use tooltips directly without additional setup.

### Task 19: Add tooltips to sidebar header buttons

**Files:**
- Modify: `frontend/components/layout/sidebar/sidebar-header-menu.tsx`

**Step 1: Add tooltip imports**

```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
```

**Step 2: Wrap search button with tooltip**

Replace:
```tsx
<Button
  variant="ghost"
  size="icon"
  className="size-8"
  onClick={() => setSearchOpen(true)}
>
  <Icons.Search className="size-4" />
  <span className="sr-only">Search</span>
</Button>
```

With:
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={() => setSearchOpen(true)}
    >
      <Icons.Search className="size-4" />
      <span className="sr-only">Search</span>
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Search (⌘K)</p>
  </TooltipContent>
</Tooltip>
```

**Step 3: Wrap upload button with tooltip**

Same pattern for upload button with content "Upload document".

**Step 4: Commit**

```bash
git add frontend/components/layout/sidebar/sidebar-header-menu.tsx
git commit -m "feat: add tooltips to sidebar header buttons"
```

---

### Task 20: Add tooltips to table column sort buttons

**Files:**
- Modify: `frontend/components/documents/columns.tsx`

**Step 1: Wrap Name column sort button**

The tooltip import already exists. Update the Name column header:

```tsx
header: ({ column }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-3 group"
      >
        Name
        <SortIcon isSorted={column.getIsSorted()} />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Click to sort by name</p>
    </TooltipContent>
  </Tooltip>
),
```

**Step 2: Wrap Date column sort button**

Update the Date column header to match the pattern, with the icon AFTER the text:

```tsx
header: ({ column }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-3 group"
      >
        Date
        <SortIcon isSorted={column.getIsSorted()} />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Click to sort by date</p>
    </TooltipContent>
  </Tooltip>
),
```

**Step 3: Commit**

```bash
git add frontend/components/documents/columns.tsx
git commit -m "feat: add tooltips to table column headers"
```

---

### Task 21: Add tooltip to PDF viewer navigation buttons

**Files:**
- Modify: `frontend/components/documents/pdf-viewer.tsx`

**Step 1: Add tooltip imports**

```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
```

**Step 2: Wrap previous page button**

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="outline"
      size="sm"
      disabled={pageNumber <= 1}
      onClick={() => setPageNumber((p) => p - 1)}
      aria-label="Previous page"
    >
      <Icons.ChevronLeft className="size-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Previous page</p>
  </TooltipContent>
</Tooltip>
```

**Step 3: Wrap next page button**

Same pattern with content "Next page".

**Step 4: Commit**

```bash
git add frontend/components/documents/pdf-viewer.tsx
git commit -m "feat: add tooltips to PDF viewer navigation"
```

---

### Task 22: Add tooltip to sidebar trigger

**Files:**
- Modify: `frontend/app/(app)/layout.tsx`

**Step 1: Add tooltip imports**

```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
```

**Step 2: Wrap SidebarTrigger**

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <SidebarTrigger className="ml-2.5" />
  </TooltipTrigger>
  <TooltipContent side="right">
    <p>Toggle sidebar</p>
  </TooltipContent>
</Tooltip>
```

**Step 3: Commit**

```bash
git add frontend/app/(app)/layout.tsx
git commit -m "feat: add tooltip to sidebar trigger"
```

---

## Phase 6: Documentation & Final Verification

### Task 23: Update frontend CLAUDE.md

**Files:**
- Modify: `frontend/CLAUDE.md`

**Step 1: Update Directory Structure section**

Replace the components section in the directory structure with:

```markdown
├── components/
│   ├── documents/                # Document-specific components
│   │   └── upload-dialog/        # Multi-step upload wizard
│   ├── icons/                    # Centralized icon exports
│   ├── layout/                   # App layout components
│   │   └── sidebar/              # Sidebar and navigation
│   ├── providers/                # Context providers (theme)
│   ├── search/                   # Global search dialog
│   ├── shared/                   # Shared components (file icons, badges)
│   └── ui/                       # shadcn/ui primitives
```

**Step 2: Add Icons section under Key Patterns**

Add new section after "### Components":

```markdown
### Icons

All icons come from Tabler Icons via a centralized barrel export:

```typescript
import * as Icons from "@/components/icons"

<Icons.Check className="size-4" />
<Icons.Search className="size-4" />
```

- **Never import directly** from `@tabler/icons-react`
- **Naming**: Icon prefix stripped (IconCheck → Check)
- **Type imports**: `import type { Icon } from "@/components/icons"`

### Tooltips

Use shadcn tooltips for icon-only buttons and interactive elements:

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <Icons.Search className="size-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Search (⌘K)</p>
  </TooltipContent>
</Tooltip>
```

Each tooltip auto-wraps in its own provider - no root-level TooltipProvider needed.
```

**Step 3: Commit**

```bash
git add frontend/CLAUDE.md
git commit -m "docs: update frontend CLAUDE.md with new structure and patterns"
```

---

### Task 24: Full build and verification

**Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 2: Run production build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 3: Verify no lucide-react imports**

Run: `grep -r "lucide-react" frontend/ --include="*.tsx" --include="*.ts"`
Expected: No output

**Step 4: Verify no root-level components**

Run: `ls frontend/components/*.tsx 2>/dev/null | wc -l`
Expected: 0

**Step 5: Final commit (if any uncommitted changes)**

```bash
git add -A
git commit -m "chore: frontend cleanup complete"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1 | Create icon barrel |
| 2 | 2-9 | Migrate shadcn ui to icon barrel |
| 3 | 10-14 | Migrate app components, remove lucide |
| 4 | 15-18.5 | Reorganize folder structure + fix upload dialog |
| 5 | 19-22 | Add tooltips |
| 6 | 23-24 | Documentation & verification |

**Total: 25 tasks** (includes task 18.5 for upload dialog fix, task 23 for docs update)
