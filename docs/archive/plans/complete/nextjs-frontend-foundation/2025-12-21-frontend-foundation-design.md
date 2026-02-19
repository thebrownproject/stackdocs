# Next.js Frontend Foundation - Design

**Created**: 2025-12-21
**Status**: Ready for Planning

---

## Overview

Set up Next.js frontend foundation with shadcn/ui Nova style for Stackdocs MVP. This creates the technical foundation (project structure, dependencies, authentication, basic navigation) before building UI components.

---

## Requirements

### Technical Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: shadcn/ui with Nova style preset
  - Nova style: Compact layouts, reduced padding/margins (optimal for data-heavy apps)
  - Neutral theme: Grayscale palette with dark/light mode
  - HugeIcons: Large, prominent icon set
  - Font: Inter
  - Radium: Small
- **Authentication**: Clerk
- **Database**: Supabase (direct access for CRUD operations)
- **Backend Integration**: FastAPI (for agent operations only via SSE)

### Navigation Structure

```
Sidebar Navigation:
├── Workspace
│   ├── Documents      (upload, list, manage)
│   └── Extractions    (view, edit individual doc extractions)
└── Stacks
    ├── [Stack 1]      (batch processing)
    ├── [Stack 2]
    └── [etc]
```

**Notes**:

- Stacks are dynamically added by user
- Nova style selected over Mira (better accessibility while still compact)

---

## Architecture Alignment

**Frontend Architecture** (from `docs/ARCHITECTURE.md`):

```
┌─────────────────────────────────────┐
│  Next.js Frontend (www.stackdocs)   │
├─────────────────────────────────────┤
│  Supabase (Direct)  │  FastAPI      │
│  ────────────────   │  (Agents)     │
│  • Auth             │  • Upload     │
│  • CRUD operations  │  • Extract    │
│  • Realtime         │  • Update     │
└──────────┬──────────┴───────┬───────┘
           │                   │
           ▼                   ▼
      Supabase DB         FastAPI API
```

**Integration Points**:

1. **Supabase Client**: Direct database reads/writes, auth, storage
2. **FastAPI**: Only for agent operations (upload, extract, update) via SSE
3. **Realtime**: Supabase Realtime for instant status updates

---

## Component Strategy

### Phase 1: Foundation (This Plan)

1. **Sidebar Navigation**
   - Use `shadcn sidebar-08` as boilerplate
   - Implement Workspace/Stacks structure
2. **Authentication**
   - Clerk integration
   - Protected routes
3. **Environment Setup**
   - Supabase client configuration
   - Clerk configuration

### Phase 2: MVP Features (Future)

1. **Documents Page**
   - File upload to Supabase Storage
   - Document list with status
2. **Extractions Page**
   - View/edit extracted data
   - Dynamic columns from extraction schema
3. **Stacks Pages**
   - Create/manage stacks
   - Batch extraction interface

---

## Dependencies to Install

### Required Packages

```bash
# Next.js (auto with shadcn create)
next@16

# UI Framework
shadcn/ui with Nova preset
@radix-ui components
tailwindcss
class-variance-authority
clsx
tailwind-merge

# Icons
@hugeicons/react

# Authentication
@clerk/nextjs

# Database
@supabase/supabase-js

# Additional
lucide-react (fallback icons)
```

### Development Dependencies

```bash
typescript
@types/node
@types/react
@types/react-dom
eslint
postcss
autoprefixer
```

---

## Environment Variables

**Backend** (`.env.local`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key

# API (for agent operations)
NEXT_PUBLIC_API_URL=https://api.stackdocs.io
```

---

## File Structure

```
frontend/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Auth routes group
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (dashboard)/         # Protected routes
│   │   ├── documents/
│   │   ├── extractions/
│   │   └── stacks/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                  # shadcn components
│   ├── sidebar/
│   │   ├── sidebar-nav.tsx  # Main navigation
│   │   └── sidebar-08.tsx   # From shadcn preset
│   └── auth/
│       └── clerk-provider.tsx
├── lib/
│   ├── supabase.ts          # Supabase client
│   └── utils.ts             # Utility functions
├── middleware.ts            # Clerk route protection
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

---

## Implementation Order

1. **Project Initialization**

   - Run `npx shadcn create` with Nova preset
   - Install additional packages (Supabase, Clerk)

2. **Configuration**

   - Setup environment variables
   - Configure Supabase client
   - Setup Clerk authentication

3. **Navigation Foundation**

   - Import sidebar-08 component
   - Implement Workspace/Stacks structure
   - Create protected route middleware

4. **Testing**
   - Verify dev server runs
   - Test Nova styling loads
   - Verify auth flow works
   - Confirm Supabase connection

---

## Key Decisions

| Decision          | Choice               | Reasoning                                           |
| ----------------- | -------------------- | --------------------------------------------------- |
| Auth Provider     | Clerk                | Modern, feature-rich, easy Next.js integration      |
| Database Access   | Direct Supabase      | Faster, leverages Supabase features (Realtime, RLS) |
| Backend Usage     | FastAPI agents only  | Keep AI operations isolated, SSE streaming          |
| Sidebar Component | sidebar-08           | Solid foundation, can customize as needed           |
| Nova Style        | Compact + accessible | Better than Mira for MVP, still dense enough        |

---

## Success Criteria

- ✅ Next.js project runs without errors
- ✅ Nova styling applied (compact, neutral theme)
- ✅ Clerk authentication working
- ✅ Supabase client configured
- ✅ Sidebar navigation with Workspace/Stacks structure
- ✅ Environment variables template created

---

## Notes

- **UI/UX**: Will be refined in future features (Documents, Extractions pages)
- **Database Schema**: Existing (no changes needed for foundation)
- **Agent Integration**: Future phase (after frontend foundation complete)
