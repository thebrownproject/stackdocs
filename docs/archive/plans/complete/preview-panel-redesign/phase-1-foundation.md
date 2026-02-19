# Preview Panel Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the document preview panel with Apple Finder-inspired aesthetics, hover-reveal controls, metadata display, expand modal, and localStorage persistence.

**Architecture:** Refactor existing `preview-panel.tsx` into modular components under `preview-panel/` folder. Build leaf components first (metadata, page-nav, controls), then container components, then integrate. TDD approach with frequent commits.

**Tech Stack:** React, TypeScript, shadcn/ui (Tabs, Dialog, Button), Tailwind CSS, react-pdf, localStorage

---

## Phase 1: Foundation (Tasks 1-2)

### Task 1: Add Expand Icon to Icons Barrel

**Files:**
- Modify: `frontend/components/icons/index.ts`

**Step 1: Add the export**

Add to the icons export list after `IconDownload as Download`:

```typescript
IconArrowsMaximize as ArrowsMaximize,
```

**Step 2: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

> **Note:** If build fails with "IconArrowsMaximize is not exported", verify the icon exists in `@tabler/icons-react` by checking their docs or running `npm run build` to surface the error.

**Step 3: Commit**

```bash
git add frontend/components/icons/index.ts
git commit -m "$(cat <<'EOF'
feat(icons): add ArrowsMaximize icon for preview expand button
EOF
)"
```

---

### Task 2: Create Folder Structure and Barrel Export

**Files:**
- Create: `frontend/components/documents/preview-panel/index.tsx`

**Step 1: Create the directory and barrel file**

```typescript
// Barrel export for preview-panel components
// Components will be added as implemented

export {}
```

**Step 2: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds (empty export is valid)

**Step 3: Commit**

```bash
git add frontend/components/documents/preview-panel/
git commit -m "$(cat <<'EOF'
chore: scaffold preview-panel folder structure
EOF
)"
```

---

## Phase 2: Context Updates (Tasks 3-4)

### Task 3: Update Tab Naming in PreviewPanelContext

**Files:**
- Modify: `frontend/components/documents/preview-panel-context.tsx`

**Step 1: Update the type definition**

Change line 12 from:
```typescript
  tab: 'pdf' | 'visual'
```
to:
```typescript
  tab: 'pdf' | 'text'
```

**Step 2: Update the context value type**

Change lines 27-28 from:
```typescript
  activeTab: 'pdf' | 'visual'
  setActiveTab: (tab: 'pdf' | 'visual') => void
```
to:
```typescript
  activeTab: 'pdf' | 'text'
  setActiveTab: (tab: 'pdf' | 'text') => void
```

**Step 3: Update state initialization**

Change line 39 from:
```typescript
  const [activeTab, setActiveTabState] = useState<'pdf' | 'visual'>(DEFAULT_STATE.tab)
```
to:
```typescript
  const [activeTab, setActiveTabState] = useState<'pdf' | 'text'>(DEFAULT_STATE.tab)
```

**Step 4: Add migration for localStorage**

In the useEffect that reads from localStorage (around line 49), **replace** the existing tab validation:
```typescript
// Replace this line:
if (state.tab === 'pdf' || state.tab === 'visual') setActiveTabState(state.tab)

// With this migration-aware version:
if (state.tab === 'pdf' || state.tab === 'text') {
  setActiveTabState(state.tab)
} else if (state.tab === 'visual') {
  // Migrate old 'visual' tab to 'text'
  setActiveTabState('text')
}
```

> **Note:** This replaces the entire tab conditional, not just adds to it.

**Step 5: Update setActiveTab**

Change line 78 from:
```typescript
  const setActiveTab = useCallback((tab: 'pdf' | 'visual') => {
```
to:
```typescript
  const setActiveTab = useCallback((tab: 'pdf' | 'text') => {
```

**Step 6: Update preview-panel.tsx to use new tab value**

In `frontend/components/documents/preview-panel.tsx`:

