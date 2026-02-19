---
description: Resume Stackdocs development from where you left off
arguments:
  - name: handover
    description: Optional handover prompt from previous session (paste the full handover text)
    required: false
---

You are resuming the **Stackdocs** project. Get oriented and wait for direction.

**TOKEN BUDGET**: Target <1,000 tokens for initial context loading. Use grep/offset/limit to read selectively.

## Handover Prompt (if provided)

$ARGUMENTS

---

## Step 1: Read Context

**CRITICAL**: Use offset/limit parameters to avoid loading entire files.

Read in order:

1. **Read IN-PROGRESS.md** (current work):

   ```
   Read docs/plans/roadmap/IN-PROGRESS.md
   ```

2. **Latest session only** from DEV-NOTES:

   ```bash
   # Get last session line number (use Bash, not Grep tool)
   grep -n "^## Session" docs/sessions/DEV-NOTES.md | tail -1 | cut -d: -f1
   ```

   Then read with offset: `Read docs/sessions/DEV-NOTES.md offset=[number from above]`

3. **If handover prompt provided above**: Use it as additional context alongside DEV-NOTES.

4. **Skip reading these at startup** (grep on-demand instead):
   - `docs/specs/PRD.md` - Only grep specific requirements when needed
   - `docs/specs/ARCHITECTURE.md` - Grep for specific sections during implementation
   - `docs/specs/SCHEMA.md` - Grep for table definitions when needed

## Step 2: Check Git Status

```bash
git branch --show-current
git status --short
```

## Step 3: Identify Current Work

From IN-PROGRESS.md and latest DEV-NOTES session:

- What feature is **In Progress**?
- What was the **last completed task**?
- What is the **next step**?

Check `docs/plans/in-progress/` for active feature plans:

```bash
ls docs/plans/in-progress/
```

## Step 4: Present Summary

```
📍 Stackdocs Status

**Branch:** [name]
**Current Feature:** [feature name from IN-PROGRESS.md]

**Progress:**
✅ Last: [What was completed in last session]
📂 Plan: docs/plans/in-progress/[feature]/

**Next Steps** (from DEV-NOTES):
[List next steps from last session's "Next Session" section]

**Git:** [clean or uncommitted changes]

**Awaiting your direction:**
- `/superpowers:brainstorm` - Design a new feature
- `/superpowers:write-plan` - Create implementation plan from design
- `/superpowers:execute-plan` - Execute existing plan
```

## Step 5: Wait for User Direction

**IMPORTANT**: Do NOT start any work until user triggers a superpowers command or gives explicit instruction.

Present the summary and wait. The user will choose:

- `/superpowers:brainstorm` for new feature design
- `/superpowers:write-plan` to create implementation plan
- `/superpowers:execute-plan` to continue implementation
- Or give direct instructions

## Project Reminders

**Architecture:**

- Frontend → Supabase directly (reads, writes, realtime)
- Frontend → FastAPI (AI agent triggers only)
- FastAPI → Claude Agent SDK → Supabase (extractions)

**Key Locations:**

- Plans: `docs/plans/in-progress/[feature]/`
