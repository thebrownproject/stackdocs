# Frontend CLAUDE.md

See root `CLAUDE.md` for project overview, tech stack, and development workflow.

## Quick Facts

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (new-york style)
- **Auth**: Clerk (modal sign-in/sign-up)
- **Data**: Supabase client (direct reads/writes), FastAPI (AI operations only)

## Directory Structure

```
frontend/
├── app/
│   ├── (app)/                    # Protected routes (requires auth)
│   │   ├── @header/              # Parallel route for page headers
│   │   │   ├── documents/        # Documents list/detail headers
│   │   │   └── stacks/           # Stacks list/detail headers
│   │   ├── @subbar/              # Parallel route for page toolbars
│   │   │   ├── documents/        # Documents list/detail subbars
│   │   │   └── stacks/           # Stacks list/detail subbars
│   │   ├── documents/            # Documents list and detail pages
│   │   └── stacks/               # Stacks list and detail pages
│   └── api/webhooks/clerk/       # Clerk webhook for user sync
├── components/                   # See CLAUDE.md in each folder for details
│   ├── agent/                    # Agent flow system (upload, extraction, stacks)
│   ├── documents/                # Document tables, detail views, filters
│   ├── icons/                    # Tabler icon barrel export
│   ├── layout/                   # Headers, subbars, sidebar
│   │   └── sidebar/              # Navigation sidebar components
│   ├── preview-panel/            # Document preview (PDF/OCR text)
│   ├── providers/                # Context providers (theme)
│   ├── shared/                   # Reusable components (file-type-icon, stack-badges)
│   ├── stacks/                   # Stack list, detail views, tables
│   └── ui/                       # shadcn/ui primitives
├── public/                       # Static assets
├── lib/
│   ├── queries/                  # Data fetching with React cache()
│   └── supabase/                 # Supabase client setup
├── hooks/                        # Custom React hooks
└── types/                        # TypeScript type definitions
```

## Key Patterns

### Clerk Auth with Next.js 16 (proxy.ts)

Next.js 16 renamed `middleware.ts` to `proxy.ts` and requires the exported function to be named `proxy`. Clerk's `clerkMiddleware()` must be wrapped:

```typescript
// proxy.ts - CORRECT for Next.js 16
export function proxy(req: NextRequest, event: NextFetchEvent) {
  return clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
  })(req, event)
}
```

**Do NOT use** `export default clerkMiddleware()` - this pattern from Clerk docs is for Next.js 15 and earlier. Next.js 16 won't detect it, causing `auth()` calls in server components to fail with "clerkMiddleware not detected" errors.

If you see this error, check that `proxy.ts` uses `export function proxy(...)` wrapper.

### Page Headers (@header parallel route)

Page-specific headers live in `app/(app)/@header/` as a parallel route slot. The layout renders the `header` prop in the PageHeader component.

- `@header/documents/page.tsx` - Header for documents list
- `@header/documents/[id]/page.tsx` - Header for document detail
- Use `default.tsx` files for route fallbacks

**Why**: Server-component friendly, no hydration issues, idiomatic Next.js pattern.

### Page Subbars (@subbar parallel route)

Same pattern as headers. Filter contexts (e.g., `DocumentsFilterContext`) share state between subbar and page content.

### Data Fetching

- **Reads/writes**: Use Supabase client directly (no FastAPI)
- **AI operations**: Call FastAPI endpoints (extraction, OCR)
- **Deduplication**: Wrap shared fetches with `cache()` from React (see `lib/queries/`)

### Components

- **Always use shadcn/ui** for primitives (Button, Input, Card, Dialog, etc.)
- Don't use raw HTML elements (`<button>`, `<input>`) - use shadcn equivalents
- Component location: feature-specific in `components/<feature>/`, shared UI in `components/ui/`

### Icons

All icons use Tabler Icons via `@/components/icons` barrel export. Never import directly from `@tabler/icons-react`.

```typescript
import * as Icons from "@/components/icons"
<Icons.Check className="size-4" />
```

See `components/icons/CLAUDE.md` for naming conventions and adding new icons.

### Agent Flow System

Floating card at bottom of screen for uploads, extractions, and stack management. Uses a registry-based flow system.

See `components/agent/CLAUDE.md` for architecture, flows, and adding new flows.
