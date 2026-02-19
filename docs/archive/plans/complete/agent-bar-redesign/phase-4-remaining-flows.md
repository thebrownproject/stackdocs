# Phase 4: Remaining Flows

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stub out the remaining 7 flow types with metadata and placeholder hooks so they're ready for future implementation.

**Dependencies:** Phase 1-3 complete (upload flow fully migrated)

---

## Overview

We need to create stub implementations for these flows:

| Flow Type | Category | Steps (Planned) |
|-----------|----------|-----------------|
| `extract-document` | documents | select, extracting, complete |
| `create-stack` | stacks | name, documents, complete |
| `edit-stack` | stacks | name, documents, complete |
| `add-documents` | stacks | select, uploading, complete |
| `create-table` | tables | name, columns, complete |
| `manage-columns` | tables | list, edit, complete |
| `extract-table` | tables | configure, extracting, complete |

Each stub includes:
1. `metadata.ts` - Static flow configuration
2. `use-[flow]-flow.ts` - Placeholder hook
3. `index.ts` - Barrel export
4. Registration in `registry.ts`

---

## Task 1: Create Extract Document Flow Stub

**Files:**
- Create: `frontend/components/agent/flows/documents/extract/metadata.ts`
- Create: `frontend/components/agent/flows/documents/extract/use-extract-flow.ts`
- Create: `frontend/components/agent/flows/documents/extract/index.ts`

**Step 1: Create metadata**

```typescript
// frontend/components/agent/flows/documents/extract/metadata.ts
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type ExtractFlowStep = 'select' | 'extracting' | 'complete'

// FIX #11: Use shared FlowPlaceholder instead of repeating the same component
const Placeholder = () => <FlowPlaceholder flowName="Extract Document" />

export const extractFlowMetadata: FlowMetadata<ExtractFlowStep> = {
  type: 'extract-document',
  steps: ['select', 'extracting', 'complete'] as const,
  icons: {
    select: Icons.Refresh,
    extracting: Icons.Loader2,
    complete: Icons.Check,
  },
  statusText: {
    select: 'Select extraction options',
    extracting: 'Re-extracting document...',
    complete: 'Extraction complete',
  },
  minimizedText: 'Continue extraction...',
  components: {
    select: Placeholder,
    extracting: Placeholder,
    complete: Placeholder,
  },
  backableSteps: [] as const,
  confirmationSteps: ['extracting'] as const,
}
```

**Step 2: Create placeholder hook**

```typescript
// frontend/components/agent/flows/documents/extract/use-extract-flow.ts
'use client'

import { useCallback } from 'react'
import { useAgentFlow, useAgentStore } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { ExtractFlowStep } from './metadata'

export function useExtractFlow(): FlowHookResult<ExtractFlowStep> {
  const flow = useAgentFlow()
  const close = useAgentStore((s) => s.close)

  const step = (flow?.type === 'extract-document' ? 'select' : 'select') as ExtractFlowStep

  const handleBack = useCallback(() => {
    // No back navigation for this flow
  }, [])

  return {
    step,
    canGoBack: false,
    needsConfirmation: step === 'extracting',
    onBack: handleBack,
    stepProps: {
      select: {},
      extracting: {},
      complete: {},
    },
  }
}
```

**Step 3: Create barrel export**

```typescript
// frontend/components/agent/flows/documents/extract/index.ts
export { extractFlowMetadata, type ExtractFlowStep } from './metadata'
export { useExtractFlow } from './use-extract-flow'
```

**Step 4: Commit**

```bash
git add frontend/components/agent/flows/documents/extract/ && git commit -m "feat(agent): add extract-document flow stub"
```

---

## Task 2: Create Stack Flow Stubs

**Files:**
- Create: `frontend/components/agent/flows/stacks/create/metadata.ts`
- Create: `frontend/components/agent/flows/stacks/create/use-create-stack-flow.ts`
- Create: `frontend/components/agent/flows/stacks/create/index.ts`
- Create: `frontend/components/agent/flows/stacks/edit/metadata.ts`
- Create: `frontend/components/agent/flows/stacks/edit/use-edit-stack-flow.ts`
- Create: `frontend/components/agent/flows/stacks/edit/index.ts`
- Create: `frontend/components/agent/flows/stacks/add-documents/metadata.ts`
- Create: `frontend/components/agent/flows/stacks/add-documents/use-add-documents-flow.ts`
- Create: `frontend/components/agent/flows/stacks/add-documents/index.ts`

