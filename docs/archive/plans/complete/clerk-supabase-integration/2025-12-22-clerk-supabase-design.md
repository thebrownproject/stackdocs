# Clerk + Supabase Integration Design

**Date:** 2025-12-22
**Status:** Ready for implementation

---

## Goal

Connect Clerk authentication to Supabase so RLS policies restrict data access based on Clerk user IDs, enabling secure multi-tenant data isolation.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Clerk       │     │   Frontend      │     │    Supabase     │
│  (Auth Provider)│     │   (Next.js)     │     │   (Database)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. User signs in     │                       │
         │◄──────────────────────│                       │
         │                       │                       │
         │  2. Session token     │                       │
         │──────────────────────►│                       │
         │                       │                       │
         │                       │  3. Request + token   │
         │                       │──────────────────────►│
         │                       │                       │
         │                       │  4. RLS checks JWT    │
         │                       │   auth.jwt()->>'sub'  │
         │                       │   = user_id column    │
         │                       │◄──────────────────────│
         │                       │                       │
         │                       │  5. Filtered data     │
         │                       │◄──────────────────────│
```

**Two data paths:**

| Path | Auth | Data Access |
|------|------|-------------|
| Frontend → Supabase | Clerk token via `accessToken()` | RLS enforced |
| Frontend → FastAPI → Supabase | Clerk SDK validates token | Service role key |

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| User ID type | TEXT (not UUID) | Clerk IDs are strings like `user_2abc...` |
| User sync | Just-in-time creation | Simpler than webhooks, user created on first action |
| Backend auth | Clerk Python SDK | Official approach, `authenticate_request()` |
| Keep `public.users` table | Yes | Needed for usage tracking (documents_limit, etc.) |

## Schema Changes

All `user_id` columns change from UUID to TEXT:

```sql
-- Before
user_id UUID REFERENCES auth.users(id)

-- After
user_id TEXT NOT NULL DEFAULT auth.jwt()->>'sub'
```

**Tables affected:** users, documents, ocr_results, extractions, stacks, stack_tables, stack_table_rows

## RLS Policy Pattern

```sql
CREATE POLICY "table_user_isolation" ON table_name
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);
```

## Frontend Supabase Client

```typescript
// Client-side
function createClerkSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      async accessToken() {
        return session?.getToken() ?? null
      },
    },
  )
}

// Server-side
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!,
    {
      async accessToken() {
        return (await auth()).getToken()
      },
    },
  )
}
```

## Backend Authentication

```python
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions

clerk = Clerk(bearer_auth=os.getenv('CLERK_SECRET_KEY'))

async def get_current_user(request: Request) -> str:
    httpx_request = httpx.Request(
        method=request.method,
        url=str(request.url),
        headers=dict(request.headers)
    )

    request_state = clerk.authenticate_request(
        httpx_request,
        AuthenticateRequestOptions(
            authorized_parties=['https://www.stackdocs.io']
        )
    )

    if not request_state.is_signed_in:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return request_state.payload.get('sub')
```

## Security Model

| Concern | Mitigation |
|---------|------------|
| Service role key exposure | Only in backend `.env`, never frontend |
| RLS on all tables | All 8 tables get updated policies |
| Backend validates user | `get_current_user` dependency on all routes |
| Cross-origin requests | CORS restricted to `www.stackdocs.io` |
| Token spoofing | `authorized_parties` in Clerk SDK config |

## Environment Variables

**Frontend (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=eyJ...  # anon key
```

**Backend (.env):**
```
CLERK_SECRET_KEY=sk_live_xxx
ALLOWED_ORIGINS=https://www.stackdocs.io
```

## Dashboard Configuration (Manual Steps)

1. **Clerk Dashboard:** Activate Supabase integration → copy Clerk domain
2. **Supabase Dashboard:** Authentication > Sign In/Up > Add Clerk provider → paste domain

**Completed:** Clerk domain `worthy-rodent-66.clerk.accounts.dev` configured.

## References

- [Clerk Supabase Integration Docs](https://clerk.com/docs/guides/development/integrations/databases/supabase)
- [Supabase Third-Party Auth](https://supabase.com/docs/guides/auth/third-party/clerk)
