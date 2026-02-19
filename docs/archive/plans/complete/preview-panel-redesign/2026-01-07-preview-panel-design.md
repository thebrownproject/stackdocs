# Preview Panel Redesign - Design Document

**Date:** 2026-01-07
**Status:** Design Complete
**Related Issue:** #36

---

## Overview

Redesign the document preview panel to be cleaner, more informative, and inspired by Apple Finder's preview panel. Move all controls inside the preview container with hover-reveal behavior.

## Goals

1. Cleaner visual design with rounded preview container
2. More document metadata visible at a glance
3. Better PDF navigation for multi-page documents
4. Persistent state so last-viewed document shows on refresh
5. Expand modal for full-size viewing

---

## Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Controls location | Inside preview container | Cleaner, more immersive, Apple-style |
| Control visibility | Hover to reveal with gradient overlay | Clean default, discoverable on interaction |
| Tab naming | `PDF \| Text` | "Text" clearer than "Visual" or "OCR" |
| PDF navigation | Custom prev/next with existing react-pdf | Carousel overkill for single-page nav, avoids new dependency |
| Text view | Continuous scroll (no pagination) | Simpler for reading extracted text |
| Metadata | 2 lines below preview | Concise, Apple Finder inspired |
| Expand action | Modal dialog | Keeps user in context |
| Persistence | localStorage for last document ID | Consistent experience across refreshes |

---

## Component Structure

### Preview Panel Layout

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │                                 │ │  ← Default: clean preview
│ │                                 │ │
│ │      PDF or Text content        │ │
│ │      (scrollable)               │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │  ← Rounded container
│                                     │
│ invoice_march.pdf                   │  ← Line 1: filename
│ PDF · 69 KB · 3 pages · 12 fields   │  ← Line 2: metadata
└─────────────────────────────────────┘
```

### On Hover State

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │  ← Gradient overlay (top)
│ │ PDF │ Text           [⤢] [↓]   │ │  ← Tabs + Expand + Download
│ │                                 │ │
│ │      PDF or Text content        │ │
│ │                                 │ │
│ │      [←]      1/3      [→]      │ │  ← Page nav (PDF only)
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │  ← Gradient overlay (bottom)
│ └─────────────────────────────────┘ │
│                                     │
│ invoice_march.pdf                   │
│ PDF · 69 KB · 3 pages · 12 fields   │
└─────────────────────────────────────┘
```

---

## Hover Controls

### Top Bar (inside preview)
- **Left:** Tab switcher (`PDF | Text`)
- **Right:** Expand button `[⤢]`, Download button `[↓]`

### Bottom Bar (inside preview, PDF only)
- **Center:** Page navigation `[←] 1/3 [→]`

### Gradient Overlay
Semi-transparent gradient from edges to transparent center. Ensures controls are readable regardless of PDF content.

```css
/* Top gradient */
background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);

/* Bottom gradient */
background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
```

---

## Tab Views

### PDF Tab
- Uses existing `react-pdf` with custom prev/next navigation
- Single page visible at a time with page state management
- Prev/next arrows appear on hover (bottom gradient overlay)
- Content scrollable within each page (for tall PDFs)
- Responsive to ResizablePanel width changes via ResizeObserver

### Text Tab
- Continuous scroll of all extracted text
- No page navigation (single scrollable block)
- Same expand/download buttons available
- Monospace or readable font for text content

---

## Metadata Section

Two lines below the preview container:

**Line 1:** Filename
- `font-medium` weight
- `text-foreground` color
- Truncate with ellipsis if too long

**Line 2:** Document details
- `text-sm text-muted-foreground`
- Dot-separated: `PDF · 69 KB · 3 pages · 12 fields`
- When not extracted: `PDF · 69 KB · 3 pages · Not extracted`

### Extraction Status Display
- **When extracted:** Show field count (e.g., "12 fields")
- **When not extracted:** Show "Not extracted" (potentially styled as clickable to trigger extraction)

---

## Expand Modal

Full-screen modal for larger document viewing.