**Step 1: Create create-stack metadata**

```typescript
// frontend/components/agent/flows/stacks/create/metadata.ts
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type CreateStackFlowStep = 'name' | 'documents' | 'complete'

// FIX #11: Use shared FlowPlaceholder
const Placeholder = () => <FlowPlaceholder flowName="Create Stack" />

export const createStackFlowMetadata: FlowMetadata<CreateStackFlowStep> = {
  type: 'create-stack',
  steps: ['name', 'documents', 'complete'] as const,
  icons: {
    name: Icons.Stack,
    documents: Icons.Plus,
    complete: Icons.Check,
  },
  statusText: {
    name: 'Name your stack',
    documents: 'Add documents to stack',
    complete: 'Stack created',
  },
  minimizedText: 'Continue creating stack...',
  components: {
    name: Placeholder,
    documents: Placeholder,
    complete: Placeholder,
  },
  backableSteps: ['documents'] as const,
  confirmationSteps: ['name', 'documents'] as const,
}
```

**Step 2: Create create-stack hook**

```typescript
// frontend/components/agent/flows/stacks/create/use-create-stack-flow.ts
'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { CreateStackFlowStep } from './metadata'

export function useCreateStackFlow(): FlowHookResult<CreateStackFlowStep> {
  const flow = useAgentFlow()
  const step = 'name' as CreateStackFlowStep

  const handleBack = useCallback(() => {
    // TODO: Implement navigation
  }, [])

  return {
    step,
    canGoBack: step === 'documents',
    needsConfirmation: ['name', 'documents'].includes(step),
    onBack: handleBack,
    stepProps: {
      name: {},
      documents: {},
      complete: {},
    },
  }
}
```

**Step 3: Create create-stack barrel**

```typescript
// frontend/components/agent/flows/stacks/create/index.ts
export { createStackFlowMetadata, type CreateStackFlowStep } from './metadata'
export { useCreateStackFlow } from './use-create-stack-flow'
```

**Step 4: Create edit-stack metadata**

```typescript
// frontend/components/agent/flows/stacks/edit/metadata.ts
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type EditStackFlowStep = 'name' | 'documents' | 'complete'

// FIX #11: Use shared FlowPlaceholder
const Placeholder = () => <FlowPlaceholder flowName="Edit Stack" />

export const editStackFlowMetadata: FlowMetadata<EditStackFlowStep> = {
  type: 'edit-stack',
  steps: ['name', 'documents', 'complete'] as const,
  icons: {
    name: Icons.Edit,
    documents: Icons.Stack,
    complete: Icons.Check,
  },
  statusText: {
    name: 'Edit stack name',
    documents: 'Manage documents',
    complete: 'Stack updated',
  },
  minimizedText: 'Continue editing stack...',
  components: {
    name: Placeholder,
    documents: Placeholder,
    complete: Placeholder,
  },
  backableSteps: ['documents'] as const,
  confirmationSteps: ['name', 'documents'] as const,
}
```

**Step 5: Create edit-stack hook**

```typescript
// frontend/components/agent/flows/stacks/edit/use-edit-stack-flow.ts
'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { EditStackFlowStep } from './metadata'

export function useEditStackFlow(): FlowHookResult<EditStackFlowStep> {
  const flow = useAgentFlow()
  const step = 'name' as EditStackFlowStep

  const handleBack = useCallback(() => {}, [])

  return {
    step,
    canGoBack: step === 'documents',
    needsConfirmation: ['name', 'documents'].includes(step),
    onBack: handleBack,
    stepProps: {
      name: {},
      documents: {},
      complete: {},
    },
  }
}
```

**Step 6: Create edit-stack barrel**

```typescript
// frontend/components/agent/flows/stacks/edit/index.ts
export { editStackFlowMetadata, type EditStackFlowStep } from './metadata'
export { useEditStackFlow } from './use-edit-stack-flow'
```

**Step 7: Create add-documents metadata**

