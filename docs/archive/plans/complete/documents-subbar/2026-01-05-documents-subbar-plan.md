# Documents Sub-bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the documents sub-bar with functional Filter, Export, Delete, Stack toggle, and SelectionActions.

**Scope:** Frontend only. Edit flow (agent) is deferred to a future task.

**Architecture:**
- Simple UI components for most actions (Export dropdown, Delete dialog, Stack checkboxes)
- Filter state managed through existing React contexts
- All database operations go through Supabase directly (not FastAPI)

**Tech Stack:** Next.js 16, shadcn/ui (AlertDialog, DropdownMenu), Sonner (toast), Supabase JS client

**Design Doc:** `2026-01-01-documents-subbar-design.md`

---

## Status: Phase 2 Complete, Redesign Planned

---

## Plan Structure

| File | Description | Tasks | Status |
|------|-------------|-------|--------|
| [01-prerequisites.md](./01-prerequisites.md) | Install Sonner toast component | 1 | ✅ |
| [02-filter-dropdown.md](./02-filter-dropdown.md) | Filter state, date utilities, dropdown UI | 2-5 | ✅ |
| [02.1-filter-redesign.md](./02.1-filter-redesign.md) | Sub-menus, pills, stacks filter | 2.1.1-2.1.8 | ⬚ |
| [03-stack-dropdown.md](./03-stack-dropdown.md) | Stack toggle with DB operations | 6-8 | ⬚ |
| [04-export-dropdown.md](./04-export-dropdown.md) | CSV/JSON export functionality | 9-10 | ⬚ |
| [05-delete-dialog.md](./05-delete-dialog.md) | Delete confirmation dialog | 11-12 | ⬚ |
| [06-selection-actions.md](./06-selection-actions.md) | Bulk delete via selection actions | 13-15 | ⬚ |

---

## Implementation Order

### Phase 1: Prerequisites (01-prerequisites.md)
1. Install Sonner toast component

### Phase 2: Filter Dropdown (02-filter-dropdown.md)
2. Extend DocumentsFilterContext with filter state
3. Implement filter dropdown UI
4. Create date boundary utilities (`lib/date.ts`) - reusable for Stacks
5. Apply filters to documents table

### Phase 3: Stack Dropdown (03-stack-dropdown.md)
6. Add getAllStacks query
7. Fetch allStacks in SubBar server component
8. Wire up stack dropdown with DB operations

### Phase 4: Export Dropdown (04-export-dropdown.md)
9. Create export dropdown component
10. Wire up export in document detail actions

### Phase 5: Delete Dialog (05-delete-dialog.md)
11. Create delete dialog component
12. Wire up delete in document detail actions

### Phase 6: Selection Actions (06-selection-actions.md)
13. Create bulk delete dialog
14. Wire up SelectionActions in documents list
15. Sync table selection with context

---

## Deferred Work

| Feature | Reason |
|---------|--------|
| Edit Flow (Agent) | Requires new agent flow implementation |
| Stack filter in Filter dropdown | Needs stacks list in documents context |
| Add to Stack bulk action | Needs stack selection modal |

---

## Success Criteria

- [ ] Filter dropdown filters documents by date and status
- [ ] Stack dropdown allows toggling stack membership via checkboxes
- [ ] Export downloads CSV or JSON extraction data
- [ ] Delete shows confirmation dialog and removes document
- [ ] Bulk selection delete works for multiple documents
