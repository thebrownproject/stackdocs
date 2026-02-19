# Stacks Feature Implementation Plan [ARCHIVED]

> **MIGRATED TO BEADS:** Remaining tasks have been migrated to Beads issue tracker as epic `stackdocs-4z3`.
> Phases 1-2 are complete. Phase 3 deferred tasks (pending indicator, CSV export) are now in Beads.
> Use `bd show stackdocs-4z3` to view the epic and its child tasks.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Stacks UI feature - pages and tables that mirror Documents, with Supabase direct queries.

**Scope:** Frontend only. Agent integration and chat bar redesign are separate features (see `docs/plans/todo/`).

**Architecture:**
- Frontend: Next.js 16 App Router with parallel routes, TanStack Table
- Database: Supabase direct (existing tables: stacks, stack_documents, stack_tables, stack_table_rows)

**Tech Stack:** Next.js 16, TanStack Table v8, Supabase JS, shadcn/ui

---

## Status: Mostly Complete (2025-12-30)

Phases 1-2 complete. Phase 3 partially complete - remaining tasks deferred until Stack Agent is built.

---

## Plan Structure

| File | Description | Status |
|------|-------------|--------|
| [01-foundation.md](./01-foundation.md) | Types, Supabase queries, sidebar integration | ✅ Complete |
| [02-stack-pages.md](./02-stack-pages.md) | Stacks list page, stack detail page with tabs | ✅ Complete |
| [03-stack-tables.md](./03-stack-tables.md) | Table view component, dynamic columns, CSV export | 🟡 Partial |

---

## Implementation Order

### Phase 1: Foundation (01-foundation.md) ✅
1. ✅ Type definitions for stacks
2. ✅ Supabase query functions
3. ✅ Sidebar integration with dynamic stacks

### Phase 2: Frontend Pages (02-stack-pages.md) ✅
4. ✅ Stacks list page
5. ✅ Stack detail page with tabs
6. ✅ Header parallel routes (using existing PageHeader)

### Phase 3: Stack Table View (03-stack-tables.md) 🟡
7. ✅ StackTableView component with dynamic columns
8. ⏸️ "Not extracted" indicator for pending docs (deferred - needs Stack Agent)
9. ⏸️ CSV export functionality (deferred - needs data to export)
10. ⏸️ Barrel export for stacks components (optional polish)

---

## Deferred Tasks

These tasks are blocked until Stack Agent is implemented:

| Task | Reason |
|------|--------|
| "Not extracted" indicator | Needs agent to populate `stack_table_rows` |
| CSV export | No meaningful data to export without agent |
| Barrel export | Optional polish, can add anytime |

---

## Future Work (separate plans)

| Feature | Location |
|---------|----------|
| Stack Agent (extraction, tools) | `docs/plans/todo/stack-agent/` |
| Agent UI Refactor (chat bar) | `docs/plans/todo/agent-ui-refactor/` ← **Next priority** |

---

## Success Criteria (MVP)

- [x] Stacks appear in sidebar with document counts
- [x] Stacks list page shows all stacks as cards
- [x] Stack detail page has Documents tab and Table tabs
- [x] Table view shows spreadsheet with document column
- [ ] Pending documents show "not extracted" indicator (deferred)
- [ ] Export to CSV works (deferred)
