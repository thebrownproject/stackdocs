# Preview Panel Redesign - Phase 3: Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the document preview panel with Apple Finder-inspired aesthetics, hover-reveal controls, metadata display, expand modal, and localStorage persistence.

**Architecture:** Refactor existing `preview-panel.tsx` into modular components under `preview-panel/` folder. Build leaf components first (metadata, page-nav, controls), then container components, then integrate. TDD approach with frequent commits.

**Tech Stack:** React, TypeScript, shadcn/ui (Tabs, Dialog, Button), Tailwind CSS, react-pdf, localStorage

---

## Phase 6: Integration (Tasks 13-14)

### Task 13: Update Documents Layout to Use New PreviewPanel

**Files:**
- Modify: `frontend/app/(app)/documents/layout.tsx`

**Step 1: Update imports**

The import path stays the same - Next.js/TypeScript will resolve the barrel export at `preview-panel/index.tsx`:
```typescript
import { PreviewPanel } from '@/components/documents/preview-panel'
```

> **Note:** No trailing slash needed. The bundler resolves `preview-panel` to `preview-panel/index.tsx` automatically.

**Step 2: Get additional context values**

Update line 18 to include new fields:
```typescript
  const { signedUrl, ocrText, mimeType, selectedDocId, signedUrlDocId, filename, fileSize, pageCount, extractedFields } = useSelectedDocument()
```

**Step 3: Update PreviewPanel props**

Change lines 69-73 from:
```typescript
            <PreviewPanel
              pdfUrl={effectivePdfUrl}
              ocrText={effectiveOcrText}
              mimeType={mimeType}
            />
```
to:
```typescript
            <PreviewPanel
              pdfUrl={effectivePdfUrl}
              ocrText={effectiveOcrText}
              mimeType={mimeType}
              filename={filename}
              fileSize={fileSize}
              pageCount={pageCount}
              extractedFields={extractedFields}
            />
```

**Step 4: Verify build passes and test**

Run: `cd frontend && npm run build`
Expected: Build succeeds

Run app and test:
- Preview panel shows with new design
- Hover reveals controls
- Tabs switch between PDF and Text
- Metadata displays below preview

**Step 5: Commit**

```bash
git add frontend/app/\(app\)/documents/layout.tsx
git commit -m "$(cat <<'EOF'
feat: integrate new PreviewPanel into documents layout

Pass additional metadata props for display
EOF
)"
```

---

### Task 14: Populate File Size in Document Selection

**Files:**
- Find and modify where `setDocumentMetadata` is called

**Step 1: Find the location**

Run: `grep -r "setDocumentMetadata" frontend/ --include="*.tsx" | grep -v ".d.ts"`

**Step 2: Update the call to include fileSize and pageCount**

The existing call likely passes `{ filename, filePath, assignedStacks }`. Update to:
```typescript
setDocumentMetadata({
  filename: doc.filename,
  filePath: doc.file_path,
  assignedStacks: doc.stacks || [],
  fileSize: doc.file_size_bytes ?? null,  // TypeScript field name is file_size_bytes
  pageCount: null,  // Will be set by PDF load callback in PreviewPanel
})
```

> **Important:** The TypeScript type uses `file_size_bytes` (see `types/documents.ts`), not `file_size`. Verify the documents query in `lib/queries/documents.ts` includes this field.

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/
git commit -m "$(cat <<'EOF'
feat: populate fileSize in document metadata

Pass file_size from documents table to PreviewPanel
EOF
)"
```

---

## Phase 7: Cleanup (Tasks 15-16)

### Task 15: Add localStorage Persistence for Selected Document

**Files:**
- Modify: `frontend/components/documents/selected-document-context.tsx`

**Step 1: Add storage key constant**

After line 5, add:
```typescript
const STORAGE_KEY = 'stackdocs-last-document'
```

**Step 2: Add useEffect to restore on mount**

In SelectedDocumentProvider, after state declarations, add:
```typescript
  // Restore last selected document from localStorage
  useEffect(() => {
    const lastDocId = localStorage.getItem(STORAGE_KEY)
    if (lastDocId) {
      setSelectedDocIdState(lastDocId)
    }
  }, [])
