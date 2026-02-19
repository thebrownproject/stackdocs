# Upload Dialog Design

**Date:** 2025-12-24
**Status:** Design Complete
**Feature:** Document upload with extraction configuration

---

## Overview

Replace the current simple file picker with a multi-step upload dialog that:
1. Uploads documents immediately (OCR runs in background)
2. Lets users configure extraction while OCR processes
3. Triggers AI extraction and shows progress
4. Navigates to document detail page on completion

**Goal:** Minimize perceived wait time by parallelizing upload/OCR with user decision-making.

---

## User Flow

```
Click Upload → Step 1: Dropzone → Step 2: Configure → Step 3: Fields (if custom)
                    ↓                    ↓                      ↓
              Upload starts        OCR runs in           User adds fields
              immediately          background             with descriptions
                                       ↓
                              Status: "Ready" when OCR complete
                                       ↓
                              Click "Extract" → SSE stream starts
                                       ↓
                              Progress shown in dialog
                                       ↓
                              Complete → Navigate to /documents/[id]
```

---

## Dialog Steps

### Step 1: Upload File (Dropzone)

- Drag-and-drop zone or click to browse
- Accepts: PDF, JPG, PNG up to 10MB
- **Upload starts immediately when file selected**
- Auto-advances to Step 2 once file is chosen
- File picker resets if user goes back

### Step 2: Configure Extraction

- **Stack selection** (placeholder for MVP)
  - Shows existing stacks as selectable chips
  - Disabled/coming soon state - not functional yet

- **Extraction method**
  - Two selectable cards side by side
  - "Auto Extract" - AI analyzes and extracts all fields automatically
  - "Custom Fields" - User specifies exactly which fields to extract
  - Selected state: subtle background change (no blue border)

- **Progress indicator** (bottom-right, next to button)
  - Shows upload/OCR status with checkmarks (matches Linear styling)
  - "Uploading document..." → "Processing OCR..." → "✓ Ready"
  - Button disabled until status is "Ready"

- **Navigation**
  - If Auto Extract selected: "Extract" button (final step)
  - If Custom Fields selected: "Next" button → Step 3

### Step 3: Specify Fields (Custom only)

- **Field input**
  - Field name input (spaces allowed, no underscore requirement)
  - Description input (optional) - helps AI understand what to extract
  - "Add Field" button adds field to list below

- **Field badges**
  - Display below input as removable tags
  - Show field name with ✕ to remove
  - Tooltip on hover shows description (if provided)
  - Minimum 1 field required to proceed

- **Progress indicator** (same as Step 2)
  - "Extract" button disabled until OCR ready AND at least 1 field added

---

## Component Architecture

```
components/documents/upload-dialog/
├── upload-dialog.tsx              # Main Dialog wrapper + step state machine
├── upload-dialog-trigger.tsx      # Button that opens dialog (replaces upload-button.tsx)
├── steps/
│   ├── dropzone-step.tsx          # Step 1: File selection with drag-drop
│   ├── configure-step.tsx         # Step 2: Stack + extraction method
│   └── fields-step.tsx            # Step 3: Custom fields input
├── field-tag-input.tsx            # Tag input component with badges
├── extraction-method-card.tsx     # Selectable card for auto/custom
└── upload-status.tsx              # Bottom-right status + Extract button
```

### shadcn Components Used

- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- `Button` - navigation, actions, add field
- `Card` - extraction method selection
- `Input` - field name, description
- `Badge` - field tags, stack indicator
- `Tooltip` - field descriptions on hover

---

## State Management

```typescript
type UploadDialogState = {
  // Navigation
  step: 'dropzone' | 'configure' | 'fields'
  isOpen: boolean

  // From Step 1
  file: File | null
  documentId: string | null

  // Upload/OCR progress
  uploadStatus: 'idle' | 'uploading' | 'processing_ocr' | 'ready' | 'error'
  uploadError: string | null

  // From Step 2
  stackId: string | null           // placeholder - not used in MVP
  extractionMethod: 'auto' | 'custom'

  // From Step 3 (if custom)
  customFields: Array<{ name: string; description?: string }>

  // Extraction progress
  extractionStatus: 'idle' | 'extracting' | 'complete' | 'error'
  extractionEvents: AgentEvent[]   // SSE events for progress display
}
```

---

## Data Flow

### 1. File Upload (Step 1 → Step 2)

```
User drops file
  → setFile(file), setUploadStatus('uploading')
  → POST /api/document/upload (FormData)
  → Response: { document_id, status: 'ocr_complete', ocr_result }
  → setDocumentId(id), setUploadStatus('ready')
```

Note: Current `/api/document/upload` runs OCR synchronously and returns when complete.

### 2. Extraction Trigger (Step 2 or 3 → Complete)

