# Phase 4: Polish & Testing

**Tasks:** 13-14
**Focus:** Loading skeletons and manual testing

---

## Task 13: Update Loading Skeletons

**Files:**
- Modify: `frontend/app/(app)/@header/documents/[id]/loading.tsx`

**Step 1: Update header skeleton to include icon placeholder**

```tsx
export default function HeaderLoading() {
  return (
    <div
      className="flex items-center justify-between shrink-0 w-full"
      role="status"
      aria-label="Loading document header"
    >
      {/* Breadcrumb skeleton with icons */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-20" />
        <span className="text-muted-foreground/30">/</span>
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      {/* Actions skeleton - icon only */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7" />
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/app/(app)/@header/documents/[id]/loading.tsx
git commit -m "fix: update loading skeletons for new layout"
```

---

## Task 14: Manual Testing Checklist

**Run through these tests manually:**

### Documents List Page

- [ ] Breadcrumb shows Documents with FileText icon
- [ ] Sub-bar Filter icon aligns with breadcrumb icon
- [ ] Table checkbox aligns with sidebar toggle
- [ ] Table file icon aligns with Filter icon
- [ ] "Name" header aligns with filename text
- [ ] No Size column visible
- [ ] No pagination footer visible
- [ ] Column resize drag handles appear on hover
- [ ] Column widths persist after refresh
- [ ] Row click highlights row (preview shows)
- [ ] Filename click navigates to detail
- [ ] Filename shows underline on hover
- [ ] Preview toggle is icon-only
- [ ] Preview panel shows/hides correctly

### Document Detail Page

- [ ] Breadcrumb: Documents icon > file type icon + filename
- [ ] Checkboxes appear in extracted data table on hover
- [ ] Chevron shows for expandable rows
- [ ] Confidence circle shows for leaf rows on hover
- [ ] Confidence stays visible when row selected
- [ ] No separate Conf. column
- [ ] Column resize works for Field/Value
- [ ] Column widths persist after refresh
- [ ] Chat bar is floating with rounded corners
- [ ] Chat bar has margins from edges
- [ ] Resize handle stops above chat bar
- [ ] Preview toggle is icon-only

### Cross-Page Alignment

- [ ] Icons in breadcrumbs align vertically across pages
- [ ] Checkbox column is same width on both tables
- [ ] Indicator column (icons/chevrons) aligns consistently

**Step 1: Complete testing**

Run through each item and verify

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete layout alignment system implementation"
```
