---
description: Wrap up development session and save progress
---

You are wrapping up the current development session. Document progress, update plans, and commit work.

## Step 1: Update Feature Plan

1. Check current feature in `docs/plans/in-progress/`:
   ```bash
   ls docs/plans/in-progress/
   ```

2. Update the plan file (`*-plan.md`) for the feature you worked on:
   - Mark completed tasks with `[x]`
   - Note any blockers or decisions made
   - Update "Current State" section if applicable

## Step 2: Update DEV-NOTES.md

Add a session entry at the END of `docs/sessions/DEV-NOTES.md`:

```markdown
---

## Session [N] - YYYY-MM-DD - [Brief Description]

**Feature**: [Feature from plans/in-progress/]
**Branch**: [branch name]

### Tasks Completed

- [x] **[Major task]**:
  - Detail of what was done
  - Files created/modified
  - Key outcomes
- [x] **[Another task]**:
  - Details...

### Key Decisions (if any)

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| [What was decided] | [Choice made] | [Why] |

### Tasks Remaining

- [ ] [What's left to do]
- [ ] [Next priority]

### Next Session

**Task**: [Primary focus for next session]

**Process**:
1. [First step]
2. [Second step]
3. [etc.]
```

Keep notes detailed enough that grepping session titles gives useful context.

## Step 3: Update Roadmap (if plans changed)

Update roadmap files if ANY of these happened this session:
- **New plan created** in `docs/plans/todo/` or `docs/plans/in-progress/`
- **Feature phase completed** (e.g., backend done, frontend started)
- **Priorities changed**

Steps:
1. Update `docs/plans/roadmap/IN-PROGRESS.md` for current work changes
2. Update `docs/plans/roadmap/TODO.md` for new planned features
3. Move completed features to `docs/plans/roadmap/COMPLETE.md`

## Step 4: Git Commit

1. Check git status:
   ```bash
   git status
   ```

2. Stage changes:
   ```bash
   git add -A
   ```

3. Create commit with clear message (use HEREDOC format):
   ```bash
   git commit -m "$(cat <<'EOF'
   [type]: [Brief summary]

   - Specific change 1
   - Specific change 2

   Feature: [feature name]
   EOF
   )"
   ```

   Types: `feat`, `fix`, `refactor`, `docs`, `chore`

4. Show commit hash and confirm success

## Step 5: Session Summary

Provide user with:

```
📦 Session Wrap-Up Complete

**Feature:** [name]
**Branch:** [name]

**Completed This Session:**
- [Task completed]
- [Files modified]

**Git:**
- Commit: [hash]
- Status: [clean]

**Next Session:**
- Continue with: [Next task]
- Run `/continue` to resume

**Key Files Modified:**
- [file paths]
```

## Step 6: Move to Complete (if feature done)

If the entire feature is complete:

1. Move plan folder:
   ```bash
   git mv docs/plans/in-progress/[feature] docs/plans/complete/
   ```

2. Update reference docs (`docs/specs/ARCHITECTURE.md`, `docs/specs/SCHEMA.md`) to reflect new reality

3. Move feature from `docs/plans/roadmap/IN-PROGRESS.md` to `COMPLETE.md`

## Important Notes

- **Only mark tasks complete if verified working**
- **Document decisions** - Future sessions need context
- **Keep plans up to date** - They're the source of truth for feature progress