```
User clicks "Extract"
  → setExtractionStatus('extracting')
  → POST /api/agent/extract (SSE stream)
     - document_id
     - mode: 'auto' | 'custom'
     - custom_fields: JSON string (if custom)
  → Stream events update extractionEvents[]
  → On 'complete' event: setExtractionStatus('complete')
  → Navigate to /documents/[documentId]
```

---

## API Changes

### Current `/api/agent/extract`

```python
document_id: str = Form(...)
mode: str = Form("auto")  # "auto" | "custom"
custom_fields: str | None = Form(None)  # comma-separated: "vendor, date, total"
```

### Updated Format

```python
custom_fields: str | None = Form(None)  # JSON: '[{"name": "Vendor", "description": "Company name"}]'
```

### Backend Changes Required

1. **Parse JSON custom_fields** in `agent.py`:
   ```python
   if custom_fields:
       fields_list = json.loads(custom_fields)  # List of {name, description}
   ```

2. **Update agent prompt** to include descriptions:
   ```
   Extract these fields:
   - Vendor: Company that issued the invoice
   - Invoice Date: (no description provided)
   - Line Items: Individual items with quantities and prices
   ```

---

## Frontend Changes

### New Files

| File | Purpose |
|------|---------|
| `upload-dialog.tsx` | Main dialog component with step state |
| `upload-dialog-trigger.tsx` | Replaces `upload-button.tsx` |
| `dropzone-step.tsx` | File drag-drop UI |
| `configure-step.tsx` | Stack + method selection |
| `fields-step.tsx` | Custom fields input |
| `field-tag-input.tsx` | Tag input with badges |
| `extraction-method-card.tsx` | Selectable method cards |
| `upload-status.tsx` | Progress indicator + button |

### Modified Files

| File | Change |
|------|--------|
| `lib/agent-api.ts` | Add `streamAgentExtraction()` function |
| `@header/documents/page.tsx` | Use `UploadDialogTrigger` instead of `UploadButton` |

### Reused Patterns

- SSE parsing from `streamAgentCorrection()` in `agent-api.ts`
- Event types from `useAgentStream` hook
- Progress styling similar to `AiActivityPanel`

---

## Interaction Details

### Step Transitions

| From | To | Trigger |
|------|-----|---------|
| - | Step 1 | Dialog opens |
| Step 1 | Step 2 | File selected (auto-advance) |
| Step 2 | Step 1 | Back button |
| Step 2 | Step 3 | "Next" (if Custom selected) |
| Step 2 | Complete | "Extract" (if Auto selected + Ready) |
| Step 3 | Step 2 | Back button |
| Step 3 | Complete | "Extract" (if Ready + fields added) |

### Upload Status States

| State | Display | Button |
|-------|---------|--------|
| `idle` | (hidden) | - |
| `uploading` | `◐ Uploading document...` | Disabled |
| `processing_ocr` | `◐ Processing OCR...` | Disabled |
| `ready` | `✓ Ready` | Enabled |
| `error` | `✕ Upload failed` | Retry |

### Extraction Progress

Dialog shows SSE events with checkmarks (same styling as detail page panel):
- Reading OCR
- Analyzing document (auto mode)
- Saving extraction
- Complete

User stays in dialog until extraction completes, then "View Document" button navigates to detail page.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User closes dialog mid-upload | Upload continues server-side, no document created yet |
| User closes dialog mid-extraction | Agent completes server-side, data saved, user can find document in list |
| OCR fails | Show error state, retry button, don't allow extraction |
| Extraction fails | Show error in progress panel, allow retry |
| Large file (slow upload) | Progress indicator keeps user informed |
| User goes back after file selected | Reset file, keep method selection |

---

## Future Enhancements

Tracked in `docs/plans/ISSUES.md`:
- **#2**: Field type definitions (text, number, date, array)
- **#10**: Global SSE context to persist streams across navigation
- **#11**: Drag-and-drop anywhere on documents page
- **#12**: Inline stack creation during upload

---

## Design Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Step order | Dropzone first | Start upload ASAP, OCR runs while user configures |
| Stack selection | Placeholder for MVP | Stacks feature not built yet |
| Custom fields format | `{name, description}` objects | Descriptions help AI understand intent |
| Field input | Tag-based with badges | Better UX than comma-separated text |
| Wait for extraction | Stay in dialog | Simpler than cross-page stream management |
| Navigation timing | After extraction complete | User sees full data on arrival |

---

## Visual Reference

Wireframes provided by user show:
1. Step 1: Stack chips + extraction method cards
2. Step 2: Dropzone with stack badge
3. Step 3: Field name input with comma-separated hint

**Adjustments from wireframes:**
- Reordered: Dropzone is now Step 1 (upload first)
- Field input: Tag-based with badges instead of comma-separated text
- Added: Description field for each custom field
- Added: Progress indicator in bottom-right
