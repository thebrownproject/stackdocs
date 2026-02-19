# Clerk + Supabase Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect Clerk authentication to Supabase so RLS policies restrict data access based on Clerk user IDs.

**Architecture:** Frontend uses Clerk session tokens with Supabase client via `accessToken()` callback. Backend validates tokens with Clerk Python SDK. All `user_id` columns change from UUID to TEXT to store Clerk IDs. RLS policies use `auth.jwt()->>'sub'` instead of `auth.uid()`.

**Tech Stack:** Clerk SDK (JS + Python), Supabase JS client, FastAPI, PostgreSQL

---

## Phase 1: Database Migration

### Task 1: Drop existing data and constraints

**Context:** All existing data is test data. We need to drop FK constraints and clear tables before changing column types.

**Step 1: Run migration to drop constraints and truncate**

Run this SQL in Supabase SQL Editor or via MCP:

```sql
-- Drop all foreign key constraints referencing user_id columns
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;
ALTER TABLE ocr_results DROP CONSTRAINT IF EXISTS ocr_results_user_id_fkey;
ALTER TABLE extractions DROP CONSTRAINT IF EXISTS extractions_user_id_fkey;
ALTER TABLE stacks DROP CONSTRAINT IF EXISTS stacks_user_id_fkey;
ALTER TABLE stack_tables DROP CONSTRAINT IF EXISTS stack_tables_user_id_fkey;
ALTER TABLE stack_table_rows DROP CONSTRAINT IF EXISTS stack_table_rows_user_id_fkey;

-- Drop FK from public.users to auth.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Drop existing RLS policies
DROP POLICY IF EXISTS users_user_isolation ON public.users;
DROP POLICY IF EXISTS documents_user_isolation ON documents;
DROP POLICY IF EXISTS ocr_results_user_isolation ON ocr_results;
DROP POLICY IF EXISTS extractions_user_isolation ON extractions;
DROP POLICY IF EXISTS stacks_user_isolation ON stacks;
DROP POLICY IF EXISTS stack_documents_user_isolation ON stack_documents;
DROP POLICY IF EXISTS stack_tables_user_isolation ON stack_tables;
DROP POLICY IF EXISTS stack_table_rows_user_isolation ON stack_table_rows;

-- Truncate all tables (test data only)
TRUNCATE TABLE stack_table_rows CASCADE;
TRUNCATE TABLE stack_tables CASCADE;
TRUNCATE TABLE stack_documents CASCADE;
TRUNCATE TABLE stacks CASCADE;
TRUNCATE TABLE extractions CASCADE;
TRUNCATE TABLE ocr_results CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE public.users CASCADE;
```

**Step 2: Verify constraints dropped**

Run: `SELECT conname FROM pg_constraint WHERE conname LIKE '%user%';`

Expected: No results related to user_id foreign keys.

---

### Task 2: Change user_id columns from UUID to TEXT

**Step 1: Alter column types**

```sql
-- Change public.users.id from UUID to TEXT
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT;

-- Change user_id columns in all tables
ALTER TABLE documents ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE ocr_results ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE extractions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE stacks ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE stack_tables ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE stack_table_rows ALTER COLUMN user_id TYPE TEXT;
```

**Step 2: Add default values for auto-population**

```sql
-- Set default to Clerk user ID from JWT
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE documents ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE ocr_results ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE extractions ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE stacks ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE stack_tables ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
ALTER TABLE stack_table_rows ALTER COLUMN user_id SET DEFAULT auth.jwt()->>'sub';
```

**Step 3: Verify column types**

Run:
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name IN ('id', 'user_id')
ORDER BY table_name;
```

Expected: All `user_id` columns show `text` type.

---

### Task 3: Create new RLS policies for Clerk JWT

**Step 1: Create policies using auth.jwt()->>'sub'**

```sql
-- Users table (id is the user_id)
CREATE POLICY "users_clerk_isolation" ON public.users
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = id);