```typescript
// frontend/components/agent/flows/stacks/add-documents/metadata.ts
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type AddDocumentsFlowStep = 'select' | 'uploading' | 'complete'

// FIX #11: Use shared FlowPlaceholder
const Placeholder = () => <FlowPlaceholder flowName="Add Documents" />

export const addDocumentsFlowMetadata: FlowMetadata<AddDocumentsFlowStep> = {
  type: 'add-documents',
  steps: ['select', 'uploading', 'complete'] as const,
  icons: {
    select: Icons.Upload,
    uploading: Icons.Loader2,
    complete: Icons.Check,
  },
  statusText: {
    select: 'Select documents to add',
    uploading: 'Adding documents...',
    complete: 'Documents added',
  },
  minimizedText: 'Continue adding documents...',
  components: {
    select: Placeholder,
    uploading: Placeholder,
    complete: Placeholder,
  },
  backableSteps: [] as const,
  confirmationSteps: ['select', 'uploading'] as const,
}
```

**Step 8: Create add-documents hook**

```typescript
// frontend/components/agent/flows/stacks/add-documents/use-add-documents-flow.ts
'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { AddDocumentsFlowStep } from './metadata'

export function useAddDocumentsFlow(): FlowHookResult<AddDocumentsFlowStep> {
  const flow = useAgentFlow()
  const step = 'select' as AddDocumentsFlowStep

  const handleBack = useCallback(() => {}, [])

  return {
    step,
    canGoBack: false,
    needsConfirmation: ['select', 'uploading'].includes(step),
    onBack: handleBack,
    stepProps: {
      select: {},
      uploading: {},
      complete: {},
    },
  }
}
```

**Step 9: Create add-documents barrel**

```typescript
// frontend/components/agent/flows/stacks/add-documents/index.ts
export { addDocumentsFlowMetadata, type AddDocumentsFlowStep } from './metadata'
export { useAddDocumentsFlow } from './use-add-documents-flow'
```

**Step 10: Commit**

```bash
git add frontend/components/agent/flows/stacks/ && git commit -m "feat(agent): add stack flow stubs (create, edit, add-documents)"
```

---

## Task 3: Create Table Flow Stubs

**Files:**
- Create: `frontend/components/agent/flows/tables/create/metadata.ts`
- Create: `frontend/components/agent/flows/tables/create/use-create-table-flow.ts`
- Create: `frontend/components/agent/flows/tables/create/index.ts`
- Create: `frontend/components/agent/flows/tables/manage-columns/metadata.ts`
- Create: `frontend/components/agent/flows/tables/manage-columns/use-manage-columns-flow.ts`
- Create: `frontend/components/agent/flows/tables/manage-columns/index.ts`
- Create: `frontend/components/agent/flows/tables/extract/metadata.ts`
- Create: `frontend/components/agent/flows/tables/extract/use-extract-table-flow.ts`
- Create: `frontend/components/agent/flows/tables/extract/index.ts`

**Step 1: Create create-table metadata**

```typescript
// frontend/components/agent/flows/tables/create/metadata.ts
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type CreateTableFlowStep = 'name' | 'columns' | 'complete'

// FIX #11: Use shared FlowPlaceholder
const Placeholder = () => <FlowPlaceholder flowName="Create Table" />

export const createTableFlowMetadata: FlowMetadata<CreateTableFlowStep> = {
  type: 'create-table',
  steps: ['name', 'columns', 'complete'] as const,
  icons: {
    name: Icons.Table,
    columns: Icons.List,
    complete: Icons.Check,
  },
  statusText: {
    name: 'Name your table',
    columns: 'Define extraction columns',
    complete: 'Table created',
  },
  minimizedText: 'Continue creating table...',
  components: {
    name: Placeholder,
    columns: Placeholder,
    complete: Placeholder,
  },
  backableSteps: ['columns'] as const,
  confirmationSteps: ['name', 'columns'] as const,
}
```

**Step 2: Create create-table hook**

```typescript
// frontend/components/agent/flows/tables/create/use-create-table-flow.ts
'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { CreateTableFlowStep } from './metadata'

export function useCreateTableFlow(): FlowHookResult<CreateTableFlowStep> {
  const flow = useAgentFlow()
  const step = 'name' as CreateTableFlowStep

  const handleBack = useCallback(() => {}, [])

  return {
    step,
    canGoBack: step === 'columns',
    needsConfirmation: ['name', 'columns'].includes(step),
    onBack: handleBack,
    stepProps: {
      name: {},
      columns: {},
      complete: {},
    },
  }
}
```

