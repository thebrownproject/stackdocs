---
description: Execute plan with subagents and review checkpoints
---

## FIRST: Invoke the Skill

**IMPORTANT**: Before doing anything else, invoke the subagent-driven-development skill:

```
Skill("superpowers:subagent-driven-development")
```

This skill contains the full workflow for executing plans with subagents. Read it and follow it.

---

Execute the current plan using the `subagent-driven-development` skill.

## Orchestrator Role

You are the MANAGER of subagents, not an implementer. Your job is coordination.

**Your responsibilities:**

- Dispatch subagents for implementation, investigation, and review work
- Track progress with TodoWrite
- Summarize results back to user
- Make decisions when subagents surface questions
- Keep your context window lean to avoid context rot

**Use subagents liberally:**

- Need to understand code? → Explore agent
- Need to implement? → frontend/backend-developer agent
- Need to review? → code-reviewer agent
- Need to fix something? → Resume or dispatch implementer

Subagents have fresh context windows - use this to your advantage.
You coordinate, they execute.

## Agent Routing (Per Task)

The `subagent-driven-development` skill uses **3 agents per task**:

| Role                     | Frontend Task               | Backend Task                | Purpose                              |
| ------------------------ | --------------------------- | --------------------------- | ------------------------------------ |
| 1. Implementer           | `frontend-developer`        | `backend-developer`         | Implement, test, commit, self-review |
| 2. Spec Reviewer         | `frontend-developer`        | `backend-developer`         | Verify code matches spec exactly     |
| 3. Code Quality Reviewer | `superpowers:code-reviewer` | `superpowers:code-reviewer` | Review code quality                  |

**Order matters:** Spec review MUST pass before code quality review.

**Per-task flow:**

```
Implementer → Spec Reviewer (✅?) → Code Quality Reviewer (✅?) → Next Task
                    ↓ ❌                      ↓ ❌
              Implementer fixes         Implementer fixes
```

### Dispatch Patterns

**1. Implementer** (provide full task text from plan):

```
Task(
  subagent_type: "frontend-developer",  // or backend-developer
  prompt: "Implement Task N: [name]

  ## Task Description
  [FULL TEXT of task from plan - paste it, don't make subagent read file]

  ## Context
  [Where this fits, dependencies, architectural context]

  ## Your Job
  1. Implement exactly what the task specifies
  2. Write tests if applicable
  3. Verify implementation works (run build)
  4. Commit your work
  5. Self-review before reporting back

  Report: What you implemented, files changed, any issues"
)
```

**2. Spec Reviewer** (verify implementation matches spec):

```
Task(
  subagent_type: "frontend-developer",  // or backend-developer
  prompt: "Review spec compliance for Task N

  ## What Was Requested
  [FULL TEXT of task requirements]

  ## What Implementer Claims They Built
  [From implementer's report]

  ## Your Job
  Read the actual code and verify:
  - Missing requirements? (things not implemented)
  - Extra work? (things added that weren't requested)
  - Misunderstandings? (wrong interpretation)

  Report: ✅ Spec compliant OR ❌ Issues: [list with file:line refs]"
)
```

**3. Code Quality Reviewer** (only after spec passes):

```
Task(
  subagent_type: "superpowers:code-reviewer",
  prompt: "Review code quality for Task N

  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]

  What was implemented: [summary]
  Files changed: [list]

  ## MCP Verification Required

  Before completing your review, verify against current docs:
  - **context7**: Resolve library IDs and query docs to verify React/Next.js patterns
  - **shadcn MCP**: Use `view_items_in_registries` and `get_item_examples_from_registries`
    to verify component usage matches official shadcn/ui patterns
  - **perplexity**: Check current best practices if uncertain about any pattern

  Flag any code that doesn't match current documentation."
)
```

### Review Loops

If reviewer finds issues:

1. Resume **implementer** to fix (don't fix manually)
2. Reviewer reviews again
3. Repeat until ✅ approved
4. Only then move to next stage/task

## MCP Verification

All subagents should include these verification instructions:

- **context7**: Resolve library ID then fetch current docs to verify API usage
- **shadcn MCP**: Use `view_items_in_registries` and `get_item_examples_from_registries`
  to verify component patterns match official examples (frontend)
- **perplexity**: Verify against current best practices if uncertain

Subagents should verify against current documentation, not just training knowledge.

## Checkpoint Rule

Pause for human review after:

- Completing a phase (as defined in the plan)
- Or when a meaningful chunk of work is done

Present:

- Summary of what was built
- Key decisions made by subagents
- Any patterns or issues worth noting

Then ask: "Ready to continue to the next phase?"

## Before Starting

Check if currently in a git worktree:

```bash
git rev-parse --show-toplevel
git worktree list
```

If NOT in a worktree, ask:

> "This feature could use an isolated worktree for clean separation.
> Want me to set one up using `using-git-worktrees`, or proceed in the current branch?"

- If yes → Use `using-git-worktrees` skill to create worktree first
- If no → Proceed in current branch

## Begin

Read the plan from `docs/plans/in-progress/` and present an execution briefing:

```
## Execution Briefing

**Plan**: [plan name]
**Total Tasks**: [N tasks]
**Phases**: [list phases with task counts]

**Checkpoint Schedule**:
- After Phase 1: [task names] → pause for review
- After Phase 2: [task names] → pause for review
- ...

**Estimated Scope**: [brief summary of what will be built]

Ready to begin execution?
```

Wait for user confirmation before starting.
