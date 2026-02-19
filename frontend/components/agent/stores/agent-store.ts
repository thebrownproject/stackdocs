// frontend/components/agent/stores/agent-store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type {} from '@redux-devtools/extension' // required for devtools typing
import type { AgentEvent } from '@/lib/agent-api'

// Upload step type for new Realtime-driven flow
export type UploadFlowStep = 'dropzone' | 'processing' | 'metadata' | 'complete'

// Discriminated union for type-safe flow routing
export type AgentFlow =
  // Document flows
  | { type: 'upload'; step: UploadFlowStep; data: UploadFlowData }
  | { type: 'extract-document'; documentId: string; step: string }
  // Stack flows (post-MVP)
  | { type: 'create-stack'; step: string }
  | { type: 'edit-stack'; stackId: string; step: string }
  | { type: 'add-documents'; stackId: string; step: string }
  // Table flows (post-MVP)
  | { type: 'create-table'; stackId: string; step: string }
  | { type: 'manage-columns'; stackId: string; tableId: string; step: string }
  | { type: 'extract-table'; stackId: string; tableId: string; step: string }
  | null

export interface UploadFlowData {
  file: File | null
  documentId: string | null
  displayName: string
  tags: string[]
  summary: string
  stackId: string | null
  stackName: string | null
  uploadStatus: 'idle' | 'uploading' | 'processing' | 'ready' | 'error'
  uploadError: string | null
  metadataError: string | null
}

export type AgentStatus = 'idle' | 'processing' | 'waiting' | 'complete' | 'error'

interface AgentStore {
  // Card state (unified - no separate popup)
  flow: AgentFlow
  isExpanded: boolean  // Card content visible (actions or flow content)

  // Dynamic bar state
  status: AgentStatus
  statusText: string

  // SSE events (capped at 100)
  events: AgentEvent[]

  // Actions
  openFlow: (flow: NonNullable<AgentFlow>) => void
  setStep: (step: string) => void
  updateFlowData: (data: Partial<UploadFlowData>) => void
  setStatus: (status: AgentStatus, text: string) => void
  addEvent: (event: AgentEvent) => void
  expand: () => void
  collapse: () => void
  toggle: () => void
  close: () => void
  reset: () => void

}

export const initialUploadData: UploadFlowData = {
  file: null,
  documentId: null,
  displayName: '',
  tags: [],
  summary: '',
  stackId: null,
  stackName: null,
  uploadStatus: 'idle',
  uploadError: null,
  metadataError: null,
}

export const useAgentStore = create<AgentStore>()(
  devtools(
    persist(
      (set) => ({
        flow: null,
        isExpanded: false,
        status: 'idle',
        statusText: 'How can I help you today?',
        events: [],

        openFlow: (flow) => set({
          flow,
          isExpanded: true,
          status: 'idle',
          statusText: getFlowStatusText(flow),
          events: [],
        }, undefined, 'agent/openFlow'),

        setStep: (step) => set((state) => {
          if (!state.flow) return state
          return {
            flow: { ...state.flow, step } as AgentFlow,
            statusText: getStepStatusText(state.flow.type, step),
          }
        }, undefined, 'agent/setStep'),

        updateFlowData: (data) => set((state) => {
          if (!state.flow || state.flow.type !== 'upload') return state
          return {
            flow: {
              ...state.flow,
              data: { ...state.flow.data, ...data },
            },
          }
        }, undefined, 'agent/updateFlowData'),

        setStatus: (status, statusText) => set({ status, statusText }, undefined, 'agent/setStatus'),

        addEvent: (event) => set((state) => ({
          events: [...state.events, event].slice(-100), // Cap at 100
        }), undefined, 'agent/addEvent'),

        expand: () => set({ isExpanded: true }, undefined, 'agent/expand'),

        collapse: () => set({ isExpanded: false }, undefined, 'agent/collapse'),

        toggle: () => set((state) => ({ isExpanded: !state.isExpanded }), undefined, 'agent/toggle'),

        close: () => set({
          flow: null,
          isExpanded: false,
          status: 'idle',
          statusText: 'How can I help you today?',
          events: [],
        }, undefined, 'agent/close'),

        reset: () => set({
          flow: null,
          isExpanded: false,
          status: 'idle',
          statusText: 'How can I help you today?',
          events: [],
        }, undefined, 'agent/reset'),
      }),
      {
        name: 'agent-store',
        partialize: (state) => ({
          flow: state.flow
            ? {
                ...state.flow,
                ...(state.flow.type === 'upload' && {
                  data: {
                    ...state.flow.data,
                    file: null, // File objects can't be serialized
                  },
                }),
              }
            : null,
          isExpanded: state.isExpanded,
        }),
      }
    ),
    { name: 'AgentStore', enabled: process.env.NODE_ENV !== 'production' }
  )
)

// Helper functions for status text
function getFlowStatusText(flow: NonNullable<AgentFlow>): string {
  switch (flow.type) {
    case 'upload': return 'Drop a file to get started'
    case 'create-stack': return 'Create a new stack'
    case 'extract-document': return 'Re-extract document'
    case 'edit-stack': return 'Edit stack'
    case 'add-documents': return 'Add documents to stack'
    case 'create-table': return 'Define extraction columns'
    case 'manage-columns': return 'Manage table columns'
    case 'extract-table': return 'Extract data from documents'
    default: return 'How can I help you today?'
  }
}

function getStepStatusText(flowType: string, step: string): string {
  // Upload flow steps
  if (flowType === 'upload') {
    switch (step) {
      case 'dropzone': return 'Drop a file to get started'
      case 'processing': return 'Analyzing document...'
      case 'metadata': return 'Review document details'
      case 'complete': return 'Document saved'
    }
  }
  // Default for other flows
  return 'Working...'
}

// Title helpers for flow steps
export function getUploadTitle(step: UploadFlowStep): string {
  switch (step) {
    case 'dropzone': return 'Upload Document'
    case 'processing': return 'Processing'
    case 'metadata': return 'Document Details'
    case 'complete': return 'Complete'
  }
}

// Selector helpers
export const useAgentFlow = () => useAgentStore((s) => s.flow)
export const useAgentStatus = () => useAgentStore(
  useShallow((s) => ({ status: s.status, statusText: s.statusText }))
)
export const useAgentExpanded = () => useAgentStore((s) => s.isExpanded)
export const useAgentEvents = () => useAgentStore((s) => s.events)
