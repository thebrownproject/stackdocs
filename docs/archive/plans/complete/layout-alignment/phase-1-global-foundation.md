# Phase 1: Global Foundation

**Tasks:** 1-2
**Focus:** Add icons to breadcrumbs for consistent alignment

---

## Task 1: Add Icons to Breadcrumb Component

**Files:**
- Modify: `frontend/components/layout/page-header.tsx`

**Step 1: Add icon mapping to PageHeader**

Add a `segmentIcons` mapping alongside the existing `segmentLabels`:

```tsx
import { FileText, Layers, Settings, Upload } from 'lucide-react'

// Map route segments to display labels
const segmentLabels: Record<string, string> = {
  documents: 'Documents',
  stacks: 'Stacks',
  settings: 'Settings',
  upload: 'Upload',
}

// Map route segments to icons
const segmentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  documents: FileText,
  stacks: Layers,
  settings: Settings,
  upload: Upload,
}
```

**Step 2: Update BreadcrumbItem to render icons**

In the breadcrumbs map, render the icon before the label:

```tsx
{breadcrumbs.map((item, index) => {
  const Icon = segmentIcons[item.segment]

  return (
    <Fragment key={item.href}>
      {index > 0 && <BreadcrumbSeparator />}
      <BreadcrumbItem>
        {item.isLast ? (
          <BreadcrumbPage className="flex items-center gap-1.5">
            {Icon && <Icon className="size-4" />}
            {item.label}
          </BreadcrumbPage>
        ) : (
          <BreadcrumbLink asChild>
            <Link href={item.href} className="flex items-center gap-1.5">
              {Icon && <Icon className="size-4" />}
              {item.label}
            </Link>
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
    </Fragment>
  )
})}
```

**Step 3: Verify breadcrumb displays icon**

Run: `npm run dev`
Navigate to `/documents` - should see FileText icon next to "Documents"

**Step 4: Commit**

```bash
git add frontend/components/layout/page-header.tsx
git commit -m "feat: add icons to breadcrumb navigation"
```

---

## Task 2: Support Dynamic Icons for Document Detail Breadcrumb

**Files:**
- Modify: `frontend/components/layout/page-header.tsx`
- Modify: `frontend/app/(app)/@header/documents/[id]/page.tsx`

**Step 1: Add icon prop to PageHeader**

```tsx
interface PageHeaderProps {
  /** Override the last breadcrumb label */
  title?: string
  /** Icon component for the last breadcrumb (e.g., file type icon) */
  icon?: React.ReactNode
  /** Action buttons to render on the right side */
  actions?: ReactNode
}
```

**Step 2: Use icon prop in last breadcrumb**

Update the last breadcrumb rendering to support custom icon prop:

```tsx
{item.isLast ? (
  <BreadcrumbPage className="flex items-center gap-1.5">
    {icon || (Icon && <Icon className="size-4" />)}
    {item.label}
  </BreadcrumbPage>
) : (
  <BreadcrumbLink asChild>
    <Link href={item.href} className="flex items-center gap-1.5">
      {Icon && <Icon className="size-4" />}
      {item.label}
    </Link>
  </BreadcrumbLink>
)}
```

**Step 3: Pass file type icon from document detail header**

In `frontend/app/(app)/@header/documents/[id]/page.tsx`, add FileTypeIcon import and pass as icon prop:

```tsx
// Add this import to the existing imports
import { FileTypeIcon } from '@/components/file-type-icon'

// Existing imports to preserve:
// import { notFound } from 'next/navigation'
// import { getDocumentWithExtraction } from '@/lib/queries/documents'
// import { PageHeader } from '@/components/layout/page-header'
// import { DocumentHeaderActions } from '@/components/documents/document-header-actions'

export default async function DocumentHeaderSlot({ params }: Props) {
  const { id } = await params
  const document = await getDocumentWithExtraction(id)

  if (!document) {
    notFound()
  }

  return (
    <PageHeader
      title={document.filename}
      icon={<FileTypeIcon mimeType={document.mime_type} />}
      actions={<DocumentHeaderActions />}
    />
  )
}
```

**Step 4: Verify document detail shows file icon**

Navigate to `/documents/[id]` - breadcrumb should show: `[FileText] Documents > [PDF icon] filename.pdf`

**Step 5: Commit**

```bash
git add frontend/components/layout/page-header.tsx frontend/app/(app)/@header/documents/[id]/page.tsx
git commit -m "feat: add file type icon to document detail breadcrumb"
```