**Step 3: Create create-table barrel**

```typescript
// frontend/components/agent/flows/tables/create/index.ts
export { createTableFlowMetadata, type CreateTableFlowStep } from './metadata'
export { useCreateTableFlow } from './use-create-table-flow'
```

**Step 4: Create manage-columns metadata**

```typescript
// frontend/components/agent/flows/tables/manage-columns/metadata.ts
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type ManageColumnsFlowStep = 'list' | 'edit' | 'complete'

// FIX #11: Use shared FlowPlaceholder
const Placeholder = () => <FlowPlaceholder flowName="Manage Columns" />

export const manageColumnsFlowMetadata: FlowMetadata<ManageColumnsFlowStep> = {
  type: 'manage-columns',
  steps: ['list', 'edit', 'complete'] as const,
  icons: {
    list: Icons.List,
    edit: Icons.Edit,
    complete: Icons.Check,
  },
  statusText: {
    list: 'Manage table columns',
    edit: 'Edit column',
    complete: 'Columns updated',
  },
  minimizedText: 'Continue managing columns...',
  components: {
    list: Placeholder,
    edit: Placeholder,
    complete: Placeholder,
  },
  backableSteps: ['edit'] as const,
  confirmationSteps: ['list', 'edit'] as const,
}
```

**Step 5: Create manage-columns hook**

```typescript
// frontend/components/agent/flows/tables/manage-columns/use-manage-columns-flow.ts
'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { ManageColumnsFlowStep } from './metadata'

export function useManageColumnsFlow(): FlowHookResult<ManageColumnsFlowStep> {
  const flow = useAgentFlow()
  const step = 'list' as ManageColumnsFlowStep

  const handleBack = useCallback(() => {}, [])

  return {
    step,
    canGoBack: step === 'edit',
    needsConfirmation: ['list', 'edit'].includes(step),
    onBack: handleBack,
    stepProps: {
      list: {},
      edit: {},
      complete: {},
    },
  }
}
```

**Step 6: Create manage-columns barrel**

```typescript
// frontend/components/agent/flows/tables/manage-columns/index.ts
export { manageColumnsFlowMetadata, type ManageColumnsFlowStep } from './metadata'
export { useManageColumnsFlow } from './use-manage-columns-flow'
```

**Step 7: Create extract-table metadata**

```typescript
// frontend/components/agent/flows/tables/extract/metadata.ts
import * as Icons from '@/components/icons'
import { FlowPlaceholder, type FlowMetadata } from '../../types'

export type ExtractTableFlowStep = 'configure' | 'extracting' | 'complete'

// FIX #11: Use shared FlowPlaceholder
const Placeholder = () => <FlowPlaceholder flowName="Extract Table" />

export const extractTableFlowMetadata: FlowMetadata<ExtractTableFlowStep> = {
  type: 'extract-table',
  steps: ['configure', 'extracting', 'complete'] as const,
  icons: {
    configure: Icons.Settings,
    extracting: Icons.Loader2,
    complete: Icons.Check,
  },
  statusText: {
    configure: 'Configure batch extraction',
    extracting: 'Extracting from documents...',
    complete: 'Extraction complete',
  },
  minimizedText: 'Continue batch extraction...',
  components: {
    configure: Placeholder,
    extracting: Placeholder,
    complete: Placeholder,
  },
  backableSteps: [] as const,
  confirmationSteps: ['configure', 'extracting'] as const,
}
```

**Step 8: Create extract-table hook**

```typescript
// frontend/components/agent/flows/tables/extract/use-extract-table-flow.ts
'use client'

import { useCallback } from 'react'
import { useAgentFlow } from '../../../stores/agent-store'
import type { FlowHookResult } from '../../types'
import type { ExtractTableFlowStep } from './metadata'

export function useExtractTableFlow(): FlowHookResult<ExtractTableFlowStep> {
  const flow = useAgentFlow()
  const step = 'configure' as ExtractTableFlowStep

  const handleBack = useCallback(() => {}, [])

  return {
    step,
    canGoBack: false,
    needsConfirmation: ['configure', 'extracting'].includes(step),
    onBack: handleBack,
    stepProps: {
      configure: {},
      extracting: {},
      complete: {},
    },
  }
}
```

