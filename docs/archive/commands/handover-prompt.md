---
description: Generate handover prompt for next session
---

You are creating a handover prompt so the next Claude Code session can seamlessly continue this work.

**FIRST**: Activate prompt-craft skill:
```
/prompt-craft
```

## Step 1: Gather Session Context

Collect information about the current session:

1. **Git status**:
   ```bash
   git status --short
   git branch --show-current
   git log -1 --oneline
   ```

2. **What was worked on** (from your conversation memory):
   - Tasks completed
   - Decisions made
   - Problems encountered

3. **Current feature** (if applicable):
   ```bash
   ls docs/plans/in-progress/
   ```

4. **Wrap-up status**: Was `/wrap-up` already run?

## Step 2: Generate Handover Prompt

Using the PRECISE framework, create a handover prompt with this structure:

```
# Handover: [Date] - [Feature/Task Name]

## Session Summary
[What was completed this session - be specific]

## Decisions Made
- [Key technical/design decisions with reasoning]

## Current State
- **Branch**: [name]
- **Uncommitted changes**: [yes/no - list files if yes]
- **Feature progress**: [which phase/task]
- **Wrap-up completed**: [yes/no]

## Next Session Focus
[Primary task - be specific and actionable]

## Context Files
- [Key files to read or modify]

## Notes
[Blockers, warnings, or important context for next session]
```

## Step 3: Present Output

Display the handover prompt in a code block so the user can copy it for the next session.

**Important**: The handover should be comprehensive enough that someone with no context can understand:
- What was done
- Why certain decisions were made
- Exactly what to do next
