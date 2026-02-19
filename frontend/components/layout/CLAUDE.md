# Layout Components

**Purpose:** App-level layout primitives for headers, subbars, filtering, and navigation sidebar.

## Files

| File | Description |
|------|-------------|
| `page-header.tsx` | Breadcrumb navigation with route icons and optional actions |
| `sub-bar.tsx` | Secondary toolbar container with left/right slots |
| `action-button.tsx` | Small ghost button with icon, optional tooltip |
| `filter-bar.tsx` | Renders FilterButton + active filter pills (search, date, stack) |
| `filter-button.tsx` | Dropdown with search input, date/stack sub-menus (uses DocumentsFilterContext) |
| `filter-pill.tsx` | Removable filter chip showing active filter |
| `search-filter-button.tsx` | Simple search-only dropdown (generic, no context dependency) |
| `selection-actions.tsx` | Bulk actions dropdown for selected documents (Add to Stack, Delete) |
| `global-search-dialog.tsx` | Cmd+K command palette for navigation |

### sidebar/

| File | Description |
|------|-------------|
| `app-sidebar-server.tsx` | Server component - fetches stacks, renders client |
| `app-sidebar-client.tsx` | Client component - renders sidebar structure with Clerk UserButton |
| `nav-main.tsx` | Workspace nav items (Documents, Stacks) |
| `nav-projects.tsx` | Recent Stacks list with create action |
| `collapsible-section.tsx` | Reusable collapsible group with header action slot |
| `sidebar-header-menu.tsx` | Logo dropdown (settings, theme) + search/upload buttons |

## Data Flow

```
app/(app)/layout.tsx
  ├── AppSidebar (server fetches stacks -> client renders)
  ├── @header slot -> PageHeader (breadcrumbs from pathname)
  └── @subbar slot -> SubBar + FilterBar (uses DocumentsFilterContext)
```

## Key Patterns

- **Server/Client split**: AppSidebar server component fetches data, passes to client
- **Slot composition**: SubBar takes `left`/`right` ReactNode props
- **Context dependency**: FilterBar/FilterButton consume DocumentsFilterContext
- **Generic vs specific**: SearchFilterButton is context-free; FilterButton is documents-specific

## Usage

- **AppSidebar**: `app/(app)/layout.tsx` - main app layout
- **PageHeader**: `@header/` parallel route slots
- **SubBar + FilterBar**: `@subbar/documents/page.tsx`
- **ActionButton**: Used throughout subbars and detail actions
