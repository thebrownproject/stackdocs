# Stackdocs MVP - Product Requirements Document

## Project Goal

Build a general-purpose document data extraction tool that uses AI to extract structured data from any document type (invoices, receipts, contracts, forms). Users upload documents, specify what fields they want extracted (or let AI decide), and download the results as CSV/JSON. Designed for small businesses and operations teams who need to eliminate manual data entry.

**One-line pitch:** "AI-powered document data extraction - upload any document, get structured data in seconds"

---

## Target User

**Primary User:** Small business owners and operations teams (1-20 employees) who manually enter data from documents into spreadsheets or business software

**Pain Points:**
- Spend 5-10 hours/week manually typing data from invoices, receipts, contracts into Excel/systems
- Existing OCR tools produce messy text, not structured data automatically
- Need data in specific format (CSV) for importing into accounting/CRM software
- Processing 50-200 documents/month across various document types

**Success Criteria:**
- **Time savings:** Manual entry takes 5 min/document → Stackdocs reduces to 30 seconds
- **Accuracy:** >95% extraction accuracy with minimal manual corrections needed
- **Ease of use:** Non-technical users can extract data without training

---

## Core User Flow (MVP - Flow A)

### Mode 1: Auto Extraction
1. User lands on dashboard, clicks "Upload Document"
2. User selects "Auto Extract" mode
3. User uploads document (PDF/image - drag & drop or file picker)
4. System processes document:
   - Mistral OCR extracts text via Mistral Direct API
   - Claude analyzes and extracts all relevant fields automatically
5. User sees document in library with extraction results displayed
6. User can:
   - View extracted data in table format with confidence scores
   - View original PDF or OCR text in preview panel
   - Edit fields via form OR use **agent chat** for natural language corrections
   - Download as JSON or CSV
   - Re-extract with custom fields if needed

### Mode 2: Custom Fields Extraction
1. User lands on dashboard, clicks "Upload Document"
2. User selects "Custom Fields" mode
3. User specifies fields to extract (click "Add Field" button, enter field names)
   - Example: vendor_name, invoice_date, total_amount, line_items
4. User uploads document
5. System processes document:
   - Mistral OCR extracts text/layout
   - Claude extracts ONLY the specified fields
6. User sees document with extraction results
7. User can:
   - Edit fields via form OR use **agent chat** for corrections
   - Download as JSON or CSV
   - Re-extract with different fields

### Document Library
- Grid view (card layout) showing all uploaded documents
- Each card displays:
  - Document thumbnail
  - Filename
  - Upload date
  - Extraction status (processing/completed/failed)
  - Key extracted fields preview (vendor, amount, date)
  - Actions: View, Edit, Re-extract, Download, Delete

---

## Functional Requirements

### Must Have (P0 - MVP Launch Blockers)

**Document Upload (FR1):**
- Support PDF, JPG, PNG files (max 10MB per file)
- Drag-and-drop upload zone
- File picker button as alternative
- Single file upload only (no bulk processing in MVP)
- Files stored in Supabase Storage (S3-backed)

**Extraction Modes (FR2):**
- **Auto mode**: AI extracts all relevant fields from document
- **Custom fields mode**: User specifies exact fields to extract via form inputs
- Mode selected BEFORE upload
- Both modes use same backend extraction logic (Mistral OCR + Claude Agent SDK)

**Data Extraction (FR3):**
- Mistral OCR performs text extraction via Mistral Direct API (~$2 per 1,000 pages)
- OCR results cached in `ocr_results` table for cost-efficient re-extraction
- Claude Agent SDK extracts structured data via agentic workflow
- Agent uses custom database tools to read OCR and write extractions
- Real-time thinking displayed via SSE streaming
- Processing time: <30 seconds per document
- FastAPI BackgroundTasks for OCR (non-blocking)

**Document Library (FR4):**
- Grid view displaying all user's documents
- Document cards show thumbnail + key fields
- Filter by status (all/processing/completed/failed)
- Search by filename
- Pagination (20 documents per page)

**Extraction Results Display (FR5):**
- **Two-level layout** for extracted data:
  - Scalar fields (vendor, date, total) displayed as label/value pairs
  - Array fields (line_items) displayed as nested tables
- Show confidence indicator per field (percentage + green tick for high confidence)
- **Document preview panel** with tabs:
  - PDF tab: View original document
  - OCR Text tab: View extracted text
- Display filename and status alongside data
- Clear field labels and values

**Data Editing (FR6):**
- Click "Edit" button → Modal/sidebar form opens
- Edit any extracted field value
- Save changes (updates extraction record in DB)
- Support nested data structures (e.g., line_items array)
- **Agent chat input** - Natural language corrections via text box
  - "Ask agent to filter, edit, or analyze data..."
  - Agent uses session resume to remember document context
  - Example: "Change vendor to Acme Corporation" or "Remove the third line item"

**Re-extraction (FR7):**
- User can re-extract same document with different settings
- Multiple extractions stored per document (extraction history)
- Each extraction has timestamp and mode (auto/custom)
- Latest extraction displayed by default

