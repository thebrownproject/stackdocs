# Frontend Cleanup Design

**Date:** 2025-12-26
**Status:** Design Complete
**Scope:** Component organization, icon migration, tooltip integration

---

## Overview

Cleanup and improvement of the frontend codebase focusing on three areas:

1. **Component Organization** - Restructure components into logical folders, remove dead code
2. **Icon Migration** - Standardize on Tabler Icons with centralized barrel export
3. **Tooltips** - Add shadcn tooltips throughout the app for better UX

---

## Part 1: Component Organization

### Problem

- 12 component files sitting in root of `components/` directory
- No clear organization pattern beyond `ui/`, `documents/`, `layout/`
- Dead code: `sidebar-user-footer.tsx`, `nav-secondary.tsx` (already deleted)

### Solution

Reorganize into feature-based folders:

```
components/
├── ui/                          # shadcn primitives (unchanged)
├── layout/
│   ├── sidebar/
│   │   ├── app-sidebar.tsx
│   │   ├── sidebar-header-menu.tsx
│   │   ├── nav-main.tsx
│   │   └── nav-projects.tsx
│   ├── page-header.tsx
│   ├── action-button.tsx
│   └── expandable-search.tsx
├── documents/
│   ├── upload-dialog/           # existing subfolder
│   ├── pdf-viewer.tsx           # move from root
│   ├── visual-preview.tsx       # move from root
│   └── ... (existing files)
├── search/
│   └── global-search-dialog.tsx
├── shared/
│   ├── file-type-icon.tsx
│   └── stack-badges.tsx
├── providers/
│   └── theme-provider.tsx
└── icons/
    └── index.ts                 # Part 2: icon barrel
```

### Files to Move

| File | From | To |
|------|------|-----|
| `app-sidebar.tsx` | `components/` | `components/layout/sidebar/` |
| `sidebar-header-menu.tsx` | `components/` | `components/layout/sidebar/` |
| `nav-main.tsx` | `components/` | `components/layout/sidebar/` |
| `nav-projects.tsx` | `components/` | `components/layout/sidebar/` |
| `global-search-dialog.tsx` | `components/` | `components/search/` |
| `pdf-viewer.tsx` | `components/` | `components/documents/` |
| `visual-preview.tsx` | `components/` | `components/documents/` |
| `file-type-icon.tsx` | `components/` | `components/shared/` |
| `stack-badges.tsx` | `components/` | `components/shared/` |
| `theme-provider.tsx` | `components/` | `components/providers/` |

### Dead Code (Already Deleted)

- `sidebar-user-footer.tsx` - not imported anywhere
- `nav-secondary.tsx` - not imported anywhere

### Code Review Scope

During file moves, review each component for:
- Unused imports
- Unused variables/functions
- Overly complex logic that can be simplified
- AI-generated bloat (unnecessary comments, over-engineering)

---

## Part 2: Icon Migration

### Problem

- Mixed icon libraries: Lucide (8 files) and Tabler (7 files)
- Icons imported directly in every component
- Inconsistent naming patterns

### Current Usage

**Lucide (in shadcn ui primitives):**
- `dropdown-menu.tsx`: CheckIcon, ChevronRightIcon, CircleIcon
- `command.tsx`: SearchIcon
- `dialog.tsx`: XIcon
- `breadcrumb.tsx`: ChevronRight, MoreHorizontal
- `checkbox.tsx`: CheckIcon
- `resizable.tsx`: GripVerticalIcon
- `sheet.tsx`: XIcon
- `sidebar.tsx`: PanelLeftIcon

**Tabler (in app components):**
- Sidebar, nav, and other app-specific components

### Solution

1. **Standardize on Tabler Icons** - single icon library
2. **Create barrel export** - centralized icon management
3. **Strip "Icon" prefix** - cleaner namespace usage

### Icon Barrel Pattern

```typescript
// components/icons/index.ts
export {
  IconCheck as Check,
  IconChevronRight as ChevronRight,
  IconCircle as Circle,
  IconSearch as Search,
  IconX as X,
  IconDotsHorizontal as MoreHorizontal,
  IconGripVertical as GripVertical,
  IconLayoutSidebar as PanelLeft,
  // ... all icons used in app
} from "@tabler/icons-react"
```

### Usage Pattern

```typescript
// Before (scattered imports)
import { IconCheck } from "@tabler/icons-react"
import { CheckIcon } from "lucide-react"

// After (centralized)
import * as Icons from "@/components/icons"

<Icons.Check className="size-4" />
```

### Migration Steps

1. Create `components/icons/index.ts` with all needed icons
2. Update shadcn ui components to use Tabler equivalents
3. Update app components to use `import * as Icons` pattern
4. Remove `lucide-react` from `package.json`
5. Run build to verify no broken imports

### Icon Mapping (Lucide → Tabler)

| Lucide | Tabler |
|--------|--------|
| `CheckIcon` | `IconCheck` |
| `ChevronRightIcon` / `ChevronRight` | `IconChevronRight` |
| `CircleIcon` | `IconCircle` |
| `SearchIcon` | `IconSearch` |
| `XIcon` | `IconX` |
| `MoreHorizontal` | `IconDotsHorizontal` |
| `GripVerticalIcon` | `IconGripVertical` |
| `PanelLeftIcon` | `IconLayoutSidebar` |

---

## Part 3: Tooltips

### Problem

- Limited tooltip usage (only 2 places currently)
- Users lack context for icon-only buttons and actions
- No discoverability for keyboard shortcuts or features

### Solution

Add shadcn tooltips throughout the application for better UX.

### Target Areas

| Area | Examples |
|------|----------|
| **Table columns** | "Sort by Name", "Sort by Date" on headers |
| **Sidebar** | Nav items, collapse/expand button |
| **Page header** | Action buttons, upload button |
| **Icon-only buttons** | Any button without visible label |
| **Status indicators** | Confidence dots, processing states |

### Implementation Pattern

Use shadcn tooltip directly (no wrapper):

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <Icons.Upload className="size-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Upload document</p>
  </TooltipContent>
</Tooltip>
```

### Props Reference

- `asChild` on TooltipTrigger - wraps existing element without extra DOM node
- `side="top|right|bottom|left"` on TooltipContent - positioning
- `sideOffset={number}` - spacing from trigger

### Existing Component

`components/ui/tooltip.tsx` is already installed with:
- Arrow indicator
- Proper animations (fade, zoom, slide)
- Dark background styling (`bg-foreground text-background`)

---

## Out of Scope

- **Loading animation** - Branded logo animation (to be designed separately)
- **New components** - No new features, cleanup only
- **Backend changes** - Frontend-only scope

---

## Success Criteria

- [ ] No component files in `components/` root directory
- [ ] All icons from single source (`@tabler/icons-react`)
- [ ] `lucide-react` removed from dependencies
- [ ] Tooltips on all icon-only buttons and table headers
- [ ] Build passes with no errors
- [ ] No unused imports or dead code in touched files
