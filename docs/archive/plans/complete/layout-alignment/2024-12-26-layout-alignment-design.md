# Layout Alignment System - Design Document

**Date:** 2024-12-26
**Status:** Design Complete
**Scope:** Documents list page, Document detail page, Global alignment system

---

## Overview

Implement a Linear-inspired alignment system across the documents pages to create visual consistency. All icons, checkboxes, and content align to a 3-column grid system.

---

## Global Alignment System

### 3-Column Grid

Every page follows the same vertical alignment:

| Column | Contains | Examples |
|--------|----------|----------|
| **Col 1** | Toggle/Checkboxes | Sidebar trigger, row selection checkboxes |
| **Col 2** | Icons | Breadcrumb icons, Filter icon, PDF icons, chevrons, confidence circles |
| **Col 3** | Text content | Breadcrumb text, button labels, "Name" header, filenames, field names |

```
Col 1            Col 2           Col 3
[Sidebar toggle] [Doc icon]      Documents  >  [PDF icon] invoice.pdf
                 [Filter icon]   Filter        [Search icon] Search
[Checkbox]       [PDF icon]      invoice.pdf                          [Date]
[Checkbox]       [PDF icon]      receipt.pdf                          [Date]
```

### Breadcrumbs with Icons

Add icons to breadcrumb items:

- **Documents** → `FileText` icon
- **Document detail** → File type icon (PDF, image, etc.) + filename
- Icons align with Col 2

---

## Documents List Page

### Header

- Breadcrumb with Documents icon (left)
- Preview toggle: **icon-only** button (right) - remove "Preview" text

### Sub-bar

No changes - Filter, Search, Actions, Upload buttons remain.

### Table Structure

**Remove:**
- Size column (not useful)
- Pagination footer (document count + Previous/Next buttons)

**Columns:**
```
[Checkbox] [Icon] Name (resizable) | Stacks (resizable) | Date (fixed, right-aligned)
```

- **Checkbox (Col 1):** Appears on hover, stays visible when selected
- **Icon (Col 2):** File type icon (PDF, image, etc.)
- **Name (Col 3):** Document filename, resizable
- **Stacks:** Stack badges, resizable
- **Date:** Fixed width, pushed to right edge

**Column widths:** Persist to localStorage on resize.

### Row Interactions

| Element | Cursor | Hover Effect | Click Action |
|---------|--------|--------------|--------------|
| Row (general) | `default` | Light gray background | Show preview in sidebar |
| Checkbox | `pointer` | - | Toggle selection |
| Filename | `pointer` | Underline | Navigate to detail page |

**Row highlighting:**
- When preview is open, clicked row stays highlighted (selected state)
- When preview is closed, highlight is removed

### Preview Panel

Add resizable preview panel (reuse existing `PreviewPanel` component):

- Same implementation as document detail page
- ResizablePanelGroup with table on left, preview on right
- Panel sizes persist to localStorage
- Preview toggle in header controls collapse/expand

---

## Document Detail Page

### Header

- Breadcrumb: `[Doc icon] Documents > [PDF icon] filename.pdf`
- Preview toggle: icon-only button (right)

### Sub-bar

No changes - Filter, Search, Stacks/Edit/Export remain.

### Extracted Data Table

**Current columns:** Field | Value | Conf.

**New columns:**
```
[Checkbox] [Chevron/Confidence] Field | Value
```

- **Checkbox (Col 1):** For bulk actions on fields, appears on hover, stays when selected
- **Col 2:** Chevron OR Confidence circle (same position)
  - Expandable rows → Chevron (▶/▼)
  - Leaf rows (single values) → Confidence circle
- **Field (Col 3):** Field name
- **Value:** Field value, resizable

**Confidence display:**
- Colored circle with percentage (traffic light: green/yellow/red)
- Hidden by default
- Shows on row hover
- Shows persistently when checkbox is selected

**Column widths:** Persist to localStorage on resize.

### AI Chat Bar

**Current:** Inline bar, same height as nav header, edge-to-edge.

**New:** Floating bar design (like Claude/OpenAI/Perplexity):

- Rounded corners
- Margins from edges (not edge-to-edge)
- Subtle elevation (shadow or border)
- Spans full width below both panels

**Layout structure:**
```
┌─────────────────────────────────────────────────┐
│  Header: breadcrumb                    Preview  │
├─────────────────────────────────────────────────┤
│  Sub-bar: Filter, Search...      Stacks/Edit   │
├─────────────────────┬───────────────────────────┤
│                     │                           │
│  Extracted Data     │      PDF Preview          │
│                    ←│→                          │
│                     │                           │
├─────────────────────┴───────────────────────────┤
│                                                 │
│   ┌───────────────────────────────────────┐     │
│   │  Ask AI to correct or refine...    ↵  │     │
│   └───────────────────────────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

- ResizablePanelGroup contains only the two panels
- Resize handle stops above the chat bar
- Chat bar sits in its own container with padding

---

## Technical Details

### Column Resizing (TanStack Table)

```tsx
const table = useReactTable({
  enableColumnResizing: true,
  columnResizeMode: 'onChange',
  onColumnSizingChange: (updater) => {
    setColumnSizing((old) => {
      const newSizing = typeof updater === 'function' ? updater(old) : updater
      localStorage.setItem('table-column-sizing', JSON.stringify(newSizing))
      return newSizing
    })
  },
  state: {
    columnSizing: savedColumnSizing,
  },
})
```

### localStorage Keys

| Key | Purpose |
|-----|---------|
| `stackdocs-doc-list-columns` | Documents list column widths |
| `stackdocs-doc-list-layout` | Documents list panel sizes |
| `stackdocs-document-layout` | Document detail panel sizes (existing) |
| `stackdocs-extracted-columns` | Extracted data column widths |

### Spacing Tightening

Current spacing between checkbox and icon is too wide. Reduce to create tighter alignment:

- Checkbox cell: minimal padding
- Icon cell: minimal left padding
- Content starts immediately after icon

---

## Summary of Changes

### Documents List Page
- [ ] Add Documents icon to breadcrumb
- [ ] Preview toggle: icon-only
- [ ] Remove Size column
- [ ] Remove pagination footer
- [ ] Add resizable preview panel
- [ ] Column resizing for Name, Stacks (Date fixed right)
- [ ] localStorage persistence for column widths
- [ ] Row click → preview, filename click → navigate
- [ ] Filename: underline + pointer on hover
- [ ] Row: default cursor
- [ ] Tighten checkbox-to-icon spacing
- [ ] Align "Name" header with filename text (not icon)

### Document Detail Page
- [ ] Add icons to breadcrumb (Documents + file type)
- [ ] Add checkboxes to extracted data table
- [ ] Move chevrons to Col 2
- [ ] Confidence circle in Col 2 for leaf rows (hover/selected visibility)
- [ ] Remove Conf. column, show inline
- [ ] Column resizing for Field, Value
- [ ] localStorage persistence for column widths
- [ ] Floating AI chat bar with rounded corners, margins, elevation

### Global
- [ ] 3-column alignment system applied consistently
- [ ] Breadcrumbs with icons throughout

---

## Out of Scope

- Stacks page layout (future)
- Mobile responsiveness adjustments
- Keyboard navigation for row selection
