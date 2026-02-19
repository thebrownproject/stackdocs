# Layout Alignment System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a Linear-inspired 3-column alignment system across documents pages with column resizing, preview panel, and floating chat bar.

**Architecture:** All pages follow a consistent 3-column grid (checkbox | icon | content). Tables use TanStack Table's column resizing with localStorage persistence. The preview panel uses shadcn's ResizablePanelGroup. The AI chat bar becomes a floating component with rounded corners and elevation.

**Tech Stack:** TanStack Table (column resizing), shadcn/ui (resizable, table, checkbox), localStorage (persistence), Tailwind CSS

---

## Phase Overview

| Phase | File | Tasks | Description |
|-------|------|-------|-------------|
| 1 | [phase-1-global-foundation.md](./phase-1-global-foundation.md) | 1-2 | Breadcrumb icons |
| 2 | [phase-2-documents-list.md](./phase-2-documents-list.md) | 3-7 | Columns, resizing, preview panel |
| 3 | [phase-3-document-detail.md](./phase-3-document-detail.md) | 8-12 | Checkboxes, indicators, floating chat |
| 4 | [phase-4-polish-testing.md](./phase-4-polish-testing.md) | 13-14 | Skeletons and testing |

---

## Task Summary

### Phase 1: Global Foundation ✅

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| 1 | Add icons to breadcrumb component | `page-header.tsx` | ✅ |
| 2 | Support dynamic icons for document detail | `page-header.tsx`, `@header/documents/[id]/page.tsx` | ✅ |

### Phase 2: Documents List Page ✅

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| 3 | Remove Size column and pagination | `columns.tsx`, `documents-table.tsx` | ✅ |
| 4 | Implement column resizing with localStorage | `columns.tsx`, `documents-table.tsx` | ⏭️ SKIP |
| 5 | Align columns and tighten spacing | `columns.tsx`, `documents-table.tsx` | ⏭️ SKIP |
| 6 | Row click for preview vs filename click for navigate | `columns.tsx`, `documents-table.tsx` | ✅ |
| 7 | Add preview panel to documents list | `documents-table.tsx`, `@header/documents/page.tsx` | ✅ |

> **Note:** Tasks 4-5 skipped - TanStack Table column resizing conflicts with HTML table layout. Used `max-w-0` trick for dynamic truncation instead.

### Phase 3: Document Detail Page

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| 8 | Add checkboxes to extracted data table | `extracted-columns.tsx`, `extracted-data-table.tsx` | ✅ |
| 9 | Move chevron/confidence to Field column | `extracted-columns.tsx` | ✅ |
| 10 | Add column resizing to extracted data table | `extracted-data-table.tsx` | ⏭️ SKIP |
| 11 | Implement floating AI chat bar | `ai-chat-bar.tsx`, `document-detail-client.tsx` | ✅ |
| 12 | Update preview toggle to icon-only | `preview-toggle.tsx` | |

> **Note:** Task 9 changed from "column 2" to merging chevron/confidence into Field column (like documents table icon+filename pattern). Task 10 skipped - same column resizing conflict as Phase 2.

### Phase 4: Polish & Testing

| Task | Description | Files |
|------|-------------|-------|
| 13 | Update loading skeletons | `@header/documents/[id]/loading.tsx` |
| 14 | Manual testing checklist | - |

---

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `stackdocs-doc-list-columns` | Documents list column widths |
| `stackdocs-doc-list-layout` | Documents list panel sizes |
| `stackdocs-document-layout` | Document detail panel sizes (existing) |
| `stackdocs-extracted-columns` | Extracted data column widths |

---

## Related Documents

- [Design Document](./2024-12-26-layout-alignment-design.md) - Full design spec
- [Original Plan](./2024-12-26-layout-alignment-plan.md) - Complete plan (all phases)
