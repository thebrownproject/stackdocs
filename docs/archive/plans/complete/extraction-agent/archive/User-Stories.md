# Claude Agent SDK Migration - User Stories & Functional Requirements

## Overview

This document defines the user stories and functional requirements for migrating Stackdocs from the Anthropic SDK to the Claude Agent SDK, enabling session-based extraction with memory and streaming feedback.

---

## User Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| **End User** | Small business owner, accountant, or admin processing documents | Fast, accurate extraction; easy corrections; export data |
| **Power User** | Processes high volumes; uses custom fields | Efficiency; batch workflows; consistent schema |
| **Developer** | You - building and maintaining the system | Clean architecture; debuggability; maintainability |

---

## Epic 1: Streaming Document Processing

### User Story 1.1: See AI Analysis in Real-Time

> **As an** end user
> **I want to** see Claude's analysis as it processes my document
> **So that** I understand what's happening and trust the extraction results

**Acceptance Criteria:**
- [ ] User uploads a document and sees a processing view
- [ ] Claude's thinking/analysis streams to the UI in real-time
- [ ] User sees status updates: "Running OCR...", "Analyzing document...", "Extracting data..."
- [ ] When complete, extraction results display immediately (no page refresh)
- [ ] Total processing time is visible

**Technical Notes:**
- SSE streaming from FastAPI to frontend
- Use `fetch()` with `ReadableStream`, not `EventSource` (POST not supported)

---

### User Story 1.2: Understand Extraction Reasoning

> **As an** end user
> **I want to** see why Claude extracted specific values
> **So that** I can verify the extraction is correct before using the data

**Acceptance Criteria:**
- [ ] Claude explains its reasoning before showing results (e.g., "This appears to be an invoice from Acme Corp dated...")
- [ ] Thinking is displayed in a collapsible panel (expanded by default on first extraction)
- [ ] User can hide/show the thinking panel
- [ ] Thinking text is stored with the extraction for later review

**Technical Notes:**
- Agent SDK streams text blocks before tool use
- Store `thinking_text` in extractions table

---

### User Story 1.3: Handle Processing Failures Gracefully

> **As an** end user
> **I want to** know immediately if something goes wrong during processing
> **So that** I can retry or contact support

**Acceptance Criteria:**
- [ ] If OCR fails, user sees specific error: "Could not read document. Try a clearer image."
- [ ] If extraction fails, user sees: "Extraction failed. [Retry] [Try Different Mode]"
- [ ] If connection drops mid-stream, app recovers by checking document status
- [ ] Failed documents show in library with "Failed" badge and retry option

**Technical Notes:**
- Backend saves status updates to DB during processing (not just at end)
- Frontend falls back to Supabase Realtime if SSE connection drops

---

## Epic 2: Session-Based Corrections

### User Story 2.1: Correct Extraction with Natural Language

> **As an** end user
> **I want to** fix extraction errors by typing what's wrong in plain English
> **So that** I don't have to re-upload or manually edit complex forms

**Acceptance Criteria:**
- [ ] Extraction results view has a text input for corrections
- [ ] User types instruction like "Change vendor to Acme Corporation Inc"
- [ ] Claude processes the correction and updates the extraction
- [ ] Correction creates a new extraction record (history preserved)
- [ ] Original extraction remains accessible

**Example Corrections:**
- "Fix the vendor name to 'Acme Corp'"
- "The total should be $1,500, not $1,200"
- "Remove line item 3"
- "Add a line item: Widget X, quantity 5, price $20"

**Technical Notes:**
- Uses session resume - Claude remembers document context
- New extraction record with same `session_id`

---

### User Story 2.2: Make Multiple Corrections in Sequence

> **As an** end user
> **I want to** make several corrections one after another
> **So that** I can fix multiple issues without starting over each time

**Acceptance Criteria:**
- [ ] After one correction, user can immediately make another
- [ ] Claude remembers ALL previous corrections (cumulative context)
- [ ] User can see correction history: "Correction 1: Changed vendor... Correction 2: Fixed total..."
- [ ] Each correction is a separate extraction record for audit trail

**Technical Notes:**
- Session persists across multiple corrections
- Same `session_id` used for entire correction chain

---

### User Story 2.3: Correct After Leaving and Returning

> **As an** end user
> **I want to** make corrections even after closing my browser and coming back later
> **So that** I'm not forced to review everything in one sitting

**Acceptance Criteria:**
- [ ] User can close browser, return hours/days later, and make corrections
- [ ] Claude still remembers the document context (within 30-day session limit)
- [ ] If session expired, user sees message: "Session expired. Making a fresh extraction."
- [ ] Fallback extraction uses cached OCR (no re-upload needed)

