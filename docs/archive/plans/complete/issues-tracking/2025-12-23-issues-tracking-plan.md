# Issues Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a lightweight issues tracking file and slash command for logging small items that don't need immediate action.

**Architecture:** Single markdown file (`docs/plans/ISSUES.md`) with checklist format. Slash command (`/issue`) prompts for category confirmation before appending.

**Tech Stack:** Markdown, Claude Code slash commands

---

### Task 1: Create ISSUES.md

**Files:**
- Create: `docs/plans/ISSUES.md`

**Step 1: Create the issues file with initial entries**

```markdown
# Issues & Ideas

Lightweight tracking for items that don't need immediate action.

**Categories:** `bug` | `deprecation` | `tech-debt` | `feature`

**Workflow:** Notice something → add a line → check off when done

---

- [ ] `deprecation` Clerk `afterSignInUrl` → use `fallbackRedirectUrl` or `forceRedirectUrl` instead (2025-12-23)
- [ ] `feature` Field type definitions for documents page extraction (post-MVP) (2025-12-23)
```

**Step 2: Commit**

```bash
git add docs/plans/ISSUES.md
git commit -m "docs: add ISSUES.md for lightweight issue tracking"
```

---

### Task 2: Create /issue slash command

**Files:**
- Create: `.claude/commands/issue.md`

**Step 1: Create the command file**

```markdown
Add an issue to the tracking file.

User's issue: $ARGUMENTS

Follow these steps:

1. Read `docs/plans/ISSUES.md` to see current format
2. Analyze the user's description and suggest the most likely category:
   - `bug` - Something broken
   - `deprecation` - Deprecated APIs/patterns to update
   - `tech-debt` - Code that works but should be improved
   - `feature` - Ideas for future functionality
3. Ask user to confirm: "This looks like a [category]. Add as `[category]`?" (one question only)
4. After confirmation, append to ISSUES.md: `- [ ] \`{category}\` {description} ({today's date})`
5. Confirm: "Added to ISSUES.md"
```

**Step 2: Commit**

```bash
git add .claude/commands/issue.md
git commit -m "feat: add /issue slash command for quick issue logging"
```

---

### Task 3: Update docs/CLAUDE.md

**Files:**
- Modify: `docs/CLAUDE.md`

**Step 1: Read current file**

Read `docs/CLAUDE.md` to find the folder structure and reference docs sections.

**Step 2: Add ISSUES.md to folder structure**

In the folder structure section, add:
```
└── plans/
    ├── ISSUES.md          # Lightweight issue/idea tracking
    ├── todo/              # Features designed, ready to implement
```

**Step 3: Add to reference docs table (if exists)**

If there's a reference docs table, add:
```
| `plans/ISSUES.md` | Lightweight issue/idea tracking |
```

**Step 4: Commit**

```bash
git add docs/CLAUDE.md
git commit -m "docs: add ISSUES.md to docs/CLAUDE.md"
```

---

### Task 4: Update root CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Read current file around line 60**

Read `CLAUDE.md` to find the Reference Docs table.

**Step 2: Add ISSUES.md to the table**

Add row to Reference Docs table:
```
| `docs/plans/ISSUES.md`   | Lightweight issue/idea tracking            |
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add ISSUES.md to root CLAUDE.md reference table"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create ISSUES.md with initial entries | `docs/plans/ISSUES.md` |
| 2 | Create /issue slash command | `.claude/commands/issue.md` |
| 3 | Update docs/CLAUDE.md | `docs/CLAUDE.md` |
| 4 | Update root CLAUDE.md | `CLAUDE.md` |
