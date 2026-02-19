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
