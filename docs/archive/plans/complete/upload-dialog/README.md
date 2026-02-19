# Upload Dialog Implementation

> **For Claude:** Read this file FIRST before executing any phase. Then use `superpowers:executing-plans` to implement each phase in order.

## Overview

Replace the simple file picker with a multi-step upload dialog that:
1. Uploads documents immediately (OCR runs in background)
2. Lets users configure extraction while OCR processes
3. Triggers AI extraction and shows streaming progress
4. Navigates to document detail page on completion

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UploadDialogTrigger                       │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │  UploadDialogContent  │ (state machine)      │
│              └───────────────────────┘                      │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│   DropzoneStep    ConfigureStep     FieldsStep             │
│   (Step 1)        (Step 2)          (Step 3)               │
│                                                             │
│   Components: UploadStatus, ExtractionMethodCard,          │
│               FieldTagInput, ExtractionProgress            │
└─────────────────────────────────────────────────────────────┘
```

## Phases

Execute phases in order. Each phase builds on the previous.

| Phase | Tasks | Description | Files |
|-------|-------|-------------|-------|
| **1** | 1-3 | Foundation: Types, SSE function, config | `phase-1-foundation.md` |
| **2** | 4-10 | UI Components: All presentational components | `phase-2-components.md` |
| **3** | 11-17 | Integration: Dialog assembly, backend, testing | `phase-3-integration.md` |

## Task Summary

### Phase 1: Foundation (Tasks 1-3)
| Task | File | Purpose |
|------|------|---------|
| 1 | `upload-dialog/types.ts` | Type definitions for dialog state |
| 2 | `lib/agent-api.ts` | Add `streamAgentExtraction()` SSE function |
| 3 | `lib/upload-config.ts` | Upload constraints and error messages |

### Phase 2: Components (Tasks 4-10)
| Task | File | Purpose |
|------|------|---------|
| 4 | `upload-dialog/upload-status.tsx` | Progress indicator (uploading/ready/error) |
| 5 | `upload-dialog/extraction-method-card.tsx` | Selectable card for auto/custom |
| 6 | `upload-dialog/field-tag-input.tsx` | Tag input with badges and tooltips |
| 7 | `upload-dialog/steps/dropzone-step.tsx` | File drag-and-drop |
| 8 | `upload-dialog/steps/configure-step.tsx` | Stack + method selection |
| 9 | `upload-dialog/steps/fields-step.tsx` | Custom fields input |
| 10 | `upload-dialog/extraction-progress.tsx` | SSE event display |

### Phase 3: Integration (Tasks 11-17)
| Task | File | Purpose |
|------|------|---------|
| 11 | `upload-dialog/upload-dialog-trigger.tsx` | Button that opens dialog |
| 12 | `upload-dialog/upload-dialog-content.tsx` | Main dialog with state management |
| 13 | `upload-dialog/index.ts` | Barrel export |
| 14 | `@header/documents/page.tsx` | Integrate trigger in header |
| 15 | `backend/app/routes/agent.py` | JSON custom_fields parsing |
| 16 | - | Manual testing checklist |
| 17 | - | Cleanup old UploadButton |

## Key Patterns

### State Management
- Self-contained in `UploadDialogContent` (no external hook)
- Step machine: `'dropzone' → 'configure' → 'fields'`
- Upload starts immediately on file selection

### SSE Streaming
- Reuse pattern from `streamAgentCorrection()` in `agent-api.ts`
- Handle events: `tool`, `text`, `complete`, `error`
- Escape key cancels extraction

### Styling
- Linear aesthetic: subtle backgrounds, no colored borders
- shadcn/ui components: Dialog, Card, Input, Badge, Tooltip
- Consistent with existing document detail page

## Reference Files

Before implementing, review these existing patterns:
- `frontend/lib/agent-api.ts` - SSE streaming
- `frontend/components/documents/ai-activity-panel.tsx` - Progress display
- `frontend/components/documents/upload-button.tsx` - Current implementation (to replace)

## Design Doc

Full design decisions: `2025-12-24-upload-dialog-design.md`
