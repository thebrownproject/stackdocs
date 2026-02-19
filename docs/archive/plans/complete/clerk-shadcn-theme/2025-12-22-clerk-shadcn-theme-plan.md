# Clerk shadcn Theme Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply shadcn theme to all Clerk components and replace the sidebar NavUser with Clerk's UserButton

**Architecture:** Install @clerk/themes package, import shadcn CSS, configure ClerkProvider with shadcn baseTheme, and swap NavUser component for UserButton in sidebar footer

**Tech Stack:** @clerk/themes, @clerk/nextjs, Tailwind CSS v4

---

## Task 1: Install @clerk/themes Package

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install the themes package**

Run:
```bash
cd /Users/fraserbrown/stackdocs/frontend && npm install @clerk/themes
```

Expected: Package added to dependencies

**Step 2: Verify installation**

Run:
```bash
cd /Users/fraserbrown/stackdocs/frontend && npm list @clerk/themes
```

Expected: `@clerk/themes@x.x.x` listed

**Step 3: Commit**

```bash
cd /Users/fraserbrown/stackdocs && git add frontend/package.json frontend/package-lock.json && git commit -m "feat(frontend): add @clerk/themes package"
```

---

## Task 2: Import shadcn Theme CSS

**Files:**
- Modify: `frontend/app/globals.css`

**Step 1: Add shadcn theme CSS import**

Add this import after the existing tailwindcss import in `frontend/app/globals.css`:

```css
@import '@clerk/themes/shadcn.css';
```

The top of the file should look like:
```css
@import 'tailwindcss';
@import '@clerk/themes/shadcn.css';
```

**Step 2: Verify dev server still runs**

Run:
```bash
cd /Users/fraserbrown/stackdocs/frontend && npm run dev
```

Expected: No CSS errors, server runs on http://localhost:3000

**Step 3: Commit**

```bash
cd /Users/fraserbrown/stackdocs && git add frontend/app/globals.css && git commit -m "feat(frontend): import Clerk shadcn theme CSS"
```

---

## Task 3: Configure ClerkProvider with shadcn Theme

**Files:**
- Modify: `frontend/app/layout.tsx`

**Step 1: Update root layout with shadcn theme**

Replace `frontend/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { shadcn } from '@clerk/themes'
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
    <ClerkProvider appearance={{ baseTheme: shadcn }}>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
```

**Step 2: Verify sign-in modal styling**

1. Visit http://localhost:3000
2. Click "Sign In"
3. Modal should have shadcn styling (matches your app's look)

**Step 3: Commit**

```bash
cd /Users/fraserbrown/stackdocs && git add frontend/app/layout.tsx && git commit -m "feat(frontend): apply shadcn theme to ClerkProvider"
```

---

## Task 4: Replace NavUser with UserButton in Sidebar

**Files:**
- Modify: `frontend/components/app-sidebar.tsx`

**Step 1: Update app-sidebar to use Clerk UserButton**

Replace `frontend/components/app-sidebar.tsx`:

```tsx
"use client"

import * as React from "react"
import {
  IconFileText,
  IconLayersLinked,
  IconLifebuoy,
  IconSend,
  IconStack2,
} from "@tabler/icons-react"
import { UserButton } from "@clerk/nextjs"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
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
  projects: [
    {
      name: "All Stacks",
      url: "/stacks",
      icon: IconLayersLinked,
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
        <SidebarMenu>
          <SidebarMenuItem>
            <UserButton
              showName
              appearance={{
                elements: {
                  rootBox: "w-full",
                  userButtonTrigger: "w-full justify-start gap-2 p-2 rounded-md hover:bg-sidebar-accent",
                  userButtonBox: "flex-row-reverse",
                  avatarBox: "size-8 rounded-lg",
                }
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
```

**Step 2: Verify UserButton displays in sidebar**

1. Visit http://localhost:3000
2. Sign in if needed
3. Navigate to /documents
4. UserButton should appear in sidebar footer with:
   - User avatar
   - User name
   - Dropdown trigger

**Step 3: Click UserButton and verify dropdown**

Expected dropdown menu:
- Manage account
- Sign out

**Step 4: Commit**

```bash
cd /Users/fraserbrown/stackdocs && git add frontend/components/app-sidebar.tsx && git commit -m "feat(frontend): replace NavUser with Clerk UserButton in sidebar"
```

---

## Task 5: Clean Up Unused NavUser Component

**Files:**
- Delete: `frontend/components/nav-user.tsx`

**Step 1: Remove the unused NavUser component**

Run:
```bash
rm /Users/fraserbrown/stackdocs/frontend/components/nav-user.tsx
```

**Step 2: Verify no import errors**

Run:
```bash
cd /Users/fraserbrown/stackdocs/frontend && npm run build
```

Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
cd /Users/fraserbrown/stackdocs && git add -A && git commit -m "chore(frontend): remove unused NavUser component"
```

---

## Task 6: Final Verification

**Step 1: Test complete flow**

1. Open incognito window
2. Visit http://localhost:3000
3. Click "Get Started" → shadcn-styled sign-up modal
4. Create account or sign in
5. Navigate to /documents
6. Verify sidebar UserButton shows your name/avatar
7. Click UserButton → verify dropdown menu
8. Click "Manage account" → verify profile modal styling
9. Sign out → verify redirect to home

**Step 2: All tests pass**

Expected: All Clerk UI matches shadcn new-york styling

---

## Success Criteria

- [x] @clerk/themes package installed
- [x] shadcn CSS imported in globals.css
- [x] ClerkProvider configured with shadcn baseTheme
- [x] Sign-in/sign-up modals match shadcn styling
- [x] UserButton in sidebar footer with showName
- [x] UserButton dropdown works (manage account, sign out)
- [x] NavUser component removed
- [x] Build succeeds with no errors