```

**Step 3: Add useEffect to persist on change**

After the restore effect, add:
```typescript
  // Persist selected document to localStorage
  useEffect(() => {
    if (selectedDocId) {
      localStorage.setItem(STORAGE_KEY, selectedDocId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [selectedDocId])
```

**Step 4: Verify build passes and test**

Run: `cd frontend && npm run build`
Expected: Build succeeds

Test:
- Select a document
- Refresh page
- Same document should be selected (though data may need to load)

**Step 5: Commit**

```bash
git add frontend/components/documents/selected-document-context.tsx
git commit -m "$(cat <<'EOF'
feat: persist selected document to localStorage

Last-viewed document restored on page refresh
EOF
)"
```

---

### Task 16: Remove Old Preview Components

**Files:**
- Delete: `frontend/components/documents/preview-panel.tsx` (old file)
- Keep: `frontend/components/documents/visual-preview.tsx` (may be used elsewhere)
- Keep: `frontend/components/documents/pdf-viewer.tsx` (may be used elsewhere)

**Step 1: Check if old components are used elsewhere**

Run: `grep -r "from.*visual-preview" frontend/ --include="*.tsx" | grep -v preview-panel/`
Run: `grep -r "from.*pdf-viewer" frontend/ --include="*.tsx" | grep -v preview-panel/`

**Step 2: If not used elsewhere, delete old files**

If no other imports found:
```bash
rm frontend/components/documents/preview-panel.tsx
```

If visual-preview or pdf-viewer are still used elsewhere, keep them. Otherwise:
```bash
rm frontend/components/documents/visual-preview.tsx
rm frontend/components/documents/pdf-viewer.tsx
```

**Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no missing imports

**Step 4: Commit**

```bash
git add -A frontend/components/documents/
git commit -m "$(cat <<'EOF'
chore: remove old preview-panel.tsx

Replaced by new preview-panel/ folder structure
EOF
)"
```

---

## Phase 8: Polish (Tasks 17-18)

### Task 17: Test Dark Mode Gradient Visibility

**Files:**
- May modify: `frontend/components/documents/preview-panel/preview-container.tsx`

**Step 1: Test in dark mode**

1. Toggle to dark theme
2. View preview panel with PDF
3. Hover to reveal controls
4. Verify buttons/text are visible against gradient

**Step 2: If needed, add dark mode gradient variant**

If controls are hard to see in dark mode, update gradient classes:
```typescript
'bg-gradient-to-b from-black/60 via-black/30 to-transparent dark:from-black/70 dark:via-black/40'
```

**Step 3: Verify both themes work**

Toggle between light and dark, verify controls visible in both.

**Step 4: Commit (if changes made)**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
fix: improve gradient visibility in dark mode
EOF
)"
```

---

### Task 18: Final Review and Edge Cases

**Checklist to verify:**

- [ ] Empty state displays when no document selected
- [ ] Loading spinner while PDF URL fetches
- [ ] Single-page PDF hides page navigation
- [ ] Multi-page PDF shows page navigation on hover
- [ ] Tab switching works (PDF ↔ Text)
- [ ] Text tab shows OCR markdown correctly
- [ ] Expand modal opens and shows document
- [ ] Modal syncs page with preview panel
- [ ] Arrow keys navigate pages in preview
- [ ] Arrow keys navigate pages in modal
- [ ] Arrow keys don't navigate when typing in an input field
- [ ] Escape closes modal
- [ ] Download button works (PDF tab only)
- [ ] Download button hidden on Text tab
- [ ] Metadata shows correct info (type, size, pages, fields)
- [ ] "Not extracted" shows when no extraction
- [ ] localStorage persists selected document
- [ ] localStorage persists active tab
- [ ] ResizeObserver scales PDF on panel resize
- [ ] Page resets to 1 when selecting new document
- [ ] Build passes: `npm run build`

**Step 1: Run through checklist**

Test each item manually in the app.

**Step 2: Fix any issues found**

Address any bugs discovered during testing.

**Step 3: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: complete preview panel redesign

Apple Finder-inspired design with:
- Hover-reveal controls with gradient overlays
- PDF/Text tabs inside preview container
- Page navigation for multi-page PDFs
- Expand modal for full-size viewing
- Metadata display (filename, type, size, pages, fields)
- localStorage persistence for selected doc and tab
- Keyboard navigation (arrow keys for pages)
EOF
)"
```

---

## Future Improvements (Out of Scope)

These are minor improvements that could be made later but are not required for this implementation:

1. **Extract keyboard navigation hook** - `PreviewContainer` and `ExpandModal` both implement identical arrow key navigation. Could be extracted to `usePageKeyboardNavigation(options)` hook for DRYness. Current duplication is acceptable given the components are separate and code is simple.

2. **Stale localStorage document handling** - If a stored document ID no longer exists (deleted), the panel shows empty state gracefully. Could add explicit validation against document list if needed.

---

## Review Checkpoints

| After Phase | Verify |
|-------------|--------|
| Phase 6 | New preview panel integrated, all features work |
| Phase 8 | Polished, edge cases handled, ready for production |

---

## Files Created/Modified Summary

**Created:**
- `frontend/components/documents/preview-panel/index.tsx`
- `frontend/components/documents/preview-panel/preview-panel.tsx`
- `frontend/components/documents/preview-panel/preview-container.tsx`
- `frontend/components/documents/preview-panel/preview-controls.tsx`
- `frontend/components/documents/preview-panel/preview-metadata.tsx`
- `frontend/components/documents/preview-panel/page-navigation.tsx`
- `frontend/components/documents/preview-panel/text-content.tsx`
- `frontend/components/documents/preview-panel/pdf-content.tsx`
- `frontend/components/documents/preview-panel/expand-modal.tsx`

**Modified:**
- `frontend/components/icons/index.ts` (add ArrowsMaximize)
- `frontend/components/documents/preview-panel-context.tsx` (tab rename 'visual' to 'text')
- `frontend/components/documents/selected-document-context.tsx` (add fileSize, pageCount to metadata; add localStorage persistence)
- `frontend/components/documents/documents-table.tsx` (pass fileSize to setDocumentMetadata)
- `frontend/app/(app)/documents/layout.tsx` (pass new props to PreviewPanel)

**Deleted:**
- `frontend/components/documents/preview-panel.tsx` (old)
