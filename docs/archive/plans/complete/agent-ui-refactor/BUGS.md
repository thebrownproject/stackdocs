# Agent UI Refactor - Bugs

## Open Bugs

### Document rename doesn't persist
**Status:** Open
**Found:** 2025-01-01 (Session 81)
**Severity:** Low

**Description:**
When renaming a document in the Configure Extraction step, the new name appears in the success message ("Successfully extracted data from Test-Renamed-Document.pdf") but the actual document is saved with the original filename.

**Steps to reproduce:**
1. Open upload popup
2. Drop a PDF file
3. Change the Document Name field to a new name
4. Click Extract
5. Click View Document
6. Observe: Header shows original filename, not the renamed one

**Expected:** Document should be saved with the renamed value
**Actual:** Document is saved with original filename

**Notes:**
- The rename field UI works correctly
- The success message shows the renamed value
- The backend may not be receiving/saving the renamed value

---

## Fixed Bugs

| Bug | Fixed In | Notes |
|-----|----------|-------|
| Create Stack action stuck UI | Session 80 | Removed action until flow implemented |
| Popup wider than bar | Session 80 | Added `w-full` to popup container |
| Header Upload button redundant | Session 81 | Removed, kept sub-bar + sidebar only |
| ActionButton icon size mismatch | Session 81 | Removed custom `size-3.5` from AgentActions |
