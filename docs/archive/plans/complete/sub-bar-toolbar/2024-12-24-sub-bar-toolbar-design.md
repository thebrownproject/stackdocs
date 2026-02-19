# Linear-Style Sub-bar Toolbar Design

**Date:** 2024-12-24
**Updated:** 2024-12-24 (brainstorm session)
**Status:** Design Complete
**Feature:** Sub-bar toolbar for documents pages

---

## Overview

Add a Linear-style sub-bar below the main header on both documents list and document detail pages. Creates clear separation between navigation/layout controls (main header) and view options/data actions (sub-bar).

---

## Layout Structure

**Pattern:**
- Main header = Navigation + layout controls
- Sub-bar = View options (left) + data actions (right)
- Both bars are `h-12` (48px)

### Documents List Page

```
┌─────────────────────────────────────────────────────────────┐
│ Documents                                                   │ ← Main Header (h-12)
├─────────────────────────────────────────────────────────────┤
│ [Filter] [🔍]                    [2 selected ▾] [Upload]    │ ← Sub-bar (h-12)
├─────────────────────────────────────────────────────────────┤
│ □ Name                          Stacks    Size    Date      │
│ ☐ invoice.pdf                   —         224 KB  Today     │
│ ☐ receipt.pdf                   —         83 KB   Yesterday │
└─────────────────────────────────────────────────────────────┘
```

- **Main header left:** "Documents" title
- **Main header right:** Empty (clean, consistent pattern)
- **Sub-bar left:** Filter button (fixed) + Search pill (expandable)
- **Sub-bar right:** Selection count + Actions (when selected) + Upload button

### Document Detail Page

```
┌─────────────────────────────────────────────────────────────┐
│ Documents > invoice.pdf                          [Preview]  │ ← Main Header (h-12)
├─────────────────────────────────────────────────────────────┤
│ [Filter] [🔍]                    [Stacks ▾] [Edit] [Export] │ ← Sub-bar (h-12)
├─────────────────────────────────────────────────────────────┤
│ Field          Value                        Conf.  │ Preview│
│ Doc Name       invoice.pdf                  100%   │  PDF   │
└─────────────────────────────────────────────────────────────┘
```

- **Main header left:** Breadcrumbs (Documents > filename.pdf)
- **Main header right:** Preview toggle only (layout control)
- **Sub-bar left:** Filter button (fixed) + Search pill (expandable)
- **Sub-bar right:** Stacks dropdown, Edit button, Export button

---

## Components

### Sub-bar Container

Reusable layout component with left/right slots. Rendered **in page content** (inside `DocumentsTable`/`DocumentDetailClient`), not in the `@header` parallel route.

**Why in page content:** The sub-bar controls page state (filters, selection count) which lives in client components. Keeping sub-bar close to its data avoids prop drilling or context complexity.

**Location:** `components/documents/sub-bar.tsx`

```tsx
<SubBar
  left={<><FilterButton /><InputGroup>...</InputGroup></>}
  right={<>...page-specific actions...</>}
/>
```

### Search Input

Uses **shadcn InputGroup** component (not a custom expandable). Always visible with search icon.

**Location:** Inline using `@shadcn/input-group` (install required)

```tsx
<InputGroup>
  <InputGroupInput placeholder="Search documents..." />
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
</InputGroup>
```

**Note:** Expandable search (collapse to icon, expand on click) deferred as nice-to-have polish.

### Filter Button

Separate component using **shadcn Button + DropdownMenu**. Placeholder for future filter functionality.

**Location:** `components/documents/filter-button.tsx`

**Current:** Opens shadcn DropdownMenu with "Coming soon" disabled item

**Future filter options:**

| Page | Potential Filters |
|------|-------------------|
| Documents List | By stack, document type, date range, file size |
| Document Detail | By confidence level, field type |

### Row Selection (Documents List)

Linear-style checkbox selection with bulk actions.

**Behavior:**
- Checkboxes hidden by default
- Checkboxes appear on row hover
- Select a row → right side reveals selection count + Actions
- Deselect all → right side hides selection UI

```
Nothing selected:              2 rows selected:
[Filter] [🔍]      [Upload]    [Filter] [🔍]   [2 selected ▾] [Upload]
```

**Actions dropdown:**
- Delete
- Add to Stack
- (future: Export selected)

### Document Detail Actions

Always visible in sub-bar right:

- **Stacks dropdown:** Assign/remove document from stacks
- **Edit button:** Enable inline editing of extracted fields
- **Export button:** Download as JSON/CSV

---

## Bug Fix: Table Scroll

**Issue:** Cannot scroll in document detail TanStack table (possibly documents list too)

**Investigation needed:**
- Check container overflow settings
- Ensure table scrolls within its container, not the whole page
- May need `overflow-auto` on table container with fixed height

---

## Skeleton Updates

Update loading skeletons to match new layout:

**Documents list skeleton:**
- Add sub-bar skeleton row
- Adjust table skeleton position

**Document detail skeleton:**
- Add sub-bar skeleton row
- Adjust content skeleton position

---

## Files to Create/Modify

### Install shadcn Component
- `npx shadcn@latest add input-group` - InputGroup for search inputs

### New Components (all in `components/documents/`)
- `sub-bar.tsx` - Sub-bar container with left/right slots
- `filter-button.tsx` - Filter button + dropdown (uses shadcn Button + DropdownMenu)
- `selection-actions.tsx` - Selection count + actions dropdown
- `document-detail-actions.tsx` - Stacks/Edit/Export for detail page

### Modified Files
- `frontend/app/(app)/@header/documents/page.tsx` - Remove Upload from header
- `frontend/app/(app)/@header/documents/[id]/page.tsx` - Keep only Preview toggle
- `frontend/components/documents/documents-table.tsx` - Add sub-bar, row selection, remove old filter
- `frontend/components/documents/columns.tsx` - Add selection column with hover-visible checkboxes
- `frontend/components/documents/document-detail-client.tsx` - Add sub-bar, move actions from header
- `frontend/components/documents/extracted-data-table.tsx` - Fix scroll, add search filter

---

## Design Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Actions in sub-bar vs header | Sub-bar | Clear separation: header = navigation/layout, sub-bar = data actions |
| Filter then Search order | Filter first | Search expands into free space, doesn't push other elements |
| Checkboxes on hover | Yes | Cleaner UI, matches Linear pattern |
| Selection UI location | Sub-bar right | No floating elements, consistent placement |
| Upload button location | Sub-bar | It's a data action, belongs with other actions |
| Search component | shadcn InputGroup | Use shadcn primitives, expandable deferred as polish |
| Filter button component | Separate file in `components/documents/` | Reusable, uses shadcn Button + DropdownMenu |
| Sub-bar placement | In page content, not @header | Sub-bar controls client state (filters, selection) - keep close to data |
| Custom components location | `components/documents/` not `components/ui/` | `ui/` reserved for shadcn primitives only |

---

## Out of Scope

- Actual filter functionality (placeholder only)
- Saved views / view tabs
- Keyboard shortcuts for search (Cmd+K)
- Bulk export functionality
