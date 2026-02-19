# Auth Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Clerk auth with edge middleware, user sync webhooks, and cleanup.

**Architecture:** Middleware protects routes at edge before rendering. Webhook handler syncs Clerk users to Supabase `users` table for usage tracking. Remove redundant layout auth check.

**Tech Stack:** Clerk Next.js SDK, Supabase JS client, Next.js App Router API routes

---

## Task 1: Update middleware with route protection

**Files:**
- Modify: `frontend/proxy.ts`

**Step 1: Update proxy.ts with route matcher**

Replace the entire file content:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/about',
  '/contact',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

**Step 2: Verify the change**

Run: `cat frontend/proxy.ts | head -20`

Expected: File shows `createRouteMatcher` import and `isPublicRoute` definition.

**Step 3: Commit**

```bash
git add frontend/proxy.ts
git commit -m "feat(auth): add route protection to middleware"
```

---

## Task 2: Create webhook API route

**Files:**
- Create: `frontend/app/api/webhooks/clerk/route.ts`

**Step 1: Create the directory structure**

Run: `mkdir -p frontend/app/api/webhooks/clerk`

**Step 2: Create the webhook handler**

Create file `frontend/app/api/webhooks/clerk/route.ts`:

```typescript
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const evt = await verifyWebhook(req)

    if (evt.type === 'user.created') {
      const { id, email_addresses, primary_email_address_id } = evt.data
      const email = email_addresses.find(
        (e: { id: string; email_address: string }) => e.id === primary_email_address_id
      )?.email_address

      // Validate email exists
      if (!email) {
        console.error('No email found for user:', id)
        return new Response('No email found', { status: 400 })
      }

      // Upsert for idempotency (handles duplicate webhook deliveries)
      const { error } = await supabase
        .from('users')
        .upsert({ id, email }, { onConflict: 'id' })

      if (error) {
        // Log but return 200 to prevent Clerk retries
        console.error('Database error on user.created:', error)
      }
    }

    if (evt.type === 'user.updated') {
      const { id, email_addresses, primary_email_address_id } = evt.data
      const email = email_addresses.find(
        (e: { id: string; email_address: string }) => e.id === primary_email_address_id
      )?.email_address

      // Only update if email exists
      if (email) {
        const { error } = await supabase
          .from('users')
          .update({ email })
          .eq('id', id)

        if (error) {
          console.error('Database error on user.updated:', error)
        }
      }
    }

    if (evt.type === 'user.deleted') {
      const { id } = evt.data

      if (!id) {
        console.error('No user ID in deletion event')
        return new Response('No user ID', { status: 400 })
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Database error on user.deleted:', error)
      }
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return new Response('Webhook verification failed', { status: 400 })
  }
}
```

**Step 3: Verify file created**

Run: `cat frontend/app/api/webhooks/clerk/route.ts | head -10`

Expected: Shows imports and supabase client creation.

**Step 4: Commit**

```bash
git add frontend/app/api/webhooks/clerk/route.ts
git commit -m "feat(auth): add Clerk webhook handler for user sync"
```

---

## Task 3: Add sign-out redirect to UserButton

**Files:**
- Modify: `frontend/components/app-sidebar.tsx:97-107`

**Step 1: Update UserButton with afterSignOutUrl**

Find the `<UserButton` component (around line 97) and add `afterSignOutUrl="/"`:

Change from:
```typescript
            <UserButton
              showName
              appearance={{
```

To:
```typescript
            <UserButton
              showName
              afterSignOutUrl="/"
              appearance={{
```

**Step 2: Verify the change**

Run: `grep -A2 "UserButton" frontend/components/app-sidebar.tsx`

Expected: Shows `afterSignOutUrl="/"` after `showName`.

**Step 3: Commit**

```bash
git add frontend/components/app-sidebar.tsx
git commit -m "feat(auth): add sign-out redirect to homepage"
```

---

## Task 4: Remove redundant layout auth check

**Files:**
- Modify: `frontend/app/(app)/layout.tsx:1-13`

**Step 1: Remove auth import and protect call**

Remove the `auth` import from line 1:
```typescript
// Remove: import { auth } from '@clerk/nextjs/server'
```

Remove line 13:
```typescript
// Remove: await auth.protect()
```

