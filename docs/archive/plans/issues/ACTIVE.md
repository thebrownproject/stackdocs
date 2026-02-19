# Active Issues [ARCHIVED]

> **MIGRATED TO BEADS:** All 31 issues have been migrated to the Beads issue tracker.
> Use `bd list` to view issues or `bd show <id>` for details.
> This file is kept for historical reference only.

---

~~Lightweight tracking for items that don't need immediate action.~~

~~**Categories:** `bug` | `deprecation` | `tech-debt` | `feature`~~

~~**Workflow:** Notice something → add a line → move to COMPLETED.md when done~~

---

- [ ] #2 `feature` Field type definitions for custom extraction - add type selector (text, number, date, array) to field badges, enforce type safety in agent output (2025-12-23)
- [ ] #3 `bug` Clerk production OAuth missing client_id - Google, Microsoft fail; Apple removed (2025-12-23)
  - Google: Cloud Console → APIs & Credentials → Create OAuth 2.0 Client ID → Add to Clerk
  - Microsoft: Azure Portal → App Registrations → Create app → Add to Clerk
  - Clerk docs: https://clerk.com/docs/authentication/social-connections/google
- [ ] #4 `bug` Sign-in page flashes briefly after login before redirecting to /documents (2025-12-23)
- [ ] #5 `tech-debt` Documents table accessibility: add keyboard navigation (Enter/Space) and ARIA labels to clickable rows (2025-12-23)
- [ ] #6 `feature` OCR images not rendering in Visual preview - Mistral OCR extracts images as `![img-0.jpeg](img-0.jpeg)` but we don't store/serve them (2025-12-23)
  - Options: Store extracted images to Supabase Storage during OCR, or strip/hide image markdown
- [ ] #7 `feature` Investigate Mistral OCR markdown output - currently exporting as raw text, check if API supports structured markdown output (2025-12-23)
- [ ] #8 `bug` Changed field highlight animation not visible - animation exists but too subtle or clearing too fast (2025-12-24)
  - Files: `frontend/app/globals.css:130-142`, `frontend/components/documents/document-detail-client.tsx` (changedFields state), `frontend/components/documents/extracted-data-table.tsx:97`
  - Fix: Increase opacity (currently 15%), extend duration, or check if class is being applied
- [ ] #10 `feature` Global context to persist SSE streams across navigation - currently if user navigates away mid-extraction/correction, progress panel is lost (agent continues server-side) (2025-12-24)
- [ ] #11 `feature` Drag-and-drop anywhere on documents page - drop file anywhere to start upload, skip dialog step 1, jump straight to extraction config (2025-12-24)
- [ ] #12 `feature` Inline stack creation during upload - "+ New Stack" chip in upload dialog to create stack without leaving flow (2025-12-24)
- [ ] #14 `feature` Support JPG/PNG image uploads - Mistral OCR already handles images, just need to update accepted file types in upload dialog (2025-12-24)
- [ ] #16 `bug` Document status stuck at `ocr_complete` - extraction agent saves data but doesn't call `complete` tool, so document/extraction status never updates to `completed` (2025-12-24)
  - Files: `backend/app/agents/extraction_agent/agent.py`, `backend/app/agents/extraction_agent/tools/complete.py`
  - Agent needs to reliably call `complete` tool after saving extraction
- [ ] #18 `feature` Undo/Redo navigation in sidebar header - Linear-style back/forward/history buttons above search, requires navigation history system (2025-12-25)
- [ ] #20 `feature` Sub-bar button functionality - Filter dropdown options, Edit inline editing, Export format options need implementation (2025-12-28)
- [ ] #21 `feature` Upload dialog UI/UX polish - redesign wizard flow, integrate with AI chat bar for seamless upload-to-extraction experience (2025-12-28)
- [ ] #25 `bug` Realtime subscription breaks on document detail pages - channel fails with "CLOSED undefined" after 1-2 minutes, likely Clerk JWT expiry not refreshing Supabase connection (2025-12-28)
  - Error: `[Realtime Debug] Channel failed: CLOSED undefined` in `useExtractionRealtime.useEffect`
  - Files: `frontend/hooks/useExtractionRealtime.ts`
  - Investigate: JWT token refresh, Supabase realtime auth, channel reconnection logic
- [ ] #26 `tech-debt` Evaluate column separation pattern for dynamic tables - Stack tables use separated columns file (`stack-table-columns.tsx`) following documents pattern, but columns are dynamically generated from schema. Consider if inline definition would be simpler for this use case (2025-12-29)
  - Current: `columns.tsx` separate, `documents-table.tsx` imports it (static columns, 170 lines)
  - Stack tables: Dynamic `createStackTableColumns(schema)` function - tightly coupled anyway
  - Question: Does separation still provide value for dynamic column generation?
- [ ] #27 `feature` TanStack Query for instant navigation - Add client-side caching to eliminate loading screens on repeat visits (2025-12-29)
  - Problem: Server Components refetch on every navigation, causing skeleton flashes
  - Solution: TanStack Query with staleTime for documents list, detail pages
  - Goal: File browser feel - cached data shown instantly, background sync
  - Scope: Start with documents list, expand to stacks if successful
