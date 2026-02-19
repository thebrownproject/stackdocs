# Agent Bar Redesign - Design Document

**Date:** 2026-01-01
**Status:** Design Complete
**Feature:** Unified Agent Bar

---

## Overview

Redesign the agent bar to consolidate the separate bar and popup components into a single unified card. The input bar transforms into a status bar when flows are active, with content expanding upward from the bottom-anchored position.

### Goals

1. **Unified experience** - Single card instead of separate bar + popup
2. **Clearer mental model** - Input morphs to status, content expands below
3. **Better animations** - Spring physics for iOS/Mac-inspired feel
4. **Improved UX** - Click outside to collapse, content renders behind bar

---

## Current State

```
┌────────────────────────────────┐ ← AgentPopup (separate card)
│  Upload Document      ˅    X   │
│  [dropzone content]            │
└────────────────────────────────┘
         ↕ 12px gap
┌────────────────────────────────┐ ← AgentBar (separate card)
│  [Upload action on focus]      │
│  ≋  How can I help...      ⬆   │
└────────────────────────────────┘
```

**Issues with current design:**
- Two separate visual elements (bar + popup)
- Content area cuts off above bar (doesn't render behind)
- Click outside doesn't collapse
- Popup appears above bar, feels disconnected

---

## New Design

### Structure

Single unified card, bottom-anchored, expands upward:

```
┌──────────────────────────────────────────────────────────┐
│  ⬆  Uploading document...                        ↓   ✕   │ ← Status bar (top)
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ● Current step description                          ˅   │ ← Steps area
│    Step details...                                       │
│                                                          │
│  [Flow content - dropzone, forms, etc.]                  │ ← Content area
│                                                          │
└──────────────────────────────────────────────────────────┘
                         ↑
              Bottom-anchored, expands UP
```

### States

#### 1. Idle (No Flow Active)

```
┌──────────────────────────────────────────────────────────┐
│  ≋  How can I help you today?                        ↓   │
└──────────────────────────────────────────────────────────┘
```

- Stack icon (≋) on left
- Placeholder text in middle
- Chevron button on right (expands to show actions)

#### 2. Idle Expanded (Actions Visible)

```
┌──────────────────────────────────────────────────────────┐
│  ⬆ Upload                                                │ ← Actions row
├──────────────────────────────────────────────────────────┤
│  ≋  How can I help you today?                        ↓   │
└──────────────────────────────────────────────────────────┘
```

- Actions appear above input row
- Spring animation expands upward

#### 3. Flow Active (Expanded)

```
┌──────────────────────────────────────────────────────────┐
│  ⬆  Drop a file to get started                   ↓   ✕   │ ← Status bar (morphed from input)
├──────────────────────────────────────────────────────────┤
│                                                          │
│         ⬆                                                │
│    Drop a file here, or click to browse                  │ ← Flow content
│    PDF, JPG, PNG up to 10MB                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Input bar **morphs into** status bar (same visual element, transforms)
- Icon changes based on flow type (≋ → ⬆ for upload)
- X button appears to cancel flow
- Content expands below status bar

#### 4. Flow Active (Minimized)

```
┌──────────────────────────────────────────────────────────┐
│  ⬆  Continue file upload                          ↓   ✕  │
└──────────────────────────────────────────────────────────┘
```

- Flow icon on left (contextual to flow type)
- Descriptive text ("Continue file upload", "Continue extraction...")
- Chevron to expand
- X to cancel (with confirmation if mid-process)

#### 5. Processing (With Steps)

```
┌──────────────────────────────────────────────────────────┐
│  ⬆  Extracting data...                            ↓   ✕  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ● Extracting structured data                        ˅   │ ← Current step (prominent)
│    Finding invoice number, vendor, amount...             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Expand step chevron to see all steps:**

```
│  ✓ Upload                                            ˄   │
│  ✓ OCR                                                   │
│  ● Extracting structured data                            │ ← Current
│    Finding invoice number, vendor, amount...             │
```

- Single focus: current step is prominent
- Chevron expands to show completed steps
- Checkmarks (✓) for complete, bullet (●) for current
- No timestamps (keep it clean)

---

## Behaviors

### Animation

- **Type:** Spring physics (iOS/Mac-inspired)
- **Feel:** Bouncy with slight overshoot, natural deceleration
- **Library:** Framer Motion with spring config
- **Transitions:** Expand/collapse, morph input→status, step changes

### Click Outside

- Clicking anywhere outside the card collapses it
- If flow is active, collapses to minimized state
- If idle, collapses to just the input bar

### Content Rendering

- App content continues to render behind the agent bar
- Bar floats over content like iOS sheets
- Content should be scrollable behind the bar

### Input Morphing

When a flow starts:
1. Input bar transforms into status bar (same element, animated)
2. Icon changes to flow-specific icon
3. Placeholder text becomes status text
4. X button fades in
5. Content area expands upward with spring animation

### Flow Cancellation

- X button cancels the current flow
- If mid-process (file selected, extracting), show confirmation dialog
- Returns to idle state after cancellation

---

## Component Architecture

### Before (Current)

```
components/agent/
├── agent-bar.tsx           # Separate bar component
├── agent-popup.tsx         # Separate popup component
├── agent-popup-content.tsx # Routes to flow content
└── ...
```

### After (New)

```
components/agent/
├── agent-card.tsx          # Unified card (replaces bar + popup)
├── agent-status-bar.tsx    # Top bar (morphs from input)
├── agent-content.tsx       # Expandable content area
├── agent-steps.tsx         # Step indicators
└── ...
```

### State Changes

The Zustand store (`agent-store.ts`) needs updates:

- Remove `isPopupOpen` (no separate popup)
- Add `isExpanded` for card expansion state
- Keep `flow`, `status`, `statusText`, `events`

---

## Status Bar Content by Flow

| Flow | Icon | Status Text (Idle) | Status Text (Processing) |
|------|------|-------------------|-------------------------|
| Upload | ⬆ | Drop a file to get started | Uploading [filename]... |
| Create Stack | ≋ | Create a new stack | Creating stack... |
| Add Documents | ⬆ | Add documents to stack | Adding documents... |
| Create Table | ⊞ | Define extraction columns | Creating table... |
| Extract Table | ⚡ | Extract data from documents | Extracting... |

---

## Steps by Flow

### Upload Flow

1. **Upload** - Uploading file to storage
2. **OCR** - Extracting text from document
3. **Extract** - AI extracting structured data

### Stack Extraction Flow (Future)

1. **Analyze** - Reading documents in stack
2. **Extract** - Extracting data per document
3. **Compile** - Building results table

---

## Visual Styling

Keep current agent-bar styling for MVP:
- Background: `bg-sidebar`
- Border: `border rounded-xl`
- Shadow: `shadow-md`
- Hover: `hover:border-muted-foreground/30`

Future exploration:
- Backdrop blur
- Enhanced shadows
- Dark mode refinements

---

## Bugs to Fix

1. **Click outside doesn't collapse** - Need to add click-outside handler
2. **Content cut off above bar** - Change layout so content renders behind

---

## Post-MVP Features

Track in `docs/plans/issues/ACTIVE.md`:

1. **AI Prompt Flow**
   - User types natural language prompt
   - Bar morphs to show brief title (AI-generated summary)
   - Agent works on request, streams response
   - Same UI pattern as wizard flows

2. **Visual Styling Exploration**
   - Backdrop blur effects
   - Enhanced shadow/depth
   - Animation refinements

3. **Max Height / Scroll Behavior**
   - Define max expanded height
   - Scroll behavior for long content

---

## Success Criteria

- [ ] Single unified card replaces bar + popup
- [ ] Input morphs to status bar with spring animation
- [ ] Content expands upward from bottom
- [ ] Click outside collapses card
- [ ] App content renders behind bar
- [ ] Steps display with single focus + expandable history
- [ ] Minimized state shows "Continue [flow]..." with controls

---

## Related Documents

- Agent UI Refactor (complete): `docs/plans/complete/agent-ui-refactor/`
- Current implementation: `frontend/components/agent/`
- Agent store: `frontend/components/agent/stores/agent-store.ts`