**Data Export (FR8):**
- **CSV export**: Denormalized rows (one row per line item, parent fields repeated)
  - Excel-native format, easy to filter/pivot
- **JSON export**: Preserves nested structure as-is
- Immediate download (no email/delay)
- Export includes all extracted fields

**Authentication (FR9):**
- Clerk for authentication (email/password, OAuth)
- User accounts required from day 1
- Each user has isolated document library
- Logout functionality

**Usage Limits (FR10):**
- Free tier: 5 documents per month
- Usage counter displayed in UI
- Block uploads when limit reached (show upgrade prompt)
- Reset counter monthly

### Nice to Have (P1 - Post-MVP)

- **Stacks** - Group documents into collections, create custom tables, extract one row per document
  - Documents can belong to multiple stacks (many-to-many)
  - Create multiple tables per stack with custom columns
  - stack_agent extracts data across all documents in stack
- Batch upload (multiple documents at once)
- Saved templates (reusable custom field configurations)
- AI-suggested templates based on document type detection
- Webhook notifications when extraction completes
- API access for programmatic extraction
- Integration with Xero/QuickBooks
- Team accounts (share document libraries)
- Bulk CSV export (all documents in library)

### Out of Scope (NOT Building in MVP)

- ❌ Document type auto-detection with template suggestions
- ❌ Schema learning system (from spike)
- ❌ Visual field mapper (click on document to select fields)
- ❌ Advanced analytics (field frequency, schema evolution)
- ❌ Mobile apps
- ❌ Real-time collaboration
- ❌ Document versioning
- ❌ OCR quality comparison (multiple OCR engines)

---

## User Stories

**US1: As a user, I want to upload a document and have AI automatically extract all relevant data**
- So I don't have to manually specify what fields I need
- Acceptance: Auto mode extracts vendor, date, amount, line_items from invoice without prompts

**US2: As a user, I want to specify exactly which fields to extract from my documents**
- So I get consistent data structure across all my documents
- Acceptance: Custom mode extracts only the 5 fields I specified, ignoring other data

**US3: As a user, I want to see all my uploaded documents in one place**
- So I can track what I've processed and access past extractions
- Acceptance: Document library shows all uploads with thumbnails, status, and key fields

**US4: As a user, I want to edit extracted data if the AI made mistakes**
- So I can correct errors without re-uploading or re-extracting
- Acceptance: Click edit → modify vendor name → save → data updated in extraction record

**US5: As a user, I want to re-extract a document with different settings**
- So I can try custom fields after seeing auto extraction results
- Acceptance: Re-extract button creates new extraction, keeps history of both

**US6: As a user, I want to download extracted data as CSV**
- So I can import it into Excel or my accounting software
- Acceptance: Download CSV → opens in Excel → all fields present and formatted correctly

**US7: As a user, I want to create an account and keep my documents private**
- So my business data is secure and separated from other users
- Acceptance: Sign up → log in → only see my own documents

**US8: As a user, I want to know how many free extractions I have left**
- So I can plan my usage and decide when to upgrade
- Acceptance: Dashboard shows "3/5 free extractions used this month"

**US9: As a user, I want to correct extraction errors using natural language**
- So I don't have to manually edit form fields for simple corrections
- Acceptance: Type "Change vendor to Acme Corp" → Agent updates the field → See updated data

**US10: As a user, I want to group related documents into stacks and extract consistent data across them**
- So I can compare data from multiple invoices/contracts in a single table
- Acceptance: Create "Q1 Expenses" stack → Add 10 invoices → Create "Master Data" table → See one row per invoice with vendor, amount, date

---

## Tech Stack

**Frontend:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- TanStack Table for dynamic data tables
- Clerk for authentication
- Deployed on Vercel (`www.stackdocs.io`)

**Backend:**
- FastAPI (Python 3.11+)
- Claude Agent SDK - agentic extraction with session resume, SSE streaming
- Mistral OCR (`mistral-ocr-latest` via Mistral Python SDK)
- FastAPI BackgroundTasks for async processing
- Deployed on DigitalOcean Droplet (`api.stackdocs.io`)

**Database:**
- Supabase PostgreSQL
- Supabase Storage (S3-backed) for document files
- Supabase Realtime for status updates

**AI/LLM:**
- Claude Agent SDK with custom database tools (agentic workflow)
- Real-time thinking displayed via SSE streaming
- Session resume for contextual corrections
- Mistral OCR for text extraction (~$2 per 1,000 pages)

---

## Non-Functional Requirements

**Performance:**
- Document upload: Show progress indicator for files >2MB
- Extraction processing: <30 seconds per document
- Document library load time: <2 seconds for 50 documents
- UI response time: <500ms for client-side interactions

**Accuracy:**
- Extraction accuracy: >80% field-level accuracy (measured on sample documents)
- Confidence scores shown for each field
- Users can manually correct errors

**Security:**
- HTTPS only (all traffic encrypted)
- Clerk handles authentication and password security
- Document files stored in Supabase Storage (access-controlled)
- User data isolated (row-level security)
- API authentication via Clerk JWT tokens

