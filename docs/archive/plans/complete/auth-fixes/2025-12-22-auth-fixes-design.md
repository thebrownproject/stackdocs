# Auth Fixes Design

**Date:** 2025-12-22
**Status:** Designed, ready for implementation

## Overview

Completes Clerk authentication setup with edge middleware protection, user sync webhooks, and cleanup of redundant code.

## Problem

Current setup has gaps:
1. **No edge protection** - `proxy.ts` exists but doesn't block unauthenticated users
2. **No user sync** - Clerk users aren't synced to `users` table (breaks usage tracking)
3. **No sign-out redirect** - Users stay on protected routes after signing out
4. **Redundant code** - `auth.protect()` in layout duplicates middleware responsibility

## Solution

### 1. Middleware Route Protection

**File:** `frontend/proxy.ts`

Update existing middleware to protect routes at the edge.

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',           // Homepage
  '/pricing',    // Future marketing pages
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
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

**Why edge middleware:**
- Runs before page loads (no flash of protected content)
- Centralizes auth rules in one place
- Better performance than layout-level checks

### 2. Webhook Handler for User Sync

**File:** `frontend/app/api/webhooks/clerk/route.ts` (new)

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
      const email = email_addresses.find(e => e.id === primary_email_address_id)?.email_address

      // Upsert for idempotency (handles duplicate webhook deliveries)
      await supabase.from('users').upsert({ id, email }, { onConflict: 'id' })
    }

    if (evt.type === 'user.updated') {
      const { id, email_addresses, primary_email_address_id } = evt.data
      const email = email_addresses.find(e => e.id === primary_email_address_id)?.email_address

      await supabase.from('users').update({ email }).eq('id', id)
    }

    if (evt.type === 'user.deleted') {
      await supabase.from('users').delete().eq('id', evt.data.id)
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Webhook verification failed', { status: 400 })
  }
}
```

**Why webhooks:**
- Real-time sync (updates within seconds)
- Event-driven (no polling)
- Clerk's `verifyWebhook()` handles signature verification

**Events handled:**
- `user.created` - Insert new user row
- `user.updated` - Update email if changed
- `user.deleted` - Remove user row

### 3. Sign-Out Redirect

**File:** `frontend/components/app-sidebar.tsx`

Add `afterSignOutUrl` to UserButton:

```typescript
<UserButton
  showName
  afterSignOutUrl="/"
  appearance={{ ... }}
/>
```

### 4. Remove Redundant Auth Check

**File:** `frontend/app/(app)/layout.tsx`

Remove `await auth.protect()` - middleware now handles this.

## Environment Variables

**Add to `frontend/.env.local`:**
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxx  # From Clerk Dashboard
```

## Clerk Dashboard Configuration

1. Go to **Webhooks** in Clerk Dashboard
2. Add endpoint: `https://www.stackdocs.io/api/webhooks/clerk` (production)
3. Select events: `user.created`, `user.updated`, `user.deleted`
4. Copy signing secret to `CLERK_WEBHOOK_SIGNING_SECRET`

For local development, use ngrok or similar to expose localhost.

## Changes Summary

| Item | File | Change |
|------|------|--------|
| Route protection | `proxy.ts` | Add `createRouteMatcher` + `auth.protect()` |
| Webhook handler | `app/api/webhooks/clerk/route.ts` | New file |
| Sign-out redirect | `components/app-sidebar.tsx` | Add `afterSignOutUrl="/"` |
| Remove redundant auth | `app/(app)/layout.tsx` | Remove `await auth.protect()` |
| Env variables | `.env.local` | Add service role key + webhook secret |

## Testing

1. **Middleware**: Visit `/documents` while signed out → should redirect to sign-in
2. **Webhook**: Sign up new user → check `users` table has row
3. **Sign-out**: Click sign out → should redirect to homepage

## Dependencies

- Existing: `@clerk/nextjs` (already installed)
- Existing: `@supabase/supabase-js` (already installed)
- No new dependencies required
