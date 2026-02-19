# Next.js Frontend Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up Next.js 16 frontend with shadcn/ui, Clerk authentication, and Supabase integration for Stackdocs MVP

**Architecture:** Next.js App Router with direct Supabase access for CRUD operations, Clerk for authentication, and shadcn sidebar component for navigation. Frontend calls FastAPI backend only for AI agent operations.

**Tech Stack:** Next.js 16, TypeScript, shadcn/ui (Nova style, neutral theme), Clerk, Supabase, Tabler Icons, Tailwind CSS

---

## Task 1: Initialize Next.js Project with shadcn/ui

**Files:**
- Create: `frontend/` (entire project structure)

**Step 1: Clean existing frontend directory**

```bash
cd /Users/fraserbrown/stackdocs
rm -rf frontend/*
```

**Step 2: Create Next.js project with shadcn Nova preset**

```bash
cd /Users/fraserbrown/stackdocs/frontend
npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=radix&style=nova&baseColor=neutral&theme=neutral&iconLibrary=tabler&font=inter&menuAccent=subtle&menuColor=default&radius=small&template=next" --template next
```

This creates:
- Complete Next.js 16 project with Nova style
- Tabler icons configured
- Inter font
- Neutral color theme with small radius
- All base shadcn components

**Step 3: Add sidebar-08 block**

```bash
cd /Users/fraserbrown/stackdocs/frontend
npx shadcn@latest add sidebar-08
```