-- Documents table
CREATE POLICY "documents_clerk_isolation" ON documents
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- OCR Results table
CREATE POLICY "ocr_results_clerk_isolation" ON ocr_results
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- Extractions table
CREATE POLICY "extractions_clerk_isolation" ON extractions
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- Stacks table
CREATE POLICY "stacks_clerk_isolation" ON stacks
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- Stack Documents table (via stack ownership)
CREATE POLICY "stack_documents_clerk_isolation" ON stack_documents
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM stacks
    WHERE stacks.id = stack_documents.stack_id
    AND stacks.user_id = (SELECT auth.jwt()->>'sub')
));

-- Stack Tables table
CREATE POLICY "stack_tables_clerk_isolation" ON stack_tables
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);

-- Stack Table Rows table
CREATE POLICY "stack_table_rows_clerk_isolation" ON stack_table_rows
FOR ALL TO authenticated
USING ((SELECT auth.jwt()->>'sub') = user_id);
```

**Step 2: Verify policies created**

Run:
```sql
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
```

Expected: 8 policies with `clerk_isolation` suffix, all using `auth.jwt()->>'sub'`.

---

## Phase 2: Frontend Supabase Client

### Task 4: Create authenticated Supabase client (client-side)

**Files:**
- Modify: `frontend/lib/supabase.ts`

**Step 1: Update client-side Supabase client**

```typescript
// frontend/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// For use in client components with Clerk session
export function createClerkSupabaseClient(getToken: () => Promise<string | null>): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: async () => {
        const token = await getToken()
        return token ? { Authorization: `Bearer ${token}` } : {}
      }
    }
  })
}

// Legacy client for migration (remove after full integration)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Step 2: Verify file saved**

Run: `cat frontend/lib/supabase.ts`

Expected: File contains `createClerkSupabaseClient` function.

**Step 3: Commit**

```bash
git add frontend/lib/supabase.ts
git commit -m "feat(frontend): add Clerk-authenticated Supabase client"
```

---

### Task 5: Create authenticated Supabase client (server-side)

**Files:**
- Create: `frontend/lib/supabase-server.ts`

**Step 1: Create server-side Supabase client**

```typescript
// frontend/lib/supabase-server.ts
import { auth } from '@clerk/nextjs/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const { getToken } = await auth()
  const token = await getToken()

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: token ? `Bearer ${token}` : ''
      }
    }
  })
}
```

**Step 2: Verify file created**

Run: `cat frontend/lib/supabase-server.ts`

Expected: File contains `createServerSupabaseClient` function.

**Step 3: Commit**

```bash
git add frontend/lib/supabase-server.ts
git commit -m "feat(frontend): add server-side Clerk Supabase client"
```

---

### Task 6: Create useSupabase hook for client components

**Files:**
- Create: `frontend/hooks/use-supabase.ts`

**Step 1: Create the hook**

```typescript
// frontend/hooks/use-supabase.ts
'use client'

import { useSession } from '@clerk/nextjs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useMemo } from 'react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function useSupabase(): SupabaseClient {
  const { session } = useSession()

  const client = useMemo(() => {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: async () => {
          const token = await session?.getToken()
          return token ? { Authorization: `Bearer ${token}` } : {}
        }
      }
    })
  }, [session])

  return client
}
```

**Step 2: Verify file created**

Run: `cat frontend/hooks/use-supabase.ts`

Expected: File contains `useSupabase` hook.

**Step 3: Commit**

```bash
git add frontend/hooks/use-supabase.ts
git commit -m "feat(frontend): add useSupabase hook for Clerk auth"
```

---

## Phase 3: Backend Authentication

### Task 7: Install Clerk Python SDK

**Files:**
- Modify: `backend/requirements.txt`

**Step 1: Add clerk-backend-api to requirements**

Add to `backend/requirements.txt`:
```
clerk-backend-api>=1.0.0
httpx>=0.27.0
```

