// frontend/components/agent/flows/documents/upload/metadata.ts
import * as Icons from '@/components/icons'
import type { FlowMetadata } from '../../types'
import type { UploadFlowStep } from '../../../stores/agent-store'

import {
  UploadDropzone,
  UploadProcessing,
  UploadMetadata,
  UploadComplete,
} from './steps'

export const uploadFlowMetadata: FlowMetadata<UploadFlowStep> = {
  type: 'upload',

  steps: ['dropzone', 'processing', 'metadata', 'complete'] as const,

  icons: {
    dropzone: Icons.Upload,
    processing: Icons.Loader2,
    metadata: Icons.FileText,
    complete: Icons.Check,
  },

  statusText: {
    dropzone: 'Drop a file to get started',
    processing: 'Analyzing document...',
    metadata: 'Review document details',
    complete: 'Document saved',
  },

  minimizedText: 'Continue file upload...',

  components: {
    dropzone: UploadDropzone,
    processing: UploadProcessing,
    metadata: UploadMetadata,
    complete: UploadComplete,
  },

  backableSteps: [] as const, // No back navigation in new flow

  confirmationSteps: ['processing'] as const, // Only confirm close during processing
}
