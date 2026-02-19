# Planning Folder Reorganization Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate scattered planning docs into a clean kanban-style structure under `docs/`

**Architecture:** Single `docs/` folder with reference docs at root and kanban-organized feature plans in `plans/`. Superpowers workflow integrates naturally - designs/plans go to `in-progress/<feature>/`, move to `complete/` when done.

**Problem Solved:** Document sprawl causing overwhelm and lost motivation. New structure provides visual clarity, reduces cognitive load, and matches natural workflow.

---

## Final Structure

```
docs/
├── CLAUDE.md              # Index + superpowers workflow instructions
├── DEV-NOTES.md           # Session continuity (for /continue command)
├── ROADMAP.md             # Prioritized features
├── PRD.md                 # Product requirements
├── ARCHITECTURE.md        # System design
├── SCHEMA.md              # Database schema
└── plans/
    ├── todo/              # Features designed, ready to implement
    ├── in-progress/       # Currently being worked on
    │   └── <feature>/
    │       ├── YYYY-MM-DD-<feature>-design.md
    │       ├── YYYY-MM-DD-<feature>-plan.md
    │       └── notes.md (optional)
    ├── complete/          # Done
    └── archive/           # Superseded/abandoned plans
```

## Workflow

### Creating New Features
1. `/superpowers:brainstorm` → creates design doc
2. Save to: `plans/in-progress/<feature>/YYYY-MM-DD-<feature>-design.md`
3. `/superpowers:write-plan` → creates implementation plan
4. Save to: same folder as design

### Completing Features
1. Finish execution via `/superpowers:execute-plan`
2. Move folder: `git mv plans/in-progress/<feature> plans/complete/`
3. Update reference docs (ARCHITECTURE.md, SCHEMA.md) to reflect new reality

### Parking Ideas
- Not ready to start? Move to `plans/todo/`
- Abandoned? Move to `plans/archive/`

## Reference Doc Update Triggers

| File | Update Trigger |
|------|----------------|
| DEV-NOTES.md | End of each session |
| ROADMAP.md | Priorities shift or feature completes |
| PRD.md | Product scope changes (rare) |
| ARCHITECTURE.md | Feature moves to `complete/` |
| SCHEMA.md | Database changes land |

## Root CLAUDE.md Changes

Slim down to project essentials:
- Keep: Project overview, tech stack, API endpoints, env vars, deployment, code principles
- Remove: Planning Documents section, detailed architecture, task breakdowns
- Add: Single line pointing to `docs/CLAUDE.md` for planning context

## Migration Plan

### Phase 1: Folder Structure (COMPLETE)
- [x] Create folder structure (`docs/plans/todo`, `in-progress`, `complete`, `archive`)
- [x] Move reference docs from `planning/` to `docs/`
- [x] Migrate existing feature work (agent-sdk, stacks-schema) to `plans/in-progress/`
- [x] Archive old/superseded docs
- [x] Create `docs/CLAUDE.md` with index + workflow instructions
- [x] Slim down root `CLAUDE.md`
- [x] Delete empty `planning/` folder

### Phase 2: Content Review (IN PROGRESS)
- [x] Review `docs/plans/in-progress/agent-sdk/` - assess completion status
  - Backend Phases 1-5 complete, Phase 6-7 (frontend) pending
- [x] Review `docs/plans/in-progress/stacks-schema/` - assess completion status
  - Database ready, no implementation - moved to todo/
- [x] Refactor `stacks-schema/` to superpowers format
  - Created `docs/plans/todo/stacks/2025-12-20-stacks-design.md`
  - Created `docs/plans/todo/stacks/2025-12-20-stacks-plan.md`
  - Archived old docs to `archive/` subfolder
- [x] Refactor `agent-sdk/` to superpowers format
  - Renamed folder to `extraction-agent/` (matches backend code)
  - Created `docs/plans/in-progress/extraction-agent/2025-12-20-extraction-agent-design.md`
  - Created `docs/plans/in-progress/extraction-agent/2025-12-20-extraction-agent-plan.md`
  - Archived 5 old docs to `archive/` subfolder
- [x] Organize project-level archive
  - Created `docs/plans/archive/2024-12-langchain-migration/` for completed migration docs
  - Kept `AGENT-NATIVE-ARCHITECTURE.md` at archive root as strategic reference
- [x] Update reference docs (ARCHITECTURE, SCHEMA, PRD, ROADMAP) to reflect current reality
- [x] Move this folder to `complete/` when done
