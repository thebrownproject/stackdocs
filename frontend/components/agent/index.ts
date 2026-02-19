// frontend/components/agent/index.ts

// Card components (NEW - unified agent card system)
export { AgentCard, AgentStatusBar, AgentContent, AgentSteps } from './card'

// Container (uses AgentCard internally)
export { AgentContainer } from './agent-container'

// Actions
export { AgentActions } from './agent-actions'
export { UploadButton } from './upload-button'

// Flows
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