**Step 9: Create extract-table barrel**

```typescript
// frontend/components/agent/flows/tables/extract/index.ts
export { extractTableFlowMetadata, type ExtractTableFlowStep } from './metadata'
export { useExtractTableFlow } from './use-extract-table-flow'
```

**Step 10: Commit**

```bash
git add frontend/components/agent/flows/tables/ && git commit -m "feat(agent): add table flow stubs (create, manage-columns, extract)"
```

---

## Task 4: Register All Flows

**Files:**
- Modify: `frontend/components/agent/flows/registry.ts`

**Step 1: Update registry with all flows**

```typescript
// frontend/components/agent/flows/registry.ts
import type { FlowRegistration } from './types'
import type { AgentFlow, UploadFlowStep } from '../stores/agent-store'

// Document flows
import { uploadFlowMetadata, useUploadFlow } from './documents/upload'
import { extractFlowMetadata, useExtractFlow, type ExtractFlowStep } from './documents/extract'

// Stack flows
import { createStackFlowMetadata, useCreateStackFlow, type CreateStackFlowStep } from './stacks/create'
import { editStackFlowMetadata, useEditStackFlow, type EditStackFlowStep } from './stacks/edit'
import { addDocumentsFlowMetadata, useAddDocumentsFlow, type AddDocumentsFlowStep } from './stacks/add-documents'

// Table flows
import { createTableFlowMetadata, useCreateTableFlow, type CreateTableFlowStep } from './tables/create'
import { manageColumnsFlowMetadata, useManageColumnsFlow, type ManageColumnsFlowStep } from './tables/manage-columns'
import { extractTableFlowMetadata, useExtractTableFlow, type ExtractTableFlowStep } from './tables/extract'

/**
 * Registry of all flow types.
 * Maps flow type string to its metadata and hook.
 */
export const flowRegistry: Partial<Record<NonNullable<AgentFlow>['type'], FlowRegistration>> = {
  // Document flows
  upload: {
    metadata: uploadFlowMetadata,
    useHook: useUploadFlow,
  } as FlowRegistration<UploadFlowStep>,

  'extract-document': {
    metadata: extractFlowMetadata,
    useHook: useExtractFlow,
  } as FlowRegistration<ExtractFlowStep>,

  // Stack flows
  'create-stack': {
    metadata: createStackFlowMetadata,
    useHook: useCreateStackFlow,
  } as FlowRegistration<CreateStackFlowStep>,

  'edit-stack': {
    metadata: editStackFlowMetadata,
    useHook: useEditStackFlow,
  } as FlowRegistration<EditStackFlowStep>,

  'add-documents': {
    metadata: addDocumentsFlowMetadata,
    useHook: useAddDocumentsFlow,
  } as FlowRegistration<AddDocumentsFlowStep>,

  // Table flows
  'create-table': {
    metadata: createTableFlowMetadata,
    useHook: useCreateTableFlow,
  } as FlowRegistration<CreateTableFlowStep>,

  'manage-columns': {
    metadata: manageColumnsFlowMetadata,
    useHook: useManageColumnsFlow,
  } as FlowRegistration<ManageColumnsFlowStep>,

  'extract-table': {
    metadata: extractTableFlowMetadata,
    useHook: useExtractTableFlow,
  } as FlowRegistration<ExtractTableFlowStep>,
}

/**
 * Get a flow registration by type.
 */
export function getFlowRegistration(flowType: string): FlowRegistration | undefined {
  return flowRegistry[flowType as keyof typeof flowRegistry]
}

/**
 * Check if a flow type is registered.
 */
export function isFlowRegistered(flowType: string): boolean {
  return flowType in flowRegistry
}

/**
 * Get all registered flow types.
 */
export function getRegisteredFlowTypes(): string[] {
  return Object.keys(flowRegistry)
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add frontend/components/agent/flows/registry.ts && git commit -m "feat(agent): register all 8 flow types in registry"
```

---

## Task 5: Update Agent Actions for New Flows

**Files:**
- Modify: `frontend/components/agent/agent-actions.tsx`

