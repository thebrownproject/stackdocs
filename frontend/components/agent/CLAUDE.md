# Agent System

**Purpose:** Registry-based flow system for AI interactions, rendered as a floating card at the bottom of the screen.

## Architecture

```
AgentContainer (positioning)
  └── AgentCard (flow routing + state)
        ├── AgentStatusBar (icon, text, back/close buttons)
        └── AgentContent (expandable content area)
              ├── AgentActions (idle state - action buttons)
              └── FlowStepComponent (active flow - from registry)
```

## Files

| File | Description |
|------|-------------|
| `agent-container.tsx` | Positions card at screen bottom, route-based visibility |
| `agent-actions.tsx` | Action buttons by route (Upload, Create Stack, etc.) |
| `upload-button.tsx` | Standalone upload trigger |
| `index.ts` | Barrel export for all public APIs |

### `/card/` - Card Components

| File | Description |
|------|-------------|
| `agent-card.tsx` | Main card component, routes to idle/active content |
| `agent-status-bar.tsx` | Status icon, text, back/expand/close buttons |
| `agent-content.tsx` | Animated expand/collapse content wrapper |
| `agent-steps.tsx` | Step indicator dots |
| `flow-error-boundary.tsx` | Error boundary for flow components |
| `use-click-outside.ts` | Hook to collapse on outside click |

### `/stores/` - State Management

| File | Description |
|------|-------------|
| `agent-store.ts` | Zustand store: flow state, status, events, actions |

### `/flows/` - Flow Implementations

| File | Description |
|------|-------------|
| `types.tsx` | FlowMetadata, FlowHookResult, FlowRegistration interfaces |
| `registry.ts` | Maps flow types to metadata + hooks |

**Flow folders follow pattern:** `flows/{category}/{name}/`
- `metadata.tsx` - Static config (steps, icons, components)
- `use-{name}-flow.ts` - Logic hook returning FlowHookResult
- `index.ts` - Barrel export
- `steps/` - Step components (optional)

## Data Flow

```
User Action → openFlow(flowConfig) → Zustand Store
                                          ↓
                          AgentCard reads flow from store
                                          ↓
                          getFlowRegistration(flow.type)
                                          ↓
                          registration.useHook() → stepProps
                                          ↓
                          metadata.components[step] renders with props
```

## Key Patterns

- **Registry Pattern**: Flows register metadata + hook, AgentCard renders generically
- **Metadata/Hook Split**: Static config (icons, components) vs dynamic logic (state, handlers)
- **Zustand Persistence**: Flow state persists across page navigation (File objects excluded)
- **Spring Animations**: iOS-like motion via `springConfig` and `contentSpringConfig`
- **Conditional Hooks**: ActiveFlowContent component exists to avoid conditional hook calls

## 8 Registered Flows

| Category | Flows |
|----------|-------|
| documents | `upload`, `extract-document` |
| stacks | `create-stack`, `edit-stack`, `add-documents` |
| tables | `create-table`, `manage-columns`, `extract-table` |

## Usage

```tsx
// Open a flow
import { useAgentStore, initialUploadData } from '@/components/agent'
const openFlow = useAgentStore((s) => s.openFlow)
openFlow({ type: 'upload', step: 'dropzone', data: initialUploadData })

// Store actions
setStep(step)           // Navigate to step
setStatus(status, text) // Update status bar
updateFlowData(data)    // Update upload flow data
close()                 // Close flow, reset to idle
```

## Adding a New Flow

1. Create folder: `flows/{category}/{name}/`
2. Add `metadata.tsx` with FlowMetadata config
3. Add `use-{name}-flow.ts` returning FlowHookResult
4. Add `index.ts` barrel export
5. Register in `flows/registry.ts`
6. Add flow type to `AgentFlow` union in `stores/agent-store.ts`

Reference: `flows/documents/upload/` for complete implementation
