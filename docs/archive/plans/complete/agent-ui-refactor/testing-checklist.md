# Agent UI Refactor - Testing Checklist

## Upload Flow Tests

- [x] Upload button opens popup with dropzone (sub-bar + sidebar both work)
- [x] Dropzone accepts PDF files (drag or click)
- [ ] Dropzone accepts JPG/PNG files (not tested)
- [ ] File validation rejects invalid types (not tested)
- [ ] File validation rejects files > 10MB (not tested)
- [x] Document rename field works in configure step
- [x] Auto Extract method triggers SSE streaming
- [ ] Custom Fields → Next → Fields step works (not tested)
- [ ] Custom field tags can be added/removed (not tested)
- [x] Popup collapses during extraction
- [x] Bar shows dynamic status during extraction
- [x] Complete step shows success actions
- [x] "View Document" navigates correctly
- [ ] "Upload Another" resets flow (not tested)
- [ ] Close mid-flow (configure/fields/extracting) shows confirmation dialog (not tested)
- [ ] Close on dropzone/complete steps does NOT show confirmation (not tested)

## AgentBar Tests

- [x] Bar visible on `/documents`
- [x] Bar visible on `/stacks`
- [x] Bar visible on `/documents/[id]`
- [x] Bar visible on `/stacks/[id]`
- [x] Bar hidden on other routes (N/A - no other routes exist)
- [x] Focus on bar input reveals action buttons
- [x] Blur from bar hides action buttons
- [x] Expand/collapse button toggles actions panel
- [x] Status text updates during flow (Reading OCR → Extraction complete)
- [x] Status icon changes based on state (spinner → checkmark)

## Popup Tests

- [x] Popup width matches bar width
- [x] Popup appears above bar (not overlapping)
- [x] Collapse button minimizes popup
- [x] Close button closes flow
- [ ] Popup content scrolls if too tall (N/A - content fits)

## Mobile/Responsive Tests

- [ ] Full width on mobile (< 640px)
- [ ] Max-width constraint on desktop (sm+)
- [ ] iOS safe area padding works (test on real device/simulator)

## Integration Tests

- [x] Sidebar upload button opens agent popup
- [x] Sub-bar upload button opens agent popup
- [x] Both buttons use same flow/state
- [x] No console errors during flow
- [x] TypeScript compiles with no errors
- [x] Build passes

## Bugs Found During Testing

| Bug | Status | Notes |
|-----|--------|-------|
| Create Stack action stuck UI | Fixed | Removed action until flow implemented |
| Popup wider than bar | Fixed | Added `w-full` to popup container |
| Header Upload button redundant | Fixed | Removed, kept sub-bar + sidebar only |

---

Last Updated: 2025-01-01
