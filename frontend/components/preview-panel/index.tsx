// Main component
export { PreviewPanel } from './preview-panel'

// Sub-components (exported for testing/reuse)
export { PreviewContainer } from './preview-container'
export { PreviewMetadata } from './preview-metadata'
export { PreviewControls } from './preview-controls'
export { PageNavigation } from './page-navigation'
export { TextContent } from './text-content'
export { ExpandModal } from './expand-modal'

// Note: PdfContent is intentionally NOT exported from this barrel.
// It uses react-pdf which requires browser APIs and will cause SSR errors.
// Always use dynamic import with ssr: false:
//   const PdfContent = dynamic(
//     () => import('./pdf-content').then((mod) => ({ default: mod.PdfContent })),
//     { ssr: false }
//   )