The updated file should start:
```typescript
import { cookies } from 'next/headers'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Sidebar state persistence
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true'
```

**Step 2: Verify the change**

Run: `grep -c "auth.protect" frontend/app/\(app\)/layout.tsx`

Expected: `0` (no matches)

**Step 3: Commit**

```bash
git add frontend/app/\(app\)/layout.tsx
git commit -m "refactor(auth): remove redundant layout auth check"
```

---

## Task 5: Add environment variables

**Files:**
- Modify: `frontend/.env.local`

**Step 1: Check current env file**

Run: `cat frontend/.env.local`

**Step 2: Add required variables**

Add these lines to `frontend/.env.local` (get values from Supabase and Clerk dashboards):

```
# Supabase service role key (for webhook admin access)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Clerk webhook signing secret (from Clerk Dashboard > Webhooks)
CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxx
```

**Note:** Do NOT commit `.env.local` - it should already be in `.gitignore`.

**Step 3: Verify .gitignore excludes env files**

Run: `grep -E "\.env" frontend/.gitignore`

Expected: Shows `.env*.local` or similar pattern.

---

## Task 6: Test middleware protection

**Step 1: Start dev server**

Run: `cd frontend && npm run dev`

**Step 2: Test unauthenticated access**

1. Open incognito browser window
2. Navigate to `http://localhost:3000/documents`
3. Expected: Redirect to Clerk sign-in (not the documents page)

**Step 3: Test public route access**

1. Navigate to `http://localhost:3000`
2. Expected: Homepage loads without redirect

**Step 4: Test authenticated access**

1. Sign in via Clerk
2. Navigate to `http://localhost:3000/documents`
3. Expected: Documents page loads

---

## Task 7: Configure Clerk webhook (manual)

**Step 1: Open Clerk Dashboard**

Go to: https://dashboard.clerk.com → Your app → Webhooks

**Step 2: Add endpoint**

- **Endpoint URL (development):** Use ngrok or similar
  ```bash
  ngrok http 3000
  ```
  Then use: `https://xxxx.ngrok.io/api/webhooks/clerk`

- **Endpoint URL (production):** `https://www.stackdocs.io/api/webhooks/clerk`

**Step 3: Select events**

Check these events:
- `user.created`
- `user.updated`
- `user.deleted`

**Step 4: Copy signing secret**

Copy the signing secret and add it to your `.env.local` as `CLERK_WEBHOOK_SIGNING_SECRET`.

**Step 5: Test webhook**

1. Use Clerk Dashboard "Send test webhook" for `user.created`
2. Check your terminal for webhook log output
3. Check Supabase `users` table for new row

---

## Task 8: Remove legacy unauthenticated Supabase client

**Files:**
- Modify: `frontend/lib/supabase.ts`

**Step 1: Remove the legacy export**

Delete line 21 (the unauthenticated client export):

```typescript
// DELETE THIS LINE:
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Also remove the comment on line 20:
```typescript
// DELETE THIS LINE:
// Legacy client for migration (remove after full integration)
```

The file should now only export `createClerkSupabaseClient`.

**Step 2: Verify no code depends on it**

Run: `grep -r "import { supabase" frontend/`

Expected: No matches (nothing imports the legacy client).

**Step 3: Commit**

```bash
git add frontend/lib/supabase.ts
git commit -m "security: remove unauthenticated Supabase client"
```

---

## Summary

| Task | Description | Commit Message |
|------|-------------|----------------|
| 1 | Update middleware with route protection | `feat(auth): add route protection to middleware` |
| 2 | Create webhook API route | `feat(auth): add Clerk webhook handler for user sync` |
| 3 | Add sign-out redirect | `feat(auth): add sign-out redirect to homepage` |
| 4 | Remove redundant layout auth | `refactor(auth): remove redundant layout auth check` |
| 5 | Add environment variables | (no commit - .env.local) |
| 6 | Test middleware protection | (manual testing) |
| 7 | Configure Clerk webhook | (manual - Clerk Dashboard) |
| 8 | Remove legacy unauthenticated Supabase client | `security: remove unauthenticated Supabase client` |

**Total Tasks:** 8 (5 code changes, 1 env config, 2 manual setup/testing)