**Technical Notes:**
- `session_id` stored in DB and used for resume
- Sessions persist in `~/.claude/projects/` for 30 days
- Fallback to stateless extraction if session unavailable

---

### User Story 2.4: See What Claude Understood

> **As an** end user
> **I want to** see Claude confirm what it's about to change before it does it
> **So that** I can catch misunderstandings before they become errors

**Acceptance Criteria:**
- [ ] When user submits correction, Claude first explains its understanding
- [ ] Example: "I'll update the vendor from 'Acme Corp' to 'Acme Corporation Inc'"
- [ ] User sees updated extraction with changes highlighted
- [ ] Clear indication of what changed vs. what stayed the same

**Technical Notes:**
- Stream Claude's response showing understanding
- UI highlights changed fields (diff view)

---

## Epic 3: Extraction Modes

### User Story 3.1: Auto-Extract All Relevant Data

> **As an** end user
> **I want to** upload a document and get all relevant data extracted automatically
> **So that** I don't have to specify what I'm looking for

**Acceptance Criteria:**
- [ ] "Auto" mode extracts comprehensive data based on document type
- [ ] Invoice → vendor, customer, line items, totals, dates
- [ ] Resume → contact info, experience, education, skills
- [ ] Receipt → merchant, items, total, date, payment method
- [ ] Uses rich nested structures (arrays of objects, not flat fields)

**Technical Notes:**
- Existing `AUTO_PROMPT` already defines structure requirements
- Agent SDK tool captures structured output

---

### User Story 3.2: Extract Only Specific Fields

> **As a** power user
> **I want to** specify exactly which fields to extract
> **So that** I get consistent schemas across multiple documents

**Acceptance Criteria:**
- [ ] "Custom" mode allows user to enter field names
- [ ] User enters: "vendor, total, invoice_date"
- [ ] Only specified fields extracted (with nested structure where appropriate)
- [ ] Missing fields returned as null with confidence 0.0
- [ ] Custom fields remembered for future documents (per-user preference)

**Technical Notes:**
- Existing `CUSTOM_PROMPT` handles this
- Future: saved templates for common field sets

---

## Epic 4: Reliability & Recovery

### User Story 4.1: Recover from Connection Loss

> **As an** end user
> **I want** the app to handle network issues gracefully
> **So that** I don't lose my extraction if my connection drops

**Acceptance Criteria:**
- [ ] If SSE connection drops, app checks document status via Supabase
- [ ] If extraction completed, results are shown (no re-processing needed)
- [ ] If still processing, app subscribes to Realtime for completion notification
- [ ] User sees: "Connection lost. Checking status..." then appropriate result

**Technical Notes:**
- DB updates happen during stream, not just at end
- Supabase Realtime as fallback notification channel

---

### User Story 4.2: Handle Session Expiry

> **As an** end user
> **I want** a smooth experience even if my session has expired
> **So that** I can still make corrections without confusion

**Acceptance Criteria:**
- [ ] App attempts session resume first
- [ ] If session expired/invalid, app falls back to stateless correction
- [ ] User sees: "Starting fresh analysis..." (not an error)
- [ ] Stateless correction still works using cached OCR + previous extraction as context
- [ ] Session validity tracked in database

**Technical Notes:**
- Catch session resume errors gracefully
- Fallback prompt includes previous extraction for context

---

### User Story 4.3: Debug Extraction Issues

> **As a** developer
> **I want** to see what happened during extraction
> **So that** I can diagnose and fix issues

**Acceptance Criteria:**
- [ ] Thinking text stored with each extraction
- [ ] Processing time logged (OCR time, extraction time)
- [ ] Error details captured for failed extractions
- [ ] Session ID traceable across correction chain
- [ ] Admin view shows extraction history with full context

**Technical Notes:**
- Add `thinking_text`, `processing_time_ms`, `error_details` to extractions table
- Structured logging for debugging

---

## Epic 5: Performance & Cost

### User Story 5.1: Fast Processing

> **As an** end user
> **I want** documents to process quickly
> **So that** I'm not waiting around

**Acceptance Criteria:**
- [ ] Typical document (1-3 pages) processes in under 30 seconds
- [ ] User sees progress throughout (not just spinner)
- [ ] OCR result cached - re-extraction doesn't re-run OCR
- [ ] Streaming makes perceived wait time shorter

**Performance Targets:**
- OCR: 5-15 seconds (Mistral API)
- Extraction: 10-20 seconds (Claude)
- UI feedback: Every 1-2 seconds during processing

---

### User Story 5.2: Efficient Corrections

> **As a** developer (cost-conscious)
> **I want** corrections to use session memory efficiently
> **So that** we don't repeat expensive context on every correction