- [ ] #28 `feature` Sidebar collapsible section state persistence - Remember open/closed state across page refreshes (2025-12-29)
  - Challenge: SSR hydration mismatch when reading localStorage on client
  - Options: Cookies (server-readable), localStorage with hydration workaround, or accept flash
  - Files: `frontend/components/layout/sidebar/collapsible-section.tsx`
- [ ] #29 `tech-debt` Create useLocalStorage hook - Reusable hook for localStorage state with SSR handling (2025-12-29)
  - Currently: Inline localStorage usage in `preview-panel-context.tsx`
  - Goal: DRY pattern for persisting UI state (sidebar, panels, preferences)
  - Consider: useSyncExternalStore for proper SSR support
- [ ] #30 `feature` Assign document to stacks from document detail page - dropdown in sub-bar to add/remove document from stacks, needs to handle re-extraction when stack membership changes (2025-12-30)
- [ ] #31 `feature` OS-aware keyboard shortcut display - create `useModifierKey()` hook to show ⌘ on Mac, Ctrl on Windows/Linux in tooltips (2025-12-31)
  - Currently: Tooltips hardcode ⌘ symbol (e.g., "Toggle sidebar (⌘B)", "Search (⌘K)")
  - Goal: Detect OS and show appropriate modifier key
  - Files: `frontend/app/(app)/layout.tsx:53`, `frontend/components/layout/sidebar/sidebar-header-menu.tsx:116`
- [ ] #32 `feature` Sidebar gradual collapse - icon-only mode at tablet breakpoint (768-1024px) instead of hard switch to mobile sheet (2025-12-31)
  - Currently: Single breakpoint at 1024px switches directly to mobile sheet overlay
  - Goal: Desktop (≥1024px) full sidebar, Tablet (768-1024px) icon-only locked, Mobile (<768px) sheet
  - Behavior: Icon-only mode locked (no expand), desktop state remembered when resizing back
  - Changes: Update `use-mobile.ts` to three-state, modify `SidebarProvider` and `Sidebar` component
  - Reference: Linear collapses sidebar at ~1024px with similar pattern
- [ ] #33 `feature` AI prompt flow with auto-generated titles - natural language input morphs to brief summary title, agent works on request (2026-01-01)
  - User types prompt in agent bar → bar morphs to show AI-generated 3-5 word title
  - Agent streams response in content area below
  - Same unified card pattern as wizard flows
  - Related: Agent bar redesign (`docs/plans/in-progress/agent-bar-redesign/`)
- [ ] #34 `feature` Agent bar visual styling exploration - backdrop blur, enhanced shadows, animation refinements (2026-01-01)
  - Current: Basic `bg-sidebar` with `shadow-md`
  - Explore: Backdrop blur effects, depth/layering, dark mode polish
  - Related: Agent bar redesign
- [ ] #35 `feature` Agent bar max height and scroll behavior - define expanded height limits and scroll UX (2026-01-01)
  - Define max expanded height before scrolling
  - Scroll behavior for long content (steps list, flow content)
  - Related: Agent bar redesign
- [ ] #36 `feature` Preview panel redesign - UI tweaks to right-side document preview (2026-01-01)
  - PDF/Visual tab styling improvements
  - Document metadata section (filename, date, size, status)
  - Visual (OCR) view markdown rendering polish
  - Loading states when switching documents
- [ ] #37 `feature` Persist selected document in Zustand - remember last selected doc on page reload (2026-01-01)
  - Add localStorage persistence to selected document state
  - Use Zustand persist middleware
  - Restore selection when navigating back to documents page
- [ ] #38 `bug` Scroll padding for agent bar - content cannot scroll past agent bar at bottom (2026-01-01)
  - Documents table and extracted data table cut off behind agent bar
  - Need scroll padding/margin so users can scroll content past the floating bar
  - Affects both documents list and document detail views
- [ ] #40 `feature` Preview panel "Open" button - add button in preview panel header to navigate to document detail (2026-01-04)
  - When document is previewed in sidebar, show "Open" or expand icon in preview panel header
  - Clicking navigates to `/documents/[id]` detail page
  - Pattern similar to Linear/Notion preview panels
  - Related: Preview panel redesign (#36)
- [ ] #41 `feature` Reusable EmptyState component - consistent empty state UI across all pages (2026-01-07)
  - Props: icon, title, description, optional action button
  - Use cases: no documents uploaded, no search results, no filters match, no stacks, preview panel (no doc selected)
  - Design: Simple illustration + text pattern, keep it lightweight
- [ ] #42 `bug` Preview toggle button out of sync with panel state (2026-01-13)
  - Toggle button and panel state get out of sync on page refresh
  - Attempted fix (defaulting `isCollapsed` to `true`) made it worse - reverted
  - Root cause: Context state and ResizablePanel state not properly synced
  - Need: Imperatively sync panel state with context on mount, or use panel as source of truth
  - Files: `frontend/components/preview-panel/preview-panel-context.tsx`, `frontend/app/(app)/documents/layout.tsx`