```
┌─────────────────────────────────────────────────────────┐
│                                                     [X] │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  │                                                   │  │
│  │                  PDF Content                      │  │
│  │                  (scrollable)                     │  │
│  │                                                   │  │
│  │                [←]  1 / 3  [→]                    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  invoice_march.pdf                              [↓]     │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- 90vh height, responsive width (max-w-4xl or similar)
- Same page navigation as preview (reuse `page-navigation.tsx`)
- Filename at bottom for context
- Download button available
- Close: Click outside, X button, or Escape key
- Keyboard navigation: ← → for pages

---

## Persistent State

### Last Viewed Document
Persist `selectedDocId` to localStorage so the last viewed document shows on page refresh.

**Implementation approach:** Extend `SelectedDocumentContext` with localStorage (same pattern as `PreviewPanelContext`).

```typescript
// On mount - restore last selected doc
useEffect(() => {
  const lastDocId = localStorage.getItem('stackdocs-last-document')
  if (lastDocId) setSelectedDocId(lastDocId)
}, [])

// On change - save to localStorage
useEffect(() => {
  if (selectedDocId) {
    localStorage.setItem('stackdocs-last-document', selectedDocId)
  }
}, [selectedDocId])
```

**Edge case:** If stored document was deleted, gracefully fall back to empty state.

---

## Empty State

When no document is selected (first-time user or deleted document fallback):

Simple text: "Select a document to preview"

**Future:** Reusable `EmptyState` component (tracked in issue #41)

---

## Loading State

Spinner while PDF loads (existing implementation sufficient for now).

---

## Technical Notes

### shadcn Components Used
- `Tabs` / `TabsList` / `TabsTrigger` - PDF/Text switcher (already using)
- `Dialog` - Expand modal (already have)
- `Button` - Action buttons (expand, download, prev/next)

### No New Dependencies
- **Not using Carousel** - overkill for single-page PDF navigation
- Keep existing `react-pdf` pattern with custom prev/next buttons
- Use Tailwind `group-hover` for hover-reveal (already used in codebase)

### Responsive Behavior
- Preview container fills available width in ResizablePanel
- ResizeObserver handles PDF scaling on panel resize (existing pattern)
- Metadata truncates gracefully on narrow panels

### Accessibility
- Keyboard navigation for pages (← →)
- Escape to close modal
- Focus management in modal
- ARIA labels on icon buttons

---

## Recommended Component Structure

```
frontend/components/documents/preview-panel/
├── index.tsx                 # Main export, re-exports PreviewPanel
├── preview-panel.tsx         # Main container, orchestrates state
├── preview-container.tsx     # Rounded container with hover-reveal logic
├── preview-controls.tsx      # Top bar: tabs + expand + download buttons
├── page-navigation.tsx       # Bottom bar: prev/page/next (reusable)
├── pdf-content.tsx           # PDF rendering (wraps existing react-pdf)
├── text-content.tsx          # Text/markdown rendering
├── expand-modal.tsx          # Full-size dialog
└── preview-metadata.tsx      # Filename + details below preview
```

**Rationale:**
- **Separation of concerns** - Each component has single responsibility
- **Reusability** - `page-navigation.tsx` used in both preview and modal
- **Testability** - Smaller components easier to test
- **Gradual refactor** - Extract pieces incrementally from current implementation

---

## Code Examples

### Hover-Reveal Container Pattern

```tsx
<div
  className="group relative rounded-lg overflow-hidden bg-muted"
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>
  {/* Top controls - fade in on hover */}
  <div className={cn(
    "absolute inset-x-0 top-0 z-10",
    "flex items-center justify-between p-3",
    "bg-gradient-to-b from-black/60 via-black/30 to-transparent",
    "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
  )}>
    <TabsList>
      <TabsTrigger value="pdf">PDF</TabsTrigger>
      <TabsTrigger value="text">Text</TabsTrigger>
    </TabsList>
    <div className="flex gap-2">
      <Button variant="ghost" size="icon">
        <IconMaximize className="size-4 text-white" />
      </Button>
      <Button variant="ghost" size="icon">
        <IconDownload className="size-4 text-white" />
      </Button>
    </div>
  </div>

  {/* Content area */}
  <div className="aspect-[3/4]">
    {/* PDF or Text content */}
  </div>

  {/* Bottom controls - PDF only, fade in on hover */}
  {isPdf && numPages > 1 && (
    <div className={cn(
      "absolute inset-x-0 bottom-0 z-10",
      "flex items-center justify-center gap-4 py-3",
      "bg-gradient-to-t from-black/60 via-black/30 to-transparent",
      "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
    )}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
        disabled={pageNumber <= 1}
      >
        <IconChevronLeft className="size-4 text-white" />
      </Button>
      <span className="text-sm text-white tabular-nums">
        {pageNumber} / {numPages}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
        disabled={pageNumber >= numPages}
      >
        <IconChevronRight className="size-4 text-white" />
      </Button>
    </div>
  )}
