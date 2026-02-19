# Documents Page: Phase 1 - Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install shadcn components and create page header system with breadcrumbs.

**This plan:** Tasks 1-3 | **Next:** `02-documents-list.md`

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

## Phase 1: Foundation - shadcn Components & Page Header System

### Task 1: Install Required shadcn Components

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/components/ui/table.tsx`
- Create: `frontend/components/ui/dialog.tsx`
- Create: `frontend/components/ui/badge.tsx`
- Create: `frontend/components/ui/tabs.tsx`
- Create: `frontend/components/ui/popover.tsx`
- Create: `frontend/components/ui/checkbox.tsx`
- Create: `frontend/components/ui/card.tsx`

**Step 1: Install shadcn components**

Run:
```bash
cd frontend && npx shadcn@latest add table dialog badge tabs popover checkbox card
```

Expected: Components added to `components/ui/`

**Step 2: Install TanStack Table**

Run:
```bash
cd frontend && npm install @tanstack/react-table
```

Expected: Package added to package.json

**Step 3: Commit**

```bash
git add frontend/components/ui frontend/package.json frontend/package-lock.json
git commit -m "feat: add shadcn table, dialog, badge, tabs, popover, checkbox, card components"
```

---

### Task 2: Create Page Header Context System

**Files:**
- Create: `frontend/contexts/page-header-context.tsx`
- Create: `frontend/components/page-header.tsx`

**Step 1: Create the page header context**

Create `frontend/contexts/page-header-context.tsx`:

```tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export interface BreadcrumbItem {
  id: string
  label: string
  href?: string
}

interface PageHeaderContextType {
  breadcrumbs: BreadcrumbItem[]
  setBreadcrumbs: (items: BreadcrumbItem[]) => void
}

const PageHeaderContext = createContext<PageHeaderContextType | null>(null)

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])

  return (
    <PageHeaderContext.Provider value={{ breadcrumbs, setBreadcrumbs }}>
      {children}
    </PageHeaderContext.Provider>
  )
}

export function useBreadcrumbs() {
  const context = useContext(PageHeaderContext)
  if (!context) {
    throw new Error('useBreadcrumbs must be used within PageHeaderProvider')
  }
  return context
}
```

**Step 2: Create the PageHeader component**

Create `frontend/components/page-header.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useBreadcrumbs } from '@/contexts/page-header-context'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ReactNode } from 'react'

interface PageHeaderProps {
  actions?: ReactNode
}

export function PageHeader({ actions }: PageHeaderProps) {
  const { breadcrumbs } = useBreadcrumbs()

  return (
    <div className="flex items-center justify-between">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1
            return (
              <BreadcrumbItem key={item.id}>
                {index > 0 && <BreadcrumbSeparator className="mr-1.5" />}
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href || '#'}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add frontend/contexts frontend/components/page-header.tsx
git commit -m "feat: add page header context system with breadcrumbs"
```

---

### Task 3: Integrate Page Header into App Layout

**Files:**
- Modify: `frontend/app/(app)/layout.tsx`

**Step 1: Update the app layout**

Modify `frontend/app/(app)/layout.tsx`:

```tsx
import { cookies } from 'next/headers'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { PageHeaderProvider } from '@/contexts/page-header-context'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true'

  return (
    <PageHeaderProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          </header>
          <main className="flex-1 p-4 pt-0">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </PageHeaderProvider>
  )
}
```

**Step 2: Verify the app still loads**

Run:
```bash
cd frontend && npm run dev
```

Navigate to http://localhost:3000/documents - page should load without errors.

**Step 3: Commit**

```bash
git add frontend/app/\(app\)/layout.tsx
git commit -m "feat: integrate PageHeaderProvider into app layout"
```

---

