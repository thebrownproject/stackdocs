# Trestle

![Status](https://img.shields.io/badge/status-in_development-yellow)
![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Anthropic](https://img.shields.io/badge/Claude-D97757?logo=anthropic&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-6C47FF?logo=clerk&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

> Document-processing agents with a measured accuracy number before you pay.

## Overview

Trestle turns a customer's labelled documents into a tuned extraction **agent**.
There is one shared agent runtime; each account's behaviour comes entirely from a
versioned **config bundle** (rules + field schema + few-shot exemplars +
confidence calibration). An eval **harness** produces those bundles and reports a
held-out accuracy number — the "trust before you pay" moment.

In production, documents flow through the tuned agent and results are routed by
**calibrated confidence**: high-confidence results are delivered to the
customer's system; low-confidence ones drop into a review queue, and the human
corrections become new labelled samples that improve the next run.

## How it works

```
SETUP (harness)        upload labelled samples → infer schema → 80/20 split
                       → baseline → TUNE (strong model proposes rules) → held-out
                       → calibrate → promote bundle + accuracy summary

PRODUCTION (runtime)   document in → tuned agent (reason + tools, then output)
                       → route by calibrated confidence
                          ├─ high  → signed webhook / API response
                          └─ low   → review queue → correction → new sample
```

The agent is a real multi-step agent: Anthropic extended thinking plus a tool
loop (verify totals, normalise dates, plus per-account custom tools) that runs
**before** it emits structured output. Documents are read directly (no OCR).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 16 on Vercel (TypeScript)                        │
│                                                            │
│  Dashboard (Clerk auth) ── agent console + monitor         │
│  API routes ── /api/extract (API key) · /api/agents/*      │
│  Agent runtime ── Vercel AI SDK v6 + Anthropic             │
│  Eval harness ── schema-infer · split · scorers · scoring  │
│                  · calibration · orchestrator              │
└───────────────────────────┬───────────────────────────────┘
                            │
                  Supabase (Postgres + Storage, RLS)
```

No separate backend service — inference and training run in Next.js route
handlers. The runtime is stateless across documents (fits Vercel functions) and
portable to a container/VPC for enterprise isolation without changing the code.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Clerk (auth) ·
Supabase (Postgres + Storage + RLS) · Vercel AI SDK v6 · Anthropic Claude.

## Integration surface

- **In:** API push (`POST /api/extract`, Bearer API key), manual upload in the
  dashboard, per-agent inbound email (stub).
- **Out:** synchronous JSON response, signed webhook (HMAC-SHA256, retried), and
  the review queue for low-confidence items.

## Quick start

```bash
cd frontend
cp .env.local.example .env.local   # fill in keys
npm install
npm run dev
```

Apply the migrations in `supabase/migrations/` to your Supabase project.

### Verify the pipeline

`npm run verify` runs the full headless loop (schema infer → train → held-out
accuracy → extract) against a live Supabase + Anthropic stack. See
`frontend/scripts/verify-pipeline.ts` for the fixture format.

### Environment

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN=inbound.trestle.dev   # optional
```

## Design docs

`docs/specs/TRESTLE-ARCHITECTURE.md` is the current source of truth.