</div>
```

### Expand Modal Pattern

```tsx
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

function ExpandModal({
  open,
  onOpenChange,
  pdfUrl,
  currentPage,
  totalPages,
  onPageChange,
  filename,
  onDownload,
}: ExpandModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl h-[90vh] flex flex-col"
        showCloseButton={true}
      >
        {/* Visually hidden but accessible title */}
        <DialogTitle className="sr-only">
          Document Preview
        </DialogTitle>

        {/* PDF viewer (larger version) */}
        <div className="flex-1 overflow-auto rounded-lg bg-muted">
          <PdfViewer url={pdfUrl} page={currentPage} />
        </div>

        {/* Footer: filename + page nav + download */}
        <div className="flex items-center justify-between pt-4">
          <span className="text-sm font-medium truncate">
            {filename}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <IconChevronLeft className="size-4" />
              </Button>
              <span className="text-sm tabular-nums w-16 text-center">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <IconChevronRight className="size-4" />
              </Button>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={onDownload}>
            <IconDownload className="size-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Tab Restructuring Pattern

```tsx
// Current: Tabs wrapper with header bar
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>...</TabsList>  {/* In header bar */}
  <TabsContent value="pdf">...</TabsContent>
  <TabsContent value="text">...</TabsContent>
</Tabs>

// New: Tabs wrapper with controls inside preview
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <div className="group relative rounded-lg overflow-hidden">
    {/* Hover overlay with TabsList inside */}
    <div className="absolute ... opacity-0 group-hover:opacity-100">
      <TabsList>
        <TabsTrigger value="pdf">PDF</TabsTrigger>
        <TabsTrigger value="text">Text</TabsTrigger>
      </TabsList>
      {/* Action buttons */}
    </div>

    {/* Content fills the container */}
    <TabsContent value="pdf" className="m-0">
      <PdfContent ... />
    </TabsContent>
    <TabsContent value="text" className="m-0">
      <TextContent ... />
    </TabsContent>
  </div>
</Tabs>
```

---

## Implementation Considerations

### Gotchas to Watch For

1. **Tab state vs content visibility** - With Tabs moved inside, ensure `TabsContent` fills container correctly. May need `m-0` to remove default margins.

2. **Gradient colors** - `from-black/60` works on light PDFs. For dark theme, consider `from-background/80` variant.

3. **Button styling on overlay** - Default variants assume solid backgrounds. May need `text-white` or custom "overlay" variant for visibility.

4. **Keyboard accessibility** - Add left/right arrow key handlers for page navigation in both preview and modal.

5. **PDF scaling on resize** - Preserve existing ResizeObserver pattern in refactor.

6. **Text tab hides page nav** - Conditionally render bottom controls based on active tab.

7. **Modal syncs with preview page** - If user is on page 3 in preview, modal opens to page 3. Lift page state appropriately.

8. **SSR with react-pdf** - Preserve existing dynamic import pattern (`next/dynamic`).

---

## Inspiration References

- **Apple Finder preview panel** - Rounded container, metadata below, hover controls
- **Linear sidebar** - Clean property display
- **shadcn File Manager example** - Info panel pattern

---

## Out of Scope

- Thumbnail strip for page navigation (saves vertical space)
- Extracted fields in expand modal (keep simple)
- Text tab download as .txt (users want CSV/JSON exports)
- Complex empty state illustrations (future #41)
