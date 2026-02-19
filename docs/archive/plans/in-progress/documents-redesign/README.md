# Documents Redesign - Implementation Plan [ARCHIVED]

> **MIGRATED TO BEADS:** All tasks have been migrated to Beads issue tracker as epic `stackdocs-7vb`.
> Use `bd show stackdocs-7vb` to view the epic and its child tasks.
> This folder is kept for historical reference and detailed implementation notes.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Documents section from file+extraction hybrid into pure file management. All structured extraction moves to Stacks.

**Core Change:** Documents = file management only. Stacks = all structured extraction. Clear separation of concerns.

**New Features:**
- AI-generated metadata on upload (display_name, tags, summary)
- Metadata review step before saving document
- Simplified document table (no extraction navigation)

---

## Plan Overview

| Phase | Description | Status |
|-------|-------------|--------|
| [Phase 1](./phase-1-database.md) | Database migration - add metadata columns | ✅ Complete |
| [Phase 2](./phase-2-backend-agent.md) | Document processor agent for metadata generation | Pending |
| [Phase 3](./phase-3-upload-flow.md) | Frontend upload flow with metadata review step | Pending |
| [Phase 4](./phase-4-frontend-cleanup.md) | Remove /documents/[id], update table interactions | Pending |

---

## Architecture Summary

### Database Changes

```sql
-- New columns on documents table
display_name TEXT           -- AI-generated or user-edited name
tags TEXT[] DEFAULT '{}'    -- Array of tags for filtering
summary TEXT                -- One-line document summary
updated_at TIMESTAMP        -- Auto-updated on changes
```

### New Backend Agent

```
backend/app/agents/document_processor_agent/
├── agent.py      # Main agent logic
├── prompts.py    # System prompt for metadata generation
└── tools/        # read_ocr, save_metadata
```

### Upload Flow Changes

```
Current: Dropzone → Configure → Fields → Extracting → Complete
New:     Dropzone → Processing → Review Metadata → Complete
```

### Frontend Removals

- `/documents/[id]` route (entire directory)
- Per-document extraction UI
- Document name as Link (becomes plain span)

---

## Success Criteria

From design doc:

- [ ] No `/documents/[id]` route - clicking documents stays on list
- [ ] Upload shows metadata review - users see AI-generated name/tags/summary
- [ ] Preview panel shows metadata - display name, tags, summary visible
- [ ] All extraction in Stacks - no per-document extraction UI remains
- [ ] Database updated - new columns exist and populated on upload

---

## Related Documents

- Design: `docs/plans/in-progress/documents-redesign/2026-01-13-documents-redesign-design.md`
- Current documents table: `frontend/components/documents/documents-table.tsx`
- Reference agent: `backend/app/agents/extraction_agent/`
- Schema spec: `docs/specs/SCHEMA.md`
