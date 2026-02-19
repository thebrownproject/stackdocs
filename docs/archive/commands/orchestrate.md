---
description: Dispatch parallel agents for independent tasks
---

Orchestrate parallel agent execution.

## FIRST: Invoke the Skill

**IMPORTANT**: Before doing anything else, invoke the dispatching skill:

```
Skill("superpowers:dispatching-parallel-agents")
```

Then follow the skill's workflow with the input below.

## Orchestrator Role

You are the MANAGER of subagents, not an implementer. Your job is coordination.

**Your responsibilities:**

- Dispatch subagents for independent, parallelizable work
- Track progress with TodoWrite
- Monitor running agents with TaskOutput
- Summarize results back to user
- Handle failures (retry, skip, or abort)
- Keep your context window lean to avoid context rot

**Use subagents liberally:**

- Need to understand scope? → Explore agent
- Need to implement? → frontend/backend-developer agent
- Need to run checks? → general-purpose agent
- Multiple independent tasks? → Dispatch in parallel

Subagents have fresh context windows - use this to your advantage.
You coordinate, they execute.

## Input

$ARGUMENTS

## Fallback Process (if skill unavailable)

### 1. Understand the Task

If `$ARGUMENTS` is provided, use it as context for what to orchestrate.

If `$ARGUMENTS` is empty, ask:
> "What do you want to parallelize? Examples:
> - 'Read docs/plans/in-progress/documents-subbar and parallelize the tasks'
> - 'Fix all issues in docs/plans/issues/ACTIVE.md'
> - 'Run type-check, lint, and tests in parallel'"

### 2. Identify Tasks

Based on the input:
- If pointing to a plan file → Read it and list the tasks
- If pointing to issues → Read and list them
- If describing work → Break it down into discrete tasks

Present the tasks:
```
## Tasks Identified

1. [Task 1]
2. [Task 2]
3. [Task 3]
...
```

**Edge cases:**
- **0 tasks identified**: Ask for clarification or different input
- **1 task identified**: Ask "Only 1 task found. Execute directly, or proceed with orchestration anyway?"

### 3. Determine Independence

Ask:
> "Which of these tasks are **independent** (can run in parallel without conflicts)?
>
> Consider:
> - Do they edit the same files? → NOT independent
> - Does one depend on output from another? → NOT independent
> - Can they be understood without context from each other? → Independent"

Present groupings:
```
## Parallel Groups

**Group A** (can run together):
- Task 1
- Task 3

**Group B** (must wait for Group A):
- Task 2

**Sequential** (must run alone):
- Task 4
```

**Edge case - All sequential**: If no tasks can be parallelized, ask:
> "All tasks have dependencies requiring sequential execution. Use `/execute` instead, or proceed with single-task batches?"

### 4. Check Available Subagents

Check if `.claude/agents/` exists and list available subagents:

```bash
ls .claude/agents/ 2>/dev/null || echo "No custom subagents defined"
```

If subagents exist, ask:
> "Which subagent should handle each task?
> Available: [list agents]
> Or use 'general-purpose' for any task"

If no subagents, use `general-purpose` for all.

### 5. Confirm Dispatch Plan

Present the execution plan:
```
## Dispatch Plan

**Parallel Batch 1:**
| Task | Agent | Scope |
|------|-------|-------|
| Task 1 | general-purpose | [brief scope] |
| Task 3 | component-builder | [brief scope] |

**Parallel Batch 2** (after Batch 1):
| Task | Agent | Scope |
|------|-------|-------|
| Task 2 | test-runner | [brief scope] |

Ready to dispatch?
```

Wait for confirmation.

### 6. Dispatch

For each parallel batch, use the `Task` tool:

```
Task(
  description: "Brief 3-5 word summary",
  prompt: "Detailed task description with:
    - Specific goal
    - Files to modify
    - Constraints (what NOT to touch)
    - Success criteria",
  subagent_type: "frontend-developer",  // or backend-developer, general-purpose, etc.
  run_in_background: true
)
```

**Dispatch all tasks in a batch simultaneously** (single message with multiple Task calls).

After dispatch:
- Monitor with `TaskOutput(task_id, block: false)` for progress
- Use `TaskOutput(task_id, block: true)` when waiting for results
- Report results as they complete

**If an agent fails:**
> "Agent [X] failed: [error]. Retry, skip, or abort remaining?"

### 7. Integration

When all agents return:
- Summarize what each completed
- Check for conflicting changes
- Run verification (tests, type-check) if applicable
- Present integration report
