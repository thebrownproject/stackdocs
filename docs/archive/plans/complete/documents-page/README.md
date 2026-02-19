# Documents Page Implementation

> **For Claude:** Read this file first before starting any phase. Check off completed tasks as you go.

## Overview

Build the documents list page and document detail page with extracted data viewing, PDF preview, and AI-powered editing.

**Tech Stack:** Next.js 16, TanStack Table, shadcn/ui, react-pdf, Supabase

---

## Progress Tracker

### Phase 1: Foundation (`01-foundation.md`) ✅
Install shadcn components and create page header system with breadcrumbs.

- [x] **Task 1:** Install required shadcn components (table, dialog, badge, tabs, popover, checkbox, card) + TanStack Table
- [x] **Task 2:** Create page header system (used `usePathname` approach instead of Context - simpler)
- [x] **Task 3:** Integrate page header into app layout

---

### Phase 2: Documents List (`02-documents-list.md`) ✅
Build the documents list page with TanStack Table, types, and data fetching.

- [x] **Task 4:** Create document type definitions
- [x] **Task 5:** Create data fetching function (`getDocumentsWithStacks`)
- [x] **Task 6:** Create FileTypeIcon component
- [x] **Task 7:** Create StackBadges component
- [x] **Task 8:** Create DocumentsTable component (sorting, filtering, pagination - no checkboxes/actions for MVP)
- [x] **Task 9:** Create DocumentsList client wrapper
- [x] **Task 10:** Create loading state for documents page
- [x] **Task 11:** Update documents page to fetch and display data

---

### Phase 3: Document Detail (`03-document-detail.md`)
Build the document detail page with PDF viewer, extraction table, and AI chat bar.

- [ ] **Task 12:** Install react-pdf
- [ ] **Task 13:** Create PdfViewer component (CDN worker for Next.js)
- [ ] **Task 14:** Create VisualPreview component (OCR text display)
- [ ] **Task 15:** Create PreviewPanel component (tabs for PDF/Visual)
- [ ] **Task 16:** Create ExtractedDataTable component (expandable nested data)
- [ ] **Task 17:** Create StacksDropdown component
- [ ] **Task 18:** Create DocumentDetail client component
- [ ] **Task 19:** Create AiChatBar component (stub)
- [ ] **Task 20:** Create document detail page and loading state

---

### Phase 4: Integration & Testing (`04-integration.md`)
Run build, fix issues, and verify all features work end-to-end.

- [ ] **Task 21:** Run build and fix any issues
- [ ] **Task 22:** Final verification and commit

---

## Components Created

| Component | File | Purpose |
|-----------|------|---------|
| `PageHeader` | `components/layout/page-header.tsx` | Auto-generates breadcrumbs from URL via `usePathname` |
| `DocumentsTable` | `components/documents/documents-table.tsx` | TanStack Table with full features |
| `FileTypeIcon` | `components/file-type-icon.tsx` | PDF/image icon by mime type |
| `StackBadges` | `components/stack-badges.tsx` | Badge chips with overflow |
| `PdfViewer` | `components/pdf-viewer.tsx` | react-pdf integration |
| `VisualPreview` | `components/visual-preview.tsx` | OCR text display |
| `PreviewPanel` | `components/documents/preview-panel.tsx` | Tabs for PDF/Visual |
| `ExtractedDataTable` | `components/documents/extracted-data-table.tsx` | Field/Value/Confidence table |
| `StacksDropdown` | `components/documents/stacks-dropdown.tsx` | Stack assignment dropdown |
| `DocumentDetail` | `components/documents/document-detail.tsx` | Full detail page layout |
| `AiChatBar` | `components/documents/ai-chat-bar.tsx` | Agent interaction stub |

---

## Pages Implemented

| Route | File | Purpose |
|-------|------|---------|
| `/documents` | `app/(app)/documents/page.tsx` | Documents list with table |
| `/documents/[id]` | `app/(app)/documents/[id]/page.tsx` | Document detail with extraction + preview |

---

## Deferred for Future

- Edit Document dialog (field schema editing)
- Agent Response Panel (streaming output)
- Actual AI chat integration with backend
- Export functionality
- Upload functionality
