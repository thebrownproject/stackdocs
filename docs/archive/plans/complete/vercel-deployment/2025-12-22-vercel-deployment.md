# Vercel Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the Next.js frontend to Vercel and verify the Clerk webhook syncs users to Supabase.

**Architecture:** Push to main triggers Vercel auto-deploy. Vercel needs environment variables for Supabase and Clerk. Clerk webhook endpoint must be updated to production URL.

**Tech Stack:** Vercel, Clerk Webhooks, Supabase, Next.js

---

## Prerequisites

Before starting, ensure you have:
- Access to Vercel project (stackdocs)
- Access to Clerk Dashboard
- Access to Supabase Dashboard
- Git push access to main branch

---

### Task 1: Verify Git Status

**Goal:** Confirm all code is committed and ready to deploy.

**Step 1: Check git status**

Run:
```bash
git status
```

Expected: `nothing to commit, working tree clean`

**Step 2: Check current branch**

Run:
```bash
git branch --show-current
```

Expected: `main`

---

### Task 2: Push to Main (Triggers Vercel Deploy)

**Goal:** Deploy the latest code to Vercel.

**Step 1: Push to remote**

Run:
```bash
git push origin main
```

Expected: `Everything up-to-date` (if already pushed) or successful push output

**Step 2: Monitor Vercel deployment**

Navigate to: https://vercel.com/dashboard (or check Vercel CLI)

Expected: Deployment starts automatically, builds successfully

**Step 3: Note the deployment URL**

Once complete, note the production URL: `https://www.stackdocs.io`

---

### Task 3: Configure Vercel Environment Variables

**Goal:** Add the required environment variables to Vercel.

**Step 1: Open Vercel project settings**

Navigate to: Vercel Dashboard > stackdocs > Settings > Environment Variables

**Step 2: Add SUPABASE_SERVICE_ROLE_KEY**

| Field | Value |
|-------|-------|
| Key | `SUPABASE_SERVICE_ROLE_KEY` |
| Value | (Get from Supabase Dashboard > Settings > API > service_role key) |
| Environment | Production, Preview, Development |

**Step 3: Add CLERK_WEBHOOK_SIGNING_SECRET**

| Field | Value |
|-------|-------|
| Key | `CLERK_WEBHOOK_SIGNING_SECRET` |
| Value | (Get from Clerk Dashboard > Webhooks > Endpoint > Signing Secret) |
| Environment | Production, Preview, Development |

**Step 4: Verify existing variables**

Confirm these are already set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_API_URL`

---

### Task 4: Redeploy with New Environment Variables

**Goal:** Trigger a redeploy so the new env vars take effect.

**Step 1: Trigger redeploy in Vercel**

Navigate to: Vercel Dashboard > stackdocs > Deployments > Latest > Redeploy

Select: "Redeploy with existing Build Cache" (faster) or full rebuild

**Step 2: Wait for deployment to complete**

Expected: Deployment succeeds with new environment variables

---

### Task 5: Update Clerk Webhook Endpoint

**Goal:** Point Clerk webhook to production URL.

**Step 1: Open Clerk Dashboard webhooks**

Navigate to: Clerk Dashboard > Webhooks

**Step 2: Edit the existing endpoint (or create new)**

| Field | Value |
|-------|-------|
| Endpoint URL | `https://www.stackdocs.io/api/webhooks/clerk` |
| Events | `user.created`, `user.updated`, `user.deleted` |

**Step 3: Save and copy the Signing Secret**

If creating new endpoint, copy the Signing Secret and add to Vercel (Task 3).

---

### Task 6: Test Webhook with New User Signup

**Goal:** Verify the complete auth flow works.

**Step 1: Open production site in incognito**

Navigate to: https://www.stackdocs.io

Expected: Redirects to sign-in (middleware protection working)

**Step 2: Sign up with a new account**

Use a new email address (or Google account not used before)

Complete the signup flow

**Step 3: Verify webhook delivery in Clerk**

Navigate to: Clerk Dashboard > Webhooks > Endpoint > Logs

Expected: `user.created` event shows as "Delivered" with 200 status

---

### Task 7: Verify User in Supabase

**Goal:** Confirm the user was synced to the database.

**Step 1: Open Supabase Table Editor**

Navigate to: Supabase Dashboard > Table Editor > users

**Step 2: Search for the new user**

Look for a row with:
- `id` matching the Clerk user ID (visible in Clerk Dashboard > Users)
- `email` matching the signup email

Expected: User row exists with correct ID and email

**Step 3: Document success**

If user exists, the webhook integration is working correctly.

---

### Task 8: Clean Up Test User (Optional)

**Goal:** Remove test data if desired.

**Step 1: Delete user from Clerk**

Navigate to: Clerk Dashboard > Users > [test user] > Delete

**Step 2: Verify cascade to Supabase**

Check: Webhook logs show `user.deleted` delivered

Check: User row removed from Supabase `users` table

---

## Completion Checklist

- [ ] Code pushed to main
- [ ] Vercel deployment successful
- [ ] Environment variables configured in Vercel
- [ ] Clerk webhook pointing to production URL
- [ ] Test signup completed
- [ ] User appears in Supabase
- [ ] (Optional) Test user cleaned up

## Troubleshooting

**Webhook returns 400:**
- Check `CLERK_WEBHOOK_SIGNING_SECRET` matches the endpoint's signing secret
- Verify the endpoint URL is exactly `https://www.stackdocs.io/api/webhooks/clerk`

**User not appearing in Supabase:**
- Check Vercel function logs for errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check Supabase RLS isn't blocking the service role (it shouldn't)

**Deployment fails:**
- Check Vercel build logs for errors
- Ensure all required env vars are set
