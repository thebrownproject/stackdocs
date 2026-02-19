# Documents Components

**Purpose:** Components for the documents list and detail pages, including tables, filters, dialogs, and context providers.

## Files

| File | Description |
|------|-------------|
| `documents-table.tsx` | Main table for `/documents` list (TanStack Table, row click opens preview) |
| `columns.tsx` | Column definitions for documents table (filename, stacks, date) |
| `documents-filter-context.tsx` | Context for list page: search, date/stack filters, row selection sync |
| `selected-document-context.tsx` | Global context for selected doc ID, signed URL, metadata, extracted fields |
| `document-detail-client.tsx` | Client wrapper for `/documents/[id]` page (realtime updates, context sync) |
| `document-detail-sub-bar.tsx` | SubBar for detail page (field search, bulk actions, document actions) |
| `document-detail-filter-context.tsx` | Context for detail page: field search, field selection sync |
| `document-detail-actions.tsx` | Action buttons composition (stacks, edit, export, delete) |
| `extracted-data-table.tsx` | Hierarchical table for extracted fields with expand/collapse |
| `extracted-columns.tsx` | Column definitions for extracted data (field, value, confidence dot) |
| `export-dropdown.tsx` | Export extraction data as CSV/JSON with download |
| `stacks-dropdown.tsx` | Assign/unassign document to stacks via picker |
| `delete-dialog.tsx` | Single document delete with AlertDialog |
| `bulk-delete-dialog.tsx` | Multi-document delete from list selection |
| `bulk-delete-fields-dialog.tsx` | Delete selected fields from extraction data |
| `preview-toggle.tsx` | Toggle button for preview panel visibility |

## Data Flow

```
SelectedDocumentProvider (app layout - global)
    |
    +-- DocumentsFilterProvider (list page filters/selection)
    |       |
    |       +-- DocumentsTable --> row click --> setSelectedDocId
    |
    +-- DocumentDetailFilterProvider (detail page filters/selection)
            |
            +-- ExtractedDataTable --> field selection --> context
```

**Bidirectional selection sync:** Tables register `resetRowSelection` callbacks with context so "clear selection" works both ways.

## Key Patterns

- **Context + Parallel Routes**: Filter contexts bridge SubBar (parallel route) and page content
- **TanStack Table**: Both tables use column defs, sorting, filtering, row selection
- **Realtime Updates**: `useExtractionRealtime` hook updates extracted fields with highlight animation
- **Signed URL Caching**: `signedUrlDocId` prevents re-fetching URL for same document

## Usage

- **List page** (`/documents`): `DocumentsTable`, `PreviewToggle`, filters in `@subbar/documents/page.tsx`
- **Detail page** (`/documents/[id]`): `DocumentDetailClient`, `DocumentDetailSubBar`, `PreviewToggle`
- **Providers**: Wrapped in `app/(app)/layout.tsx` for cross-route state sharing