This adds:
- `components/ui/sidebar.tsx` - Core sidebar primitives
- `components/app-sidebar.tsx` - Pre-built sidebar with demo content (we'll customize this)

**Step 4: Verify dev server runs**

```bash
cd /Users/fraserbrown/stackdocs/frontend
npm run dev
```

Expected: Server runs on http://localhost:3000 with default Next.js page

**Step 5: Commit**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/
git commit -m "feat(frontend): initialize Next.js with shadcn/ui"
```

---

## Task 2: Install Additional Dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install Clerk and Supabase**

```bash
cd /Users/fraserbrown/stackdocs/frontend
npm install @clerk/nextjs @supabase/supabase-js
```

Note: Tabler icons are already included via the Nova preset (iconLibrary=tabler)

**Step 2: Verify installation**

```bash
cd /Users/fraserbrown/stackdocs/frontend
npm list @clerk/nextjs @supabase/supabase-js @tabler/icons-react
```

Expected: All packages listed with versions

**Step 3: Commit**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add Clerk and Supabase dependencies"
```

---

## Task 3: Create Environment Variables Template

**Files:**
- Create: `frontend/.env.local.example`
- Create: `frontend/.env.local` (with Supabase values only - Clerk auto-generates)

**Step 1: Create environment template**

Create `frontend/.env.local.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Clerk - Keys are auto-generated on first run
# After claiming your app, they appear in Clerk dashboard
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
# CLERK_SECRET_KEY=sk_test_...

# FastAPI Backend (for agent operations)
NEXT_PUBLIC_API_URL=https://api.stackdocs.io
```

**Step 2: Create actual .env.local with Supabase values**

Create `frontend/.env.local` with values from:
- Supabase: Dashboard → Settings → API

Note: Clerk keys auto-generate on first `npm run dev`. Claim your app in Clerk dashboard to persist them.

**Step 3: Verify .gitignore includes .env.local**

Check `frontend/.gitignore` contains:
```
.env.local
```

**Step 4: Commit template only**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/.env.local.example
git commit -m "feat(frontend): add environment variables template"
```

---

## Task 4: Setup Clerk Proxy (Next.js 16+)

**Files:**
- Create: `frontend/proxy.ts`

**Step 1: Create Clerk proxy**

For Next.js 16+, create `frontend/proxy.ts` (not middleware.ts):

```typescript
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

Note: Routes are public by default. Protection is handled in the (app) layout.

**Step 2: Commit**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/proxy.ts
git commit -m "feat(frontend): add Clerk proxy for Next.js 16"
```

---

## Task 5: Setup ClerkProvider in Root Layout

**Files:**
- Modify: `frontend/app/layout.tsx`

**Step 1: Update root layout with ClerkProvider**

Replace `frontend/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Stackdocs',
  description: 'Document data extraction with AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
```

Note: No sidebar here - that goes in the (app) layout. Clerk modals handle sign-in/sign-up.

**Step 2: Commit**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/app/layout.tsx
git commit -m "feat(frontend): wrap app with ClerkProvider"
```

---

## Task 6: (Removed - Using Clerk Modal Components)

Sign-in and sign-up are handled by `<SignInButton>` and `<SignUpButton>` modal components.
No separate pages needed. Skip to Task 7.

---

## Task 8: Setup Supabase Client

**Files:**
- Create: `frontend/lib/supabase.ts`

**Step 1: Create Supabase client**

Create `frontend/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Step 2: Commit**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/lib/supabase.ts
git commit -m "feat(frontend): add Supabase client configuration"
```

---

## Task 9: Customize Sidebar Navigation Data

**Files:**
- Modify: `frontend/components/app-sidebar.tsx` (generated by sidebar-08)

**Step 1: Update sidebar data for Stackdocs**

The sidebar-08 block created `frontend/components/app-sidebar.tsx` with demo data.
Update the `data` object to match Stackdocs navigation structure:

```tsx
"use client"

import * as React from "react"
import {
  IconFileText,
  IconLayers,
  IconLifebuoy,
  IconSend,
  IconStack2,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "User", // Will be replaced with Clerk user data in Phase 2
    email: "user@example.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Workspace",
      url: "#",
      icon: IconStack2,
      isActive: true,
      items: [
        {
          title: "Documents",
          url: "/documents",
        },
        {
          title: "Extractions",
          url: "/extractions",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: IconLifebuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: IconSend,
    },
  ],
  // Stacks will be loaded dynamically from Supabase in Phase 2
  // For now, show placeholder
  projects: [
    {
      name: "All Stacks",
      url: "/stacks",
      icon: IconLayers,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/documents">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <IconFileText className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Stackdocs</span>
                  <span className="truncate text-xs">Document Extraction</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
```

**Step 2: Update nav-main.tsx for Tabler icons**

Replace `LucideIcon` type with Tabler's `Icon` type:

```tsx
// Change this import:
import { type LucideIcon } from "lucide-react"

// To:
import { type Icon } from "@tabler/icons-react"

// And update the type in the component props:
icon: Icon  // instead of LucideIcon
```

**Step 3: Update nav-projects.tsx for Tabler icons**

Same pattern - replace Lucide imports with Tabler:

```tsx
// Change:
import { Folder, MoreHorizontal, Share, Trash2, type LucideIcon } from "lucide-react"

// To:
import { IconFolder, IconDotsVertical, IconShare, IconTrash, type Icon } from "@tabler/icons-react"
```

**Step 4: Update nav-secondary.tsx for Tabler icons**

```tsx
// Change:
import { type LucideIcon } from "lucide-react"

// To:
import { type Icon } from "@tabler/icons-react"
```

**Step 5: Commit**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/components/app-sidebar.tsx frontend/components/nav-main.tsx frontend/components/nav-projects.tsx frontend/components/nav-secondary.tsx
git commit -m "feat(frontend): customize sidebar-08 with Stackdocs navigation"
```

**Note:** The collapsible structure from sidebar-08 is preserved. NavMain handles the collapsible Workspace section. NavProjects shows Stacks (will be dynamic in Phase 2). NavUser placeholder will integrate with Clerk in Phase 2.

---

## Task 10: Create App Layout (Route Group)

**Files:**
- Create: `frontend/app/(app)/layout.tsx`

**Step 1: Create app layout with SidebarProvider and auth protection**

Create `frontend/app/(app)/layout.tsx`:

```tsx
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Protect all routes in (app) - redirects to Clerk sign-in if not authenticated
  await auth.protect()

  // Sidebar state persistence
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true'

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          </div>
        </header>
        <main className="flex-1 p-4 pt-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/app/\(app\)/layout.tsx
git commit -m "feat(frontend): add app layout with sidebar"
```

---

## Task 11: Create App Pages

**Files:**
- Create: `frontend/app/(app)/documents/page.tsx`
- Create: `frontend/app/(app)/extractions/page.tsx`
- Create: `frontend/app/(app)/stacks/page.tsx`

**Step 1: Create Documents page**

Create `frontend/app/(app)/documents/page.tsx`:

```tsx
export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Upload and manage your documents
        </p>
      </div>

      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          Document upload coming in next phase
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Create Extractions page**

Create `frontend/app/(app)/extractions/page.tsx`:

```tsx
export default function ExtractionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Extractions</h1>
        <p className="text-muted-foreground">
          View and edit extracted data
        </p>
      </div>

      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          Extractions view coming in next phase
        </p>
      </div>
    </div>
  )
}
```

**Step 3: Create Stacks page**

Create `frontend/app/(app)/stacks/page.tsx`:

```tsx
export default function StacksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stacks</h1>
        <p className="text-muted-foreground">
          Manage your document stacks
        </p>
      </div>

      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">
          Stacks feature coming in next phase
        </p>
      </div>
    </div>
  )
}
```

**Step 4: Commit**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/app/\(app\)/
git commit -m "feat(frontend): add app placeholder pages"
```

---

## Task 12: Update Home Page

**Files:**
- Modify: `frontend/app/page.tsx`

**Step 1: Update home page with Clerk components**

Replace `frontend/app/page.tsx`:

```tsx
import Link from 'next/link'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Stackdocs</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Document data extraction with AI
        </p>
      </div>

      <div className="flex gap-4">
        <SignedIn>
          <Link
            href="/documents"
            className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Go to Documents
          </Link>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="rounded-md border px-6 py-2 hover:bg-accent">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90">
              Get Started
            </button>
          </SignUpButton>
        </SignedOut>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/fraserbrown/stackdocs
git add frontend/app/page.tsx
git commit -m "feat(frontend): update home page with auth buttons"
```

---

## Task 13: Final Testing

**Step 1: Start dev server**

```bash
cd /Users/fraserbrown/stackdocs/frontend
npm run dev
```

**Step 2: Test authentication flow**

1. Visit http://localhost:3000
2. Click "Get Started" → Should open Clerk sign-up modal
3. Complete sign-up (or use existing test account)
4. Should redirect to /documents
5. Sidebar should show with navigation items
6. UserButton should appear in sidebar footer

**Step 3: Test protected routes**

1. Open incognito window
2. Visit http://localhost:3000/documents directly
3. Should redirect to /sign-in

**Step 4: Test navigation**

1. Click Documents → /documents
2. Click Extractions → /extractions
3. Click All Stacks → /stacks
4. Active state should highlight current page

**Step 5: Final commit**

```bash
cd /Users/fraserbrown/stackdocs
git add .
git commit -m "feat(frontend): complete Next.js frontend foundation"
```

---

## Success Criteria

- [x] Next.js 16 project runs without errors
- [x] shadcn/ui components installed and working
- [x] Clerk authentication working (sign-in, sign-up, sign-out)
- [x] Protected routes redirect to sign-in
- [x] Supabase client configured
- [x] Sidebar navigation with Workspace/Stacks structure
- [x] App pages render (placeholders) - using route groups
- [x] Environment variables template created
- [x] All commits clean and descriptive

## Completion Notes (2025-12-22)

**Changes from original plan:**
- Used `new-york` style instead of `nova` (nova doesn't support sidebar-08)
- Using Geist font (Next.js default) instead of Inter
- Used route groups `(app)/` instead of `/dashboard/` for cleaner URLs
- Clerk middleware in `proxy.ts` (Next.js 16+) instead of `middleware.ts`
- Sign-in/sign-up via modals (`<SignInButton>`, `<SignUpButton>`) instead of separate pages
- `auth.protect()` in layout instead of middleware route matching

**All tasks complete. Feature ready to move to `plans/complete/`.**

---

## Notes

- **Nova preset** includes Tabler icons (`@tabler/icons-react`) - no separate icon installation needed
- **sidebar-08 block** ships with Lucide icons - we convert all to Tabler for consistency
- **Tabler icon pattern**: `import { IconName } from '@tabler/icons-react'` with `className="size-4"`
- **Tabler icon type**: Use `type Icon` from `@tabler/icons-react` (replaces `LucideIcon`)
- **sidebar-08 structure preserved**: NavMain (collapsible), NavProjects (stacks), NavSecondary, NavUser
- Clerk middleware uses `clerkMiddleware()` (not deprecated `authMiddleware()`)
- `auth()` must be awaited in server components (Next.js 6+ requirement)
- SidebarProvider must wrap the sidebar for proper functionality