**Step 2: Install dependencies**

Run: `cd backend && pip install -r requirements.txt`

Expected: Successfully installed clerk-backend-api and httpx.

**Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore(backend): add Clerk SDK dependency"
```

---

### Task 8: Add CLERK_SECRET_KEY to config

**Files:**
- Modify: `backend/app/config.py`

**Step 1: Add Clerk config to Settings class**

Add after line 19 (after MISTRAL_API_KEY):

```python
    # Clerk Configuration (for auth)
    CLERK_SECRET_KEY: str
    CLERK_AUTHORIZED_PARTIES: str = "https://www.stackdocs.io"  # Comma-separated
```

**Step 2: Verify config updated**

Run: `grep -n "CLERK" backend/app/config.py`

Expected: Lines showing CLERK_SECRET_KEY and CLERK_AUTHORIZED_PARTIES.

**Step 3: Commit**

```bash
git add backend/app/config.py
git commit -m "feat(backend): add Clerk config settings"
```

---

### Task 9: Create Clerk auth dependency

**Files:**
- Create: `backend/app/auth.py`

**Step 1: Create auth module**

```python
# backend/app/auth.py
"""Clerk authentication for FastAPI"""

import os
import httpx
from fastapi import Request, HTTPException, Depends
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from functools import lru_cache

from .config import get_settings


@lru_cache()
def get_clerk_client() -> Clerk:
    """Get cached Clerk client instance"""
    settings = get_settings()
    return Clerk(bearer_auth=settings.CLERK_SECRET_KEY)


async def get_current_user(request: Request) -> str:
    """
    FastAPI dependency to get authenticated Clerk user ID.

    Returns the Clerk user ID (sub claim) from the JWT.
    Raises 401 if not authenticated.
    """
    settings = get_settings()
    clerk = get_clerk_client()

    # Convert FastAPI request to httpx.Request for Clerk SDK
    httpx_request = httpx.Request(
        method=request.method,
        url=str(request.url),
        headers=dict(request.headers)
    )

    # Parse authorized parties from config
    authorized_parties = [
        p.strip() for p in settings.CLERK_AUTHORIZED_PARTIES.split(",")
    ]

    request_state = clerk.authenticate_request(
        httpx_request,
        AuthenticateRequestOptions(
            authorized_parties=authorized_parties
        )
    )

    if not request_state.is_signed_in:
        raise HTTPException(
            status_code=401,
            detail=f"Unauthorized: {request_state.reason}"
        )

    user_id = request_state.payload.get('sub')
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token: missing user ID"
        )

    return user_id


