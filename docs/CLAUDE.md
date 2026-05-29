# Stackdocs Planning

## Space-Agents Workflow

### Creating New Features
1. `/exploration` → select brainstorm mode for design exploration
2. `/exploration-plan` → creates implementation tasks in Beads
3. Tasks tracked via `bd list`, `bd show <id>`, etc.

### Completing Features
1. Finish execution via `/mission` (solo, orchestrated, or ralph modes)
2. Close tasks: `bd close <id>`
3. **Update reference docs** (`specs/TRESTLE-ARCHITECTURE.md`, the `supabase/migrations/`) to reflect new reality

> **Legacy:** Old plan documents archived at `docs/archive/plans/`, and the
> pre-Trestle Stackdocs specs (PRD/ARCHITECTURE/SCHEMA) at `docs/archive/specs/`
> (read-only reference).

---

## CAPCOM (Session History)

Never read in full. Grep to find what you need:

```bash
# List all sessions (shows date + what was done)
grep "^## Session" .space-agents/comms/capcom.md

# Find sessions about a topic
grep "^## Session.*OCR\|^## Session.*Migration" .space-agents/comms/capcom.md

# Then read specific session with offset
```

---

## When to Read What

| I need to know...              | Read this                                    |
|--------------------------------|----------------------------------------------|
| What feature to build next     | Beads - `bd ready`, `bd list`                |
| Why we're building it (product)| root `README.md` + `docs/superpowers/specs/` |
| How the system fits together   | `specs/TRESTLE-ARCHITECTURE.md`              |
| What tables/columns exist      | `supabase/migrations/` (012+ = Trestle line) |
| How we get customers (GTM)     | `docs/marketing/GTM-OUTREACH-PLAYBOOK.md`    |
| What happened last session     | `.space-agents/comms/capcom.md` (grep only)  |
| Current issues/ideas           | Beads - `bd list`, `bd ready`                |

---

## Folder Structure

```
docs/
├── CLAUDE.md              # This file - planning workflow
├── specs/                 # System specifications
│   └── TRESTLE-ARCHITECTURE.md   # Current system design (source of truth)
├── superpowers/           # Ship/defer specs + implementation plans
│   ├── specs/             # e.g. autoresearch-loop, GTM tier 1/2
│   └── plans/             # task-by-task implementation plans
├── marketing/             # GTM playbook, design, landing assets
├── archive/               # Legacy docs (read-only reference)
│   ├── plans/             # Old kanban-style plans
│   ├── sessions/          # Old session notes (DEV-NOTES.md)
│   ├── specs/             # Pre-Trestle Stackdocs PRD/ARCHITECTURE/SCHEMA
│   └── marketing/         # Stacks-era marketing strategy
└── (schema lives in supabase/migrations/, not docs/)

.space-agents/
├── comms/
│   └── capcom.md          # Session history
└── ...                    # Other Space-Agents config

.beads/
└── issues.jsonl           # Issue tracking
                           # Use: bd list, bd show, bd ready, etc.
```
