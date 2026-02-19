# Phase 1: Prerequisites

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install Sonner toast component for user feedback notifications.

**Architecture:** shadcn/ui wrapper around Sonner, added to root layout.

**Tech Stack:** Sonner, shadcn/ui, Next.js 16

---

## Task 1: Install Sonner Toast Component

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/app/layout.tsx`
- Create: `frontend/components/ui/sonner.tsx` (auto-created by shadcn)

**Step 1: Install Sonner via shadcn CLI**

Run: `cd frontend && npx shadcn@latest add sonner`

Expected: Creates `components/ui/sonner.tsx` and adds `sonner` to dependencies. Note: `next-themes` is already installed.

**Step 2: Add Toaster to root layout**

In `frontend/app/layout.tsx`, add the Toaster component **inside the `<ThemeProvider>`** (required for theme integration via `useTheme()` hook):

```tsx
import { Toaster } from '@/components/ui/sonner'

// Place INSIDE ThemeProvider, after {children}:
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
  <Toaster />
</ThemeProvider>
```

**Step 3: Verify installation**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: add sonner toast component"
```
