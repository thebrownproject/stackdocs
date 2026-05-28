# Frontend CLAUDE.md

See root `CLAUDE.md` for project overview and `docs/specs/TRESTLE-ARCHITECTURE.md`
for the system design.

## Quick Facts

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (new-york style)
- **Auth**: Clerk (modal sign-in/sign-up)
- **Data**: Supabase (Postgres + Storage). Reads via Clerk-scoped client (RLS);
  server routes use the service-role admin client.
- **AI**: in-process via Vercel AI SDK v6 + Anthropic. There is **no** separate
  backend service — all inference and training run in Next.js route handlers.

## What this app is (Trestle)

One shared extraction **agent**, parameterised per account by a tuned **config
bundle** (rules + field schema + few-shot + calibration). An eval **harness**
produces those bundles and a measured held-out accuracy number before the
customer pays. Production docs run through the tuned agent; results route by
calibrated confidence (webhook vs review queue). Corrections become new samples.

## Directory Structure

```
frontend/
├── app/
│   ├── (app)/                      # Protected dashboard (Clerk)
│   │   ├── @header/agents|documents/   # Breadcrumb header slots (parallel route)
│   │   ├── agents/[id]/             # Agent monitor + console
│   │   └── documents/               # Production-docs list (placeholder, build out later)
│   └── api/
│       ├── extract/                 # Embeddable inference — API-key (Bearer) auth
│       └── agents/                  # CRUD + [id]/{samples,train,evals,process,rotate-key,review}
├── components/
│   ├── agents/                      # Monitor + interactive console (client components)
│   ├── layout/ (+ sidebar/)         # Sidebar, page header
│   └── ui/                          # shadcn/ui primitives
├── lib/
│   ├── agent/                       # runtime (the agent), process (production core), models, schema-to-zod
│   ├── harness/                     # schema-infer · split · scorers · scoring · calibration · orchestrator
│   ├── adapters/                    # webhook delivery
│   ├── auth/api-key · inbound · sse · supabase-{admin,server}
│   └── queries/                     # server-side reads (React cache)
└── types/                           # agents, documents
```

## Key Patterns

### Clerk Auth with Next.js 16 (proxy.ts)

Next.js 16 renamed `middleware.ts` to `proxy.ts` and requires an exported
`proxy` function wrapping `clerkMiddleware()`. Do **not** `export default
clerkMiddleware()` (Next 15 pattern) — `auth()` in server components fails with
"clerkMiddleware not detected".

### Two Supabase clients

- `createServerSupabaseClient()` — Clerk-JWT scoped, RLS-enforced; for dashboard reads.
- `createAdminSupabaseClient()` — service-role, bypasses RLS; for API route handlers
  that set `user_id` explicitly (and for `/api/extract`, which is API-key authed).

### The agent runtime (`lib/agent/runtime.ts`)

A real multi-step agent: Anthropic extended thinking + a tool loop
(`stopWhen: stepCountIs`) that verifies (built-in `calculate`, `validate_date`,
plus per-agent `tools`) before emitting structured output via `Output.object`.
Stateless across documents → runs fine on Vercel functions; portable to a
container/VPC for enterprise isolation without changing the runtime.

### Training

`/api/agents/[id]/train` streams the harness (`runTraining`) as SSE:
`load → schema_infer → split → baseline → held_out → complete`. It
auto-promotes the bundle (sets `active_bundle_version`, `accuracy_summary`).

### Components

Use shadcn/ui primitives. Icons via the `@/components/icons` barrel (Tabler).
Interactive console pieces are client components under `components/agents/`.

## Verify the pipeline

`npm run verify` runs the full headless path against a live Supabase + Anthropic
stack (see `scripts/verify-pipeline.ts`). Requires `.env.local` + fixtures.