**Acceptance Criteria:**
- [ ] Corrections don't re-send full document text
- [ ] Session memory eliminates need to re-explain context
- [ ] Token usage for corrections is significantly lower than initial extraction
- [ ] Usage metrics tracked: tokens per extraction, tokens per correction

**Technical Notes:**
- Monitor `ResultMessage.usage` for token tracking
- Compare session-resume cost vs stateless correction cost

---

## Functional Requirements Summary

### FR1: Streaming Extraction

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | System shall stream Claude's thinking text to frontend via SSE | P0 |
| FR1.2 | System shall display status updates during OCR and extraction phases | P0 |
| FR1.3 | System shall save extraction to database before stream completes (partial save) | P1 |
| FR1.4 | System shall store thinking text with extraction record | P1 |

### FR2: Session Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | System shall capture and store session_id from initial extraction | P0 |
| FR2.2 | System shall resume session for correction requests | P0 |
| FR2.3 | System shall fall back to stateless mode if session unavailable | P0 |
| FR2.4 | System shall track session expiry (30-day TTL) | P1 |
| FR2.5 | System shall support multiple corrections per document | P0 |

### FR3: Correction Flow

| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | System shall accept natural language correction instructions | P0 |
| FR3.2 | System shall preserve extraction history (new record per correction) | P0 |
| FR3.3 | System shall stream correction reasoning to frontend | P1 |
| FR3.4 | System shall highlight changed fields in UI | P2 |

### FR4: Error Handling

| ID | Requirement | Priority |
|----|-------------|----------|
| FR4.1 | System shall update document status in DB during processing (not just at end) | P0 |
| FR4.2 | System shall recover from SSE connection loss via Supabase query | P0 |
| FR4.3 | System shall display user-friendly error messages | P0 |
| FR4.4 | System shall log detailed errors for debugging | P1 |

### FR5: API Endpoints

| ID | Requirement | Priority |
|----|-------------|----------|
| FR5.1 | `POST /api/process/stream` - Upload and extract with streaming | P0 |
| FR5.2 | `POST /api/re-extract/stream` - Correction with session resume | P0 |
| FR5.3 | Both endpoints shall return SSE format responses | P0 |
| FR5.4 | Both endpoints shall include session_id in completion event | P0 |

---

## Non-Functional Requirements

### NFR1: Performance

- Initial extraction: < 30 seconds for typical document
- Correction: < 15 seconds
- First streaming chunk: < 3 seconds after request

### NFR2: Reliability

- Session resume success rate: > 95% (within 30-day window)
- Graceful degradation to stateless mode when session unavailable
- Zero data loss on connection interruption

### NFR3: Scalability

- Support single-instance deployment initially
- Session storage must use persistent volume (Docker)
- Design for future horizontal scaling (session store migration path)

### NFR4: Security

- Session IDs not exposed in URLs (POST body only)
- User can only resume their own sessions (RLS enforced)
- No PII in session storage filenames

---

## Database Schema Changes

```sql
-- Documents table additions
ALTER TABLE documents
  ADD COLUMN session_id TEXT,
  ADD COLUMN session_valid BOOLEAN DEFAULT true,
  ADD COLUMN session_expires_at TIMESTAMPTZ;

CREATE INDEX idx_documents_session_id ON documents(session_id);

-- Extractions table additions
ALTER TABLE extractions
  ADD COLUMN session_id TEXT,
  ADD COLUMN thinking_text TEXT,
  ADD COLUMN processing_time_ms INTEGER,
  ADD COLUMN is_correction BOOLEAN DEFAULT false,
  ADD COLUMN correction_instruction TEXT;
```

---

## Event Schema (SSE)

```typescript
// Status update during processing
{ type: "status", message: "Running OCR...", phase: "ocr" }
{ type: "status", message: "Analyzing document...", phase: "extraction" }

// Claude's thinking (streaming)
{ type: "thinking", text: "This appears to be an invoice..." }
{ type: "thinking", text: " from Acme Corporation dated..." }

// Extraction complete
{
  type: "complete",
  extraction: { extracted_fields: {...}, confidence_scores: {...} },
  session_id: "abc-123",
  thinking: "Full thinking text...",
  processing_time_ms: 12500
}

// Error
{ type: "error", message: "Extraction failed", code: "EXTRACTION_FAILED", retry: true }
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Thinking display default | **Expanded** | Builds trust, shows AI reasoning upfront |
| Correction confirmation | **No confirmation** | Faster UX - user sees result immediately, can correct again if needed |
| Session expiry UX | TBD | Consider warning when session nearing 30-day expiry |
| Cost visibility | TBD | Consider showing token usage for power users |

---

## Next Steps

1. Validate session_id capture with SDK proof-of-concept
2. Implement database migrations
3. Build streaming extraction endpoint
4. Build correction endpoint with session resume
5. Develop frontend streaming UI
6. Integration testing with real documents