**Step 1: Update ACTION_CONFIG with all flow types**

```typescript
// frontend/components/agent/agent-actions.tsx
'use client'

import { usePathname } from 'next/navigation'
import * as Icons from '@/components/icons'
import { ActionButton } from '@/components/layout/action-button'
import { useAgentStore, initialUploadData, type AgentFlow } from './stores/agent-store'

interface ActionDef {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  flow: NonNullable<AgentFlow>
  tooltip?: string
}

// Actions by route pattern
const ACTION_CONFIG: Record<string, ActionDef[]> = {
  '/documents': [
    {
      id: 'upload',
      label: 'Upload',
      icon: Icons.Upload,
      flow: { type: 'upload', step: 'dropzone', data: initialUploadData },
      tooltip: 'Upload a new document',
    },
    {
      id: 'create-stack',
      label: 'Create Stack',
      icon: Icons.Stack,
      flow: { type: 'create-stack', step: 'name' },
      tooltip: 'Create a new document stack',
    },
  ],
  '/documents/[id]': [
    {
      id: 're-extract',
      label: 'Re-extract',
      icon: Icons.Refresh,
      flow: { type: 'extract-document', documentId: '', step: 'select' }, // documentId filled at runtime
      tooltip: 'Re-extract data from this document',
    },
  ],
  '/stacks': [
    {
      id: 'upload',
      label: 'Upload',
      icon: Icons.Upload,
      flow: { type: 'upload', step: 'dropzone', data: initialUploadData },
      tooltip: 'Upload a new document',
    },
    {
      id: 'create-stack',
      label: 'Create Stack',
      icon: Icons.Stack,
      flow: { type: 'create-stack', step: 'name' },
      tooltip: 'Create a new stack',
    },
  ],
  '/stacks/[id]': [
    {
      id: 'add-documents',
      label: 'Add Documents',
      icon: Icons.Plus,
      flow: { type: 'add-documents', stackId: '', step: 'select' }, // stackId filled at runtime
      tooltip: 'Add documents to this stack',
    },
    {
      id: 'create-table',
      label: 'Create Table',
      icon: Icons.Table,
      flow: { type: 'create-table', stackId: '', step: 'name' }, // stackId filled at runtime
      tooltip: 'Create an extraction table',
    },
  ],
}

export function AgentActions() {
  const pathname = usePathname()
  const openFlow = useAgentStore((s) => s.openFlow)

  const actions = getActionsForRoute(pathname)

  if (actions.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => (
        <ActionButton
          key={action.id}
          icon={<action.icon />}
          tooltip={action.tooltip}
          onClick={() => openFlow(action.flow)}
        >
          {action.label}
        </ActionButton>
      ))}
    </div>
  )
}

/**
 * Get actions for the current route.
 *
 * FIX #9: TODO - Dynamic route flows have empty IDs (documentId, stackId).
 * When implementing these flows, need to:
 * 1. Extract ID from pathname (e.g., /documents/abc123 -> abc123)
 * 2. Clone the flow object and fill in the ID
 *
 * Example fix:
 * ```
 * const documentMatch = pathname.match(/^\/documents\/([^/]+)$/)
 * if (documentMatch) {
 *   const documentId = documentMatch[1]
 *   return ACTION_CONFIG['/documents/[id]'].map(action => ({
 *     ...action,
 *     flow: { ...action.flow, documentId }
 *   }))
 * }
 * ```
 */
function getActionsForRoute(pathname: string): ActionDef[] {
  // Try exact match first
  if (ACTION_CONFIG[pathname]) {
    return ACTION_CONFIG[pathname]
  }

  // Try prefix match for dynamic routes
  // TODO FIX #9: Extract documentId/stackId from pathname and inject into flow
  if (pathname.startsWith('/documents/') && pathname !== '/documents') {
    return ACTION_CONFIG['/documents/[id]'] || []
  }

  if (pathname.startsWith('/stacks/') && pathname !== '/stacks') {
    return ACTION_CONFIG['/stacks/[id]'] || []
  }

  // Fallback to documents actions
  return ACTION_CONFIG['/documents'] || []
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add frontend/components/agent/agent-actions.tsx && git commit -m "feat(agent): update actions for all flow types"
```

---

## Task 6: Cleanup Legacy Files

