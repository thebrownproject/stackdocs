# Stackdocs Planning

## Space-Agents Workflow

### Creating New Features
1. `/exploration` → select brainstorm mode for design exploration
2. `/exploration-plan` → creates implementation tasks in Beads
3. Tasks tracked via `bd list`, `bd show <id>`, etc.

### Completing Features
1. Finish execution via `/mission` (solo, orchestrated, or ralph modes)
2. Close tasks: `bd close <id>`
3. **Update reference docs** (`specs/ARCHITECTURE.md`, `specs/SCHEMA.md`) to reflect new reality

> **Legacy:** Old plan documents archived at `docs/archive/plans/` (read-only reference)

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
| Why we're building it          | `specs/PRD.md`                               |
| How the system fits together   | `specs/ARCHITECTURE.md`                      |
| What tables/columns exist      | `specs/SCHEMA.md`                            |
| What happened last session     | `.space-agents/comms/capcom.md` (grep only)  |
| Current issues/ideas           | Beads - `bd list`, `bd ready`                |

---

## Folder Structure

```
docs/
├── CLAUDE.md              # This file - planning workflow
├── specs/                 # System specifications
│   ├── ARCHITECTURE.md    # System design
│   ├── SCHEMA.md          # Database schema
│   └── PRD.md             # Product requirements
├── archive/               # Legacy docs (read-only reference)
│   ├── plans/             # Old kanban-style plans
│   └── sessions/          # Old session notes (DEV-NOTES.md)
└── marketing/             # Marketing assets

.space-agents/
├── comms/
│   └── capcom.md          # Session history
└── ...                    # Other Space-Agents config

.beads/
└── issues.jsonl           # Issue tracking
                           # Use: bd list, bd show, bd ready, etc.
```
