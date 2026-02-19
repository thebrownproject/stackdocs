// frontend/lib/upload-config.ts

/**
 * Upload constraints and configuration.
 * Centralized constants for file validation and upload behavior.
 */
export const UPLOAD_CONSTRAINTS = {
  ACCEPTED_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'] as const,
  ACCEPTED_EXTENSIONS: '.pdf,.jpg,.jpeg,.png',
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
} as const

/**
 * Get user-friendly error message for HTTP status code.
 */
export function getUploadErrorMessage(status: number, detail?: string): string {
  switch (status) {
    case 401:
      return 'Session expired. Please sign in again.'
    case 413:
      return 'File too large. Maximum size is 10MB.'
    case 429:
      return 'Upload limit reached. Please try again later.'
    case 415:
      return 'Unsupported file type. Please upload a PDF, JPG, or PNG.'
    default:
      return detail || 'Upload failed. Please try again.'
  }
}