> **IMPORTANT:** This task removes obsolete files and updates all imports.
> Must be done AFTER Phase 3 (upload flow migration) is complete.

### Files to Delete

| File | Reason | Replacement |
|------|--------|-------------|
| `frontend/components/agent/agent-bar.tsx` | Replaced by unified card | `AgentCard` |
| `frontend/components/agent/agent-popup.tsx` | Replaced by unified card | `AgentCard` |
| `frontend/components/agent/agent-popup-content.tsx` | Replaced by registry | Flow registry |
| `frontend/components/agent/flows/documents/upload-flow.tsx` | Migrated in Phase 3 | `flows/documents/upload/` |

### Files to Update

| File | Current Import | Update To |
|------|----------------|-----------|
| `frontend/app/(app)/layout.tsx` | `AgentContainer` | Keep - container updated internally |
| `frontend/components/agent/agent-container.tsx` | `AgentBar`, `AgentPopupContent` | `AgentCard` |
| `frontend/components/agent/index.ts` | All legacy exports | Remove legacy, add new |

---

**Step 1: Update AgentContainer to use AgentCard**

The container currently imports `AgentBar` and `AgentPopupContent`. Replace entirely:

```typescript
// frontend/components/agent/agent-container.tsx
'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AgentCard } from './card'

// Routes where the agent bar should be visible
const AGENT_ROUTES = ['/documents', '/stacks']

interface AgentContainerProps {
  className?: string
}

export function AgentContainer({ className }: AgentContainerProps) {
  const pathname = usePathname()

  // Self-managed visibility - only show on supported routes
  const shouldShow = AGENT_ROUTES.some(route => pathname.startsWith(route))
  if (!shouldShow) return null

  return (
    <div className={cn(
      'relative w-full sm:max-w-xl mx-auto',
      'pb-[env(safe-area-inset-bottom)]',
      className
    )}>
      <AgentCard />
    </div>
  )
}
```

**Step 2: Verify layout.tsx import still works**

The layout imports `AgentContainer` from the barrel - this should still work:

```bash
grep -n "AgentContainer" /Users/fraserbrown/stackdocs/frontend/app/\(app\)/layout.tsx
```

Expected: `import { AgentContainer } from "@/components/agent"`

No changes needed to layout.tsx - it imports from barrel, not directly.

**Step 3: Update barrel export (index.ts)**

Replace the entire file:

```typescript
// frontend/components/agent/index.ts

// Card components (NEW)
export { AgentCard, AgentStatusBar, AgentContent, AgentSteps } from './card'

// Container (UPDATED - now uses AgentCard internally)
export { AgentContainer } from './agent-container'

// Actions
export { AgentActions } from './agent-actions'
export { UploadButton } from './upload-button'

// Flows (NEW)
export { flowRegistry, getFlowRegistration, isFlowRegistered } from './flows/registry'
export type { FlowMetadata, FlowHookResult, FlowRegistration } from './flows/types'
export { springConfig, contentSpringConfig } from './flows/types'

// Store
export {
  useAgentStore,
  useAgentFlow,
  useAgentStatus,
  useAgentExpanded,
  useAgentEvents,
  initialUploadData,
} from './stores/agent-store'

// Types
export type {
  AgentFlow,
  UploadFlowData,
  UploadFlowStep,
  AgentStatus,
} from './stores/agent-store'

// REMOVED (legacy):
// - AgentBar (replaced by AgentCard)
// - AgentPopup (replaced by AgentCard)
// - useAgentPopup (use useAgentExpanded instead)
```

**Step 4: Verify no remaining imports of legacy components**

```bash
# Search for any remaining imports
grep -rn "from.*agent-bar\|from.*agent-popup\|AgentBar\|AgentPopup\|AgentPopupContent" \
  /Users/fraserbrown/stackdocs/frontend \
  --include="*.tsx" --include="*.ts" \
  | grep -v "node_modules" \
  | grep -v "agent-container.tsx" \
  | grep -v "index.ts"
```

Expected: No results (all imports should be updated)

If any files still reference legacy components, update them before proceeding.

**Step 5: Delete legacy files**

