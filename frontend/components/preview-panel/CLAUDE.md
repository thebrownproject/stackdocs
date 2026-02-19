# Preview Panel

**Purpose:** Resizable document preview panel showing PDF or OCR text with page navigation.

## Files

| File | Description |
|------|-------------|
| `index.tsx` | Barrel export (excludes PdfContent - SSR unsafe) |
| `constants.ts` | Shared constants (LOADING_MIN_HEIGHT) |
| `preview-panel.tsx` | Main orchestrator - owns page state, coordinates sub-components |
| `preview-panel-context.tsx` | App-level context: panelRef, collapsed state, active tab |
| `preview-content-context.tsx` | Component-level context: pagination state |
| `preview-container.tsx` | Tab container with PDF/Text tabs, hover controls |
| `pdf-content.tsx` | react-pdf wrapper with scaling (dynamic import, no SSR) |
| `text-content.tsx` | OCR text as Markdown |
| `preview-metadata.tsx` | Filename, size, page count, field count |
| `preview-controls.tsx` | Overlay: tab switcher, expand, download |
| `page-navigation.tsx` | Prev/next with page counter |
| `expand-modal.tsx` | Fullscreen modal (props, not context - renders in portal) |
| `hooks/use-page-keyboard-nav.ts` | Arrow key page navigation |

## Data Flow

```
SelectedDocumentContext → Documents Layout → PreviewPanel → PreviewContainer
                          (computes URLs)    (owns state)   (renders content)
```

## Key Patterns

- **Two contexts**: Panel-level (collapse, tab) vs Content-level (pagination)
- **SSR guards**: Mounted checks prevent hydration flash
- **ForceMount tabs**: Both tabs stay mounted, inactive is invisible
- **PdfContent never exported**: Dynamic import with ssr:false

## Usage

- Provider: `app/(app)/layout.tsx`
- Panel: `app/(app)/documents/layout.tsx`
- Toggle: `components/documents/preview-toggle.tsx`