Change line 33 from:
```typescript
  const effectiveTab = (activeTab === 'pdf' && !isPdf) ? 'visual' : activeTab
```
to:
```typescript
  const effectiveTab = (activeTab === 'pdf' && !isPdf) ? 'text' : activeTab
```

Change line 36 from:
```typescript
    <Tabs value={effectiveTab} onValueChange={(v) => setActiveTab(v as 'pdf' | 'visual')} className="flex flex-col h-full">
```
to:
```typescript
    <Tabs value={effectiveTab} onValueChange={(v) => setActiveTab(v as 'pdf' | 'text')} className="flex flex-col h-full">
```

Change line 47-50 (TabsTrigger value) from:
```typescript
          <TabsTrigger
            value="visual"
```
to:
```typescript
          <TabsTrigger
            value="text"
```

Change line 51 text from `Visual` to `Text`.

Change line 72 from:
```typescript
      <TabsContent value="visual" className="flex-1 mt-0 overflow-hidden">
```
to:
```typescript
      <TabsContent value="text" className="flex-1 mt-0 overflow-hidden">
```

**Step 7: Verify build passes and app works**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 8: Commit**

```bash
git add frontend/components/documents/preview-panel-context.tsx frontend/components/documents/preview-panel.tsx
git commit -m "$(cat <<'EOF'
refactor: rename preview tab from 'visual' to 'text'

- Update PreviewPanelContext type to use 'pdf' | 'text'
- Add localStorage migration for existing 'visual' values
- Update PreviewPanel component to use new tab value
EOF
)"
```

---

### Task 4: Add File Size and Page Count to SelectedDocumentContext

**Files:**
- Modify: `frontend/components/documents/selected-document-context.tsx`

**Step 1: Extend DocumentMetadata interface**

Change lines 10-14 from:
```typescript
interface DocumentMetadata {
  filename: string
  filePath: string | null
  assignedStacks: StackSummary[]
}
```
to:
```typescript
interface DocumentMetadata {
  filename: string
  filePath: string | null
  assignedStacks: StackSummary[]
  fileSize: number | null  // bytes
  pageCount: number | null
}
```

**Step 2: Add state variables**

After line 55 (after extractedFields state), add:
```typescript
  const [fileSize, setFileSizeState] = useState<number | null>(null)
  const [pageCount, setPageCountState] = useState<number | null>(null)
```

**Step 3: Clear on deselect**

In the setSelectedDocId callback (around line 67), add after clearing other fields:
```typescript
      setFileSizeState(null)
      setPageCountState(null)
```

**Step 4: Update setDocumentMetadata**

Change the setDocumentMetadata callback to include new fields:
```typescript
  const setDocumentMetadata = useCallback((metadata: DocumentMetadata) => {
    setFilenameState(metadata.filename)
    setFilePathState(metadata.filePath)
    setAssignedStacksState(metadata.assignedStacks)
    setFileSizeState(metadata.fileSize)
    setPageCountState(metadata.pageCount)
  }, [])
```

**Step 5: Update context value interface**

Add to SelectedDocumentContextValue interface:
```typescript
  fileSize: number | null
  pageCount: number | null
```

> **Note:** Individual setters (`setFileSize`, `setPageCount`) are not needed - YAGNI. These values are set via `setDocumentMetadata` or updated via the PDF load callback in PreviewPanel (using local state).

**Step 6: Include in context value**

Add to the contextValue useMemo:
```typescript
    fileSize,
    pageCount,
```

And add to dependencies array:
```typescript
    fileSize,
    pageCount,
```

**Step 7: Verify build passes**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 8: Commit**

```bash
git add frontend/components/documents/selected-document-context.tsx
git commit -m "$(cat <<'EOF'
feat: add fileSize and pageCount to SelectedDocumentContext

For preview panel metadata display showing document size and page count
EOF
)"
```

---

## Review Checkpoints

| After Phase | Verify |
|-------------|--------|
| Phase 2 | Context updated, app still works |