```bash
# Delete obsolete files
rm /Users/fraserbrown/stackdocs/frontend/components/agent/agent-bar.tsx
rm /Users/fraserbrown/stackdocs/frontend/components/agent/agent-popup.tsx
rm /Users/fraserbrown/stackdocs/frontend/components/agent/agent-popup-content.tsx

# Delete old upload-flow.tsx (migrated to flows/documents/upload/)
rm /Users/fraserbrown/stackdocs/frontend/components/agent/flows/documents/upload-flow.tsx
```

**Step 6: Verify TypeScript compiles**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 7: Verify app runs**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npm run dev
```

Test:
1. Navigate to `/documents` - agent card should appear
2. Click Upload action - flow should work
3. Verify no console errors

**Step 8: Clean up store (optional deprecation removal)**

The store has a backwards-compatible `useAgentPopup` selector. If no code uses it after migration, remove it:

```bash
# Search for usage
grep -rn "useAgentPopup" /Users/fraserbrown/stackdocs/frontend --include="*.tsx" --include="*.ts" | grep -v "agent-store.ts"
```

If no results, remove from `agent-store.ts`:

```typescript
// DELETE this:
export const useAgentPopup = () => useAgentStore(
  useShallow((s) => ({ isPopupOpen: s.isExpanded, isExpanded: s.isExpanded }))
)
```

**Step 9: Commit cleanup**

```bash
git add -A && git commit -m "chore(agent): remove legacy bar/popup components

BREAKING CHANGES:
- Removed AgentBar component (use AgentCard)
- Removed AgentPopup component (use AgentCard)
- Removed AgentPopupContent (use flow registry)
- Removed useAgentPopup hook (use useAgentExpanded)

Files deleted:
- agent-bar.tsx
- agent-popup.tsx
- agent-popup-content.tsx
- flows/documents/upload-flow.tsx (migrated)
"
```

---

## Task 7: Final Verification

**Step 1: Run type check**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npx tsc --noEmit
```

Expected: No errors

**Step 2: Run linter**

```bash
cd /Users/fraserbrown/stackdocs/frontend && npm run lint
```

Expected: No errors (or only pre-existing warnings)

**Step 3: Test all registered flows**

Start dev server and verify each flow type shows the correct placeholder:

```bash
cd /Users/fraserbrown/stackdocs/frontend && npm run dev
```

| Flow Type | Test Method |
|-----------|-------------|
| upload | Click Upload action |
| extract-document | Would need document page |
| create-stack | Click Create Stack action |
| edit-stack | Would need stack page |
| add-documents | Would need stack page |
| create-table | Would need stack page |
| manage-columns | Would need table page |
| extract-table | Would need table page |

**Step 4: Commit final state**

```bash
git add -A && git commit -m "feat(agent): complete Config + Hook Hybrid architecture with 8 flow stubs"
```

---

## Phase 4 Checklist

**Flow Stubs:**
- [x] Extract-document flow stub created
- [x] Create-stack flow stub created
- [x] Edit-stack flow stub created
- [x] Add-documents flow stub created
- [x] Create-table flow stub created
- [x] Manage-columns flow stub created
- [x] Extract-table flow stub created
- [x] All 8 flows registered in registry
- [x] Agent actions updated for all routes

**Cleanup (Task 6):**
- [x] AgentContainer updated to use AgentCard
- [x] Barrel export (index.ts) updated
- [x] No remaining imports of legacy components
- [x] Legacy files deleted:
  - [x] `agent-bar.tsx`
  - [x] `agent-popup.tsx`
  - [x] `agent-popup-content.tsx`
  - [x] `flows/documents/upload-flow.tsx`
- [x] `useAgentPopup` removed from store (if unused)
- [x] TypeScript compiles without errors
- [x] App runs and upload flow works

**Final:**
- [x] Final verification passed

---

## Summary

After completing all 4 phases:

**Architecture:**
- Config + Hook Hybrid pattern implemented
- 8 flow types registered with metadata and placeholder hooks
- Unified AgentCard with spring animations
- Click-outside collapse
- Flow registry for easy extension

**What's Working:**
- Upload flow fully functional
- 7 placeholder flows ready for implementation
- Context-aware actions by route

**Next Steps (Future Work):**
- Implement each placeholder flow as needed
- Add route-specific context (documentId, stackId) to flow actions
- Add AgentSteps component usage for processing flows
- Refine animations and transitions