**Reliability:**
- Graceful error handling (OCR failures, LLM timeouts, network issues)
- Clear error messages to user
- Document status tracking (processing/completed/failed)
- Retry logic for transient failures (up to 3 attempts)

**Usability:**
- Mobile-responsive design
- Clear onboarding for first-time users
- Intuitive mode selection (auto vs custom)
- Helpful empty states ("Upload your first document to get started")

---

## Success Metrics

**Week 3 (Soft Launch - No Payment):**
- 10 signups
- 50 documents processed
- Average user uploads 5+ documents
- Extraction accuracy >80% (measured via user edits)

**Month 2 (After Adding Stripe):**
- 25 active users (used in last 7 days)
- 200 documents processed
- 5 paid customers (upgraded from free tier)
- $100-500 MRR

**Key Metrics to Track:**
- Signup → first extraction conversion (target >60%)
- Free → paid conversion (target >10%)
- Documents processed per user (target: 10+/month)
- Extraction accuracy (target: >80%)
- Time saved per document (target: 5 min → 30 sec)
- User retention (day 7, day 30)

---

## Design Decisions (Resolved)

**Product Decisions:**
| Question | Decision |
|----------|----------|
| Word docs (.docx) support? | **No** - PDF/images only for MVP |
| Max complexity for nested data? | Accept any complexity, display arrays as nested tables |
| Re-extract behavior? | **Creates new extraction** (preserves history for comparison) |

**Technical Decisions:**
| Question | Decision |
|----------|----------|
| Large PDFs (50+ pages)? | **Accept** - Mistral handles up to 1000 pages, just takes longer |
| Confidence scores? | **Per-field** with simple visual indicator (green tick) |
| OCR API failure fallback? | Retry with exponential backoff + user notification |

**UX Decisions:**
| Question | Decision |
|----------|----------|
| Document preview? | **Both** - PDF viewer tab + OCR Text tab |
| Custom field name guidance? | Placeholder text: "e.g., vendor_name, total_amount" |
| CSV nested arrays? | **Denormalized rows** (one row per line item, parent fields repeated) |

---

## Go-to-Market Plan

**Week 1-2 (Build Core):**
- Build upload + auto extraction + document library
- Test with 10 sample documents (invoices, receipts, contracts)

**Week 3 (Soft Launch - Free Beta):**
- Launch without Stripe (all users get free access)
- Post on r/smallbusiness: "I built a tool to extract data from documents using AI"
- Post on Twitter with demo video
- Email 10-20 small business owners for beta testing
- Goal: 10 users, 50 documents processed

**Week 4 (Add Stripe):**
- Implement usage limits (5 free docs/month)
- Add Stripe subscription ($20/1000 docs, $50/5000 docs)
- Enable upgrade flow
- Goal: 2-3 paid conversions

**Month 2 (Iterate Based on Feedback):**
- Improve extraction accuracy based on user corrections
- Add most-requested features (batch upload? saved templates?)
- Fix biggest UX friction points
- Goal: $100-500 MRR, 25 active users

---

## Pricing Model (Added Week 4)

**Free Tier:**
- 5 documents per month
- All extraction features (auto + custom)
- Document library access
- CSV/JSON export

**Starter Plan - $20/month:**
- 1,000 documents per month
- All features
- Email support

**Professional Plan - $50/month:**
- 5,000 documents per month
- All features
- Priority email support

**Notes:**
- No credit card required for free tier
- Usage resets monthly (1st of each month)
- Overage: $0.025 per document beyond plan limit

---

## Code Philosophy

**LEAN & FOCUSED - Ship working product in 2-3 weeks**

- **Start with monolith**: FastAPI backend calling Mistral OCR API (no microservices, simpler deployment)
- **Simplicity over cleverness**: Straightforward extraction logic, no premature optimization
- **User feedback first**: Ship basic version, iterate based on real usage patterns
- **No feature creep**: Stick to PRD, track "nice to have" ideas for post-MVP
- **Test with real documents**: Use actual invoices/receipts, not synthetic data

**Backend (FastAPI + Claude Agent SDK):**
- Clear separation: routes, agents, tools
- Claude Agent SDK with custom database tools for agentic extraction
- SSE streaming for real-time agent thinking
- Session resume for contextual corrections
- Async processing for OCR (BackgroundTasks)
- Proper error handling and logging
- Tool naming convention: `read_*` (fetch data), `save_*` (write objects), `set_*` (update fields), `delete_*` (remove), `create_*` (new records), `complete` (state transitions)

**Frontend (Next.js + Supabase):**
- Server components where possible (reduce client JS)
- Direct Supabase access for data operations (no backend for reads)
- Supabase Realtime for status updates (no polling)
- Clear loading and error states
- Mobile-first responsive design

---

## Related Documentation

- **Architecture**: `docs/specs/ARCHITECTURE.md` (data flow, API endpoints)
- **Database schema**: `docs/specs/SCHEMA.md` (table definitions, relationships)
- **Roadmap**: `docs/plans/roadmap/` (IN-PROGRESS.md, TODO.md, COMPLETE.md)
