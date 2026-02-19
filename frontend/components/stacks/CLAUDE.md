# Stacks Components

**Purpose:** UI components for the stacks feature - listing stacks, viewing stack details, and displaying extracted table data.

## Files

| File | Description |
|------|-------------|
| `stacks-list.tsx` | Card grid displaying all stacks with doc/table counts, consumes filter context |
| `stacks-filter-context.tsx` | Context provider for stacks list search filter (shared between subbar and list) |
| `stack-detail-client.tsx` | Stack detail content switcher - renders Docs tab or Table view based on URL |
| `stack-detail-sub-bar.tsx` | SubBar with tab navigation (Docs + tables), search, and context-sensitive actions |
| `stack-detail-filter-context.tsx` | Context for stack detail search + selection state (shared between subbar and content) |
| `stack-documents-tab.tsx` | TanStack Table showing documents in a stack with selection, sorting, filtering |
| `stack-table-view.tsx` | TanStack Table rendering extracted row data from a stack table |
| `stack-table-columns.tsx` | Dynamic column definitions for stack tables (select, document, schema-defined columns) |

## Data Flow

```
app/(app)/layout.tsx
└── StacksFilterProvider / StackDetailFilterProvider (contexts wrap all routes)

/stacks (list)
├── @subbar/stacks/page.tsx → uses useStacksFilter() to set search
└── stacks/page.tsx → StacksList consumes filterValue

/stacks/[id] (detail)
├── @subbar/stacks/[id]/page.tsx → StackDetailSubBar sets tab, search, shows selection
└── stacks/[id]/page.tsx → StackDetailClient renders active tab content
    ├── StackDocumentsTab (when tab=documents)
    └── StackTableView (when tab=table&table=<id>)
```

## Key Patterns

- **Filter contexts**: Shared state between @subbar parallel route and page content
- **URL-driven tabs**: `?tab=documents` or `?tab=table&table=<uuid>` controls active view
- **TanStack Table**: Both document and table views use same sorting/selection patterns
- **Dynamic columns**: `createStackTableColumns()` builds columns from `StackTableColumn[]` schema
- **Confidence dots**: Color-coded indicators (green/amber/red) for extraction confidence scores

## Usage

- **List page**: `app/(app)/stacks/page.tsx` renders `StacksList`
- **Detail page**: `app/(app)/stacks/[id]/page.tsx` renders `StackDetailClient`
- **Subbars**: `app/(app)/@subbar/stacks/` routes render `StackDetailSubBar`
- **Providers**: Wrapped at `app/(app)/layout.tsx` level
