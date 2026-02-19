# Documents Page: Phase 4 - Integration & Testing

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run build, fix issues, and verify all features work end-to-end.

**Prereq:** `03-document-detail.md` | **This plan:** Tasks 21-22 | **Complete!**

**Architecture:** Server components fetch data from Supabase, pass to client table/detail components. Page header uses React Context for breadcrumbs and a portal pattern for actions. PDF viewing uses react-pdf with client-side rendering. AI chat uses SSE streaming to the existing extraction agent.

**Tech Stack:** Next.js 16, TanStack Table, shadcn/ui (table, dialog, badge, tabs, dropdown-menu, popover, checkbox, card), react-pdf, Supabase

---

## Design System: Linear-Inspired Precision

**Aesthetic Direction:** Extreme restraint. Let content speak. Every element earns its place.

**Typography:**
- Headers: `font-medium` only - never bold, never uppercase
- Table headers: `text-muted-foreground text-sm` - lowercase, understated
- IDs/codes: `font-mono text-muted-foreground text-sm` - like Linear's `BUI-1`
- Body: Default weight, generous line height

**Color Palette:**
- Base: Near-monochrome - `text-foreground` and `text-muted-foreground`
- Status icons only: Small colored dots/icons, never colored text blocks
- Backgrounds: `bg-transparent` or very subtle `hover:bg-muted/50`
- Borders: `border-border` - visible but not heavy
- **Dark mode safe colors:** Use CSS variables or explicit dark: variants for status indicators

**Spacing:**
- Rows: `py-3` minimum - content needs room to breathe
- Sections: `space-y-6` between major blocks
- Inline: `gap-3` for property pills

**Borders & Containers:**
- Tables: Single outer border, no internal row borders (use hover bg instead)
- Empty states: `border-dashed` with muted placeholder text and subtle icon
- Cards: `rounded-lg border` - subtle, not boxy

**Motion:**
- Transitions: `duration-150` - instant feel
- Hover: `bg-muted/50` - barely there
- No transforms, no scaling, no bounce

**Interactions:**
- Rows: Full clickable area, subtle bg on hover, `data-state="selected"` for selection styling
- Buttons: Ghost by default, outline for secondary, filled only for primary CTA
- Property pills: Inline badges with icons, clickable for dropdowns

---

## Phase 4: Final Integration & Testing

### Task 21: Run Build and Fix Any Issues

**Step 1: Run TypeScript check**

Run:
```bash
cd frontend && npx tsc --noEmit
```

Expected: No type errors

**Step 2: Run build**

Run:
```bash
cd frontend && npm run build
```

Expected: Build succeeds

**Step 3: Fix any errors**

If errors occur, fix them and commit:
```bash
git add -A
git commit -m "fix: resolve build errors"
```

---

### Task 22: Final Commit and Verification

**Step 1: Run the dev server and test all pages**

```bash
cd frontend && npm run dev
```

Test checklist:
- [ ] `/documents` loads with table
- [ ] Table filtering works
- [ ] Table sorting works
- [ ] Table pagination works
- [ ] Row selection works
- [ ] Clicking row navigates to detail
- [ ] `/documents/[id]` loads with data
- [ ] PDF preview loads (if PDF exists)
- [ ] Visual tab shows OCR text
- [ ] AI chat bar renders at bottom
- [ ] Loading states appear correctly

**Step 2: Final commit with summary**

```bash
git add -A
git commit -m "feat: complete documents page implementation

- Documents list page with full TanStack Table features
  - Sorting, filtering, pagination, row selection
  - Actions dropdown per row
  - Column visibility toggle
  - Empty state with icon
- Document detail page with extracted data and preview
  - Expandable nested data in dialog
  - Confidence indicators with dark mode support
- Page header system with breadcrumbs and actions
- PDF viewer with react-pdf (CDN worker for Next.js)
- Loading skeletons for both pages
- AI chat bar stub (ready for agent integration)
- Stack badges and dropdown components"
```

---

## Summary

**Components Created:**
1. `PageHeaderProvider` - React Context for breadcrumbs
2. `PageHeader` - Header with breadcrumbs and actions slot
3. `DocumentsTable` - Full TanStack Table with sorting, filtering, pagination, selection
4. `FileTypeIcon` - PDF/image icon by mime type (dark mode safe)
5. `StackBadges` - Badge chips with overflow
6. `PdfViewer` - react-pdf integration with CDN worker
7. `VisualPreview` - OCR text display with empty state
8. `PreviewPanel` - Tabs for PDF/Visual with Card wrapper
9. `ExtractedDataTable` - Field/Value/Confidence table with expandable nested data
10. `StacksDropdown` - Stack assignment dropdown
11. `DocumentDetail` - Full detail page layout
12. `AiChatBar` - Stub for agent interaction

**Pages Implemented:**
- `/documents` - Documents list with table
- `/documents/[id]` - Document detail with extraction + preview
- Loading states for both pages

**Key Improvements from Original Plan:**
1. ✅ Full TanStack Table state management (sorting, filtering, pagination, selection)
2. ✅ Row actions column with dropdown menu
3. ✅ `data-state="selected"` attribute on table rows
4. ✅ PDF worker using CDN for Next.js compatibility
5. ✅ Proper breadcrumb structure with unique keys
6. ✅ Loading skeletons for both pages
7. ✅ Filter input for documents table
8. ✅ Expandable nested data via Dialog
9. ✅ Dark mode safe confidence indicator colors
10. ✅ Empty states with icons
11. ✅ Card wrapper for tab content (shadcn pattern)
12. ✅ Lucide icons instead of Tabler (consistency with shadcn)

**Deferred for Future:**
- Edit Document dialog (field schema editing)
- Agent Response Panel (streaming output)
- Actual AI chat integration with backend
- Export functionality
- Upload functionality