# Type alias for route dependency
CurrentUser = str
```

**Step 2: Verify file created**

Run: `cat backend/app/auth.py`

Expected: File contains `get_current_user` function.

**Step 3: Commit**

```bash
git add backend/app/auth.py
git commit -m "feat(backend): add Clerk auth dependency"
```

---

### Task 10: Update agent routes to use Clerk auth

**Files:**
- Modify: `backend/app/routes/agent.py`

**Step 1: Read current agent.py**

First, read the file to understand current structure.

**Step 2: Add auth dependency import**

Add near top of file after other imports:
```python
from ..auth import get_current_user
```

**Step 3: Update extract endpoint**

Change the extract endpoint signature to include auth:
```python
@router.post("/extract")
async def extract_document(
    request: ExtractRequest,
    user_id: str = Depends(get_current_user)
):
```

Replace any hardcoded or request-based user_id with the dependency.

**Step 4: Update correct endpoint similarly**

Add `user_id: str = Depends(get_current_user)` to the correct endpoint.

**Step 5: Verify changes**

Run: `grep -n "get_current_user\|Depends" backend/app/routes/agent.py`

Expected: Shows imports and usage in route functions.

**Step 6: Commit**

```bash
git add backend/app/routes/agent.py
git commit -m "feat(backend): protect agent routes with Clerk auth"
```

---

### Task 11: Update process routes to use Clerk auth

**Files:**
- Modify: `backend/app/routes/process.py`

**Step 1: Add auth dependency import**

Add near top of file:
```python
from ..auth import get_current_user
```

**Step 2: Update all route functions**

Add `user_id: str = Depends(get_current_user)` to:
- `process_document`
- `re_extract_document`

**Step 3: Verify changes**

Run: `grep -n "get_current_user\|Depends" backend/app/routes/process.py`

Expected: Shows imports and usage.

**Step 4: Commit**

```bash
git add backend/app/routes/process.py
git commit -m "feat(backend): protect process routes with Clerk auth"
```

---

## Phase 4: Environment & Verification

### Task 12: Update environment files

**Files:**
- Modify: `backend/.env` (local)
- Document: Production `.env` changes

**Step 1: Add to local backend/.env**

```
CLERK_SECRET_KEY=sk_test_xxx  # Get from Clerk Dashboard > API Keys
CLERK_AUTHORIZED_PARTIES=http://localhost:3000
```

**Step 2: Document production changes**

Create/update deployment notes - production `.env` needs:
```
CLERK_SECRET_KEY=sk_live_xxx
CLERK_AUTHORIZED_PARTIES=https://www.stackdocs.io
ALLOWED_ORIGINS=https://www.stackdocs.io
```

**Step 3: Verify local .env has Clerk key**

Run: `grep CLERK backend/.env`

Expected: Shows CLERK_SECRET_KEY (value hidden).

---

### Task 13: Update SCHEMA.md documentation

**Files:**
- Modify: `docs/SCHEMA.md`

**Step 1: Update user_id column documentation**

Change all references from UUID to TEXT and update RLS policy examples.

Key changes:
- `user_id UUID` → `user_id TEXT`
- `auth.uid() = user_id` → `(SELECT auth.jwt()->>'sub') = user_id`
- Add note about Clerk integration

**Step 2: Commit**

```bash
git add docs/SCHEMA.md
git commit -m "docs: update SCHEMA.md for Clerk integration"
```

---

### Task 14: Test the integration end-to-end

**Step 1: Start backend**

Run: `cd backend && uvicorn app.main:app --reload`

Expected: Server starts without errors.

**Step 2: Start frontend**

Run: `cd frontend && npm run dev`

Expected: Dev server starts.

**Step 3: Test authentication flow**

1. Open browser to `http://localhost:3000`
2. Sign in via Clerk
3. Navigate to Documents page
4. Open browser DevTools > Network
5. Check Supabase requests include Authorization header

**Step 4: Test RLS enforcement**

1. Create a test document (if upload endpoint ready)
2. Query documents table directly in Supabase dashboard
3. Verify `user_id` is a Clerk ID (starts with `user_`)

**Step 5: Test backend auth**

```bash
# Without token - should fail
curl http://localhost:8000/api/agent/health

# With token - should succeed (get token from browser DevTools)
curl -H "Authorization: Bearer <clerk_token>" http://localhost:8000/api/agent/health
```

---

### Task 15: Final commit and cleanup

**Step 1: Review all changes**

Run: `git status`

**Step 2: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: complete Clerk + Supabase integration"
```

**Step 3: Update ROADMAP.md**

Move Clerk + Supabase integration to completed section.

**Step 4: Final commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark Clerk + Supabase integration complete"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-3 | Database migration (drop constraints, change types, create RLS) |
| 2 | 4-6 | Frontend Supabase clients (client + server + hook) |
| 3 | 7-11 | Backend auth (SDK, config, dependency, routes) |
| 4 | 12-15 | Environment, docs, testing, cleanup |

**Total Tasks:** 15
**Estimated Time:** 2-3 hours

**Critical Path:**
1. Database migration must complete first (Phase 1)
2. Frontend and backend can be done in parallel (Phase 2 & 3)
3. Testing requires both frontend and backend complete (Phase 4)
