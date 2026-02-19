# Hybrid Architecture Migration Plan

**Date**: 2025-12-16
**Status**: Planning Complete - Ready for Implementation
**Purpose**: Migrate Stackdocs to hybrid architecture with Claude SDK and direct Supabase frontend

---

## Executive Summary

This document outlines the migration from the current LangChain + FastAPI-centric architecture to a **hybrid architecture** where:

1. **Frontend connects directly to Supabase** for all data operations
2. **FastAPI is simplified to AI-only endpoints** (OCR + extraction)
3. **LangChain is replaced with Anthropic SDK** for extraction

**Why this change?**
- Reduces API endpoints to maintain (Supabase handles CRUD)
- Leverages Supabase Realtime for status updates (no polling)
- Simpler, more direct Claude integration via Anthropic SDK
- Better separation of concerns (data vs AI processing)

---

## Architecture: Before vs After

### Current Architecture (LangChain + Full FastAPI)

```
Next.js Frontend
    ↓ All requests go through FastAPI
FastAPI Backend
    - Document CRUD endpoints
    - Extraction endpoints
    - Usage endpoints
    - Status polling endpoints
    - LangChain + OpenRouter for extraction
    ↓
Supabase (Database + Storage)
```

**Problems:**
- Many endpoints to build and maintain
- Frontend must go through FastAPI for simple reads
- Polling required for status updates
- LangChain adds abstraction layer we don't need

### New Architecture (Hybrid)

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
├─────────────────────────────────────────────────────────────┤
│  Supabase Client (Direct)     │    FastAPI (AI Only)        │
│  ─────────────────────────    │    ──────────────────       │
│  • Auth (login/signup)        │    • POST /api/process      │
│  • Read documents             │      (upload → OCR → extract)│
│  • Read extractions           │    • POST /api/re-extract   │
│  • Read user/usage            │      (new extraction from   │
│  • Edit extractions           │       cached OCR)           │
│  • Realtime subscriptions     │                             │
└───────────────┬───────────────┴─────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────────┐  ┌─────────────────────────┐
│      Supabase Platform        │  │   FastAPI Backend       │
├───────────────────────────────┤  ├─────────────────────────┤
│  • PostgreSQL (RLS enforced)  │  │  • Mistral OCR API      │
│  • Storage (documents)        │  │  • Anthropic SDK        │
│  • Auth (JWT tokens)          │  │  • Background tasks     │
│  • Realtime (status updates)  │  │  • Usage enforcement    │
└───────────────────────────────┘  └─────────────────────────┘
```

**Benefits:**
- Only 2 FastAPI endpoints to maintain
- Frontend gets real-time updates via Supabase Realtime
- Direct Anthropic SDK = simpler code, fewer dependencies
- Supabase handles auth, CRUD, and subscriptions natively

---

## What Changes

### 1. FastAPI Endpoints

| Endpoint | Current Status | After Migration |
|----------|---------------|-----------------|
| `POST /api/upload` | Implemented | **Merge into `/api/process`** |
| `POST /api/test-ocr/{id}` | Implemented (test) | **Remove** (merged into process) |
| `POST /api/test-extract-auto` | Implemented (test) | **Remove** (merged into process) |
| `POST /api/test-extract-custom` | Implemented (test) | **Remove** (merged into process) |
| `GET /api/documents` | TODO | **Remove** (Supabase direct) |
| `GET /api/documents/{id}` | TODO | **Remove** (Supabase direct) |
| `GET /api/extractions/{id}` | TODO | **Remove** (Supabase direct) |
| `GET /api/extractions/{id}/status` | TODO | **Remove** (Supabase Realtime) |
| `PUT /api/extractions/{id}` | TODO | **Remove** (Supabase direct) |
| `GET /api/usage/current` | TODO | **Remove** (Supabase direct) |
| **`POST /api/process`** | New | **Create** (full pipeline) |
| **`POST /api/re-extract`** | New | **Create** (cached OCR) |

**Final FastAPI surface:**
- `GET /health` - Health check
- `POST /api/process` - Upload + OCR + Extract + Save
- `POST /api/re-extract` - New extraction from cached OCR

### 2. Extraction Service

**Current (`services/extractor.py`):**
```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    model=settings.OPENROUTER_MODEL,
)
chain = prompt | llm.with_structured_output(ExtractedData, method="function_calling")
```

**After (Anthropic SDK with tool use):**
```python
from anthropic import Anthropic

client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    tools=[EXTRACTION_TOOL],
    tool_choice={"type": "tool", "name": "save_extracted_data"},
    messages=[{"role": "user", "content": prompt}]
)
```

**Why Anthropic SDK over LangChain:**
- Direct API = fewer dependencies, simpler debugging
- Tool use provides guaranteed structured output
- No OpenRouter middleman = direct Anthropic billing
- Easier to upgrade to newer Claude models

### 3. Dependencies

**Remove:**
```
langchain-openai==1.0.1
openai==2.6.1
```

**Add:**
```
anthropic>=0.40.0
```

**Keep:**
```
fastapi==0.120.2
uvicorn[standard]==0.38.0
pydantic==2.12.2
pydantic-settings==2.11.0
supabase==2.23.0
mistralai==1.9.11
python-dotenv==1.1.1
python-multipart==0.0.20
```

### 4. Environment Variables

**Remove:**
```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
```

**Add:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**Keep:**
```
SUPABASE_URL=...
SUPABASE_KEY=...
MISTRAL_API_KEY=...
APP_NAME=...
APP_VERSION=...
ENVIRONMENT=...
ALLOWED_ORIGINS=...
```

### 5. Frontend Data Access

**Before (through FastAPI):**
```typescript
// Fetch documents from backend API
const response = await fetch(`${API_URL}/api/documents`, {
  headers: { Authorization: `Bearer ${token}` }
})
const documents = await response.json()
```

**After (direct Supabase):**
```typescript
// Fetch documents directly from Supabase
const { data: documents } = await supabase
  .from('documents')
  .select('*, extractions(*)')
  .eq('user_id', userId)
  .order('uploaded_at', { ascending: false })
```

### 6. Status Updates

**Before (polling):**
```typescript
// Poll every 2 seconds
const interval = setInterval(async () => {
  const { status } = await fetch(`/api/extractions/${id}/status`)
  if (status === 'completed') clearInterval(interval)
}, 2000)
```

**After (Supabase Realtime):**
```typescript
// Subscribe to changes
supabase
  .channel('document-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'documents',
    filter: `id=eq.${documentId}`
  }, (payload) => {
    if (payload.new.status === 'completed') {
      // Document ready - fetch extraction
    }
  })
  .subscribe()
```

---

## Data Flow: New Architecture

### Upload + Process Flow

```
1. User selects file + mode in frontend
2. Frontend calls POST /api/process (FastAPI)
3. FastAPI:
   a. Checks usage limit
   b. Uploads file to Supabase Storage
   c. Creates document record (status='processing')
   d. Increments usage counter
   e. Returns document_id immediately
   f. Queues background task: process_document()
4. Background task:
   a. Creates signed URL for file
   b. Calls Mistral OCR API
   c. Saves OCR result to ocr_results table
   d. Calls Claude (Anthropic SDK) for extraction
   e. Saves extraction to extractions table
   f. Updates document status to 'completed'
5. Supabase Realtime triggers update event
6. Frontend receives event, fetches extraction from Supabase
```

### Re-extract Flow

```
1. User clicks "Re-extract" with new mode/fields
2. Frontend calls POST /api/re-extract (FastAPI)
3. FastAPI:
   a. Fetches cached OCR from ocr_results table
   b. Calls Claude with new mode/fields
   c. Saves new extraction to extractions table
   d. Returns extraction result
4. Frontend updates UI with new extraction
```

### Read Operations (No FastAPI)

```
# Documents list
supabase.from('documents').select('*').eq('user_id', userId)

# Single document with extractions
supabase.from('documents').select('*, extractions(*)').eq('id', docId).single()

# Latest extraction for document
supabase.from('extractions')
  .select('*')
  .eq('document_id', docId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

# User usage stats
supabase.from('users').select('documents_processed_this_month, documents_limit').eq('id', userId).single()
```

### Edit Operations (No FastAPI)

```
# Update extraction fields
supabase.from('extractions')
  .update({ extracted_fields: newFields, updated_at: new Date() })
  .eq('id', extractionId)
```

---

## Files to Modify

### Backend Files

| File | Action | Description |
|------|--------|-------------|
| `requirements.txt` | Modify | Remove langchain, add anthropic |
| `app/config.py` | Modify | Replace OPENROUTER vars with ANTHROPIC_API_KEY |
| `app/services/extractor.py` | **Rewrite** | Replace LangChain with Anthropic SDK |
| `app/routes/documents.py` | Modify | Merge into new process.py |
| `app/routes/extractions.py` | **Delete** | Remove test endpoints |
| `app/routes/ocr.py` | **Delete** | Merge into process.py |
| `app/routes/usage.py` | **Delete** | Frontend uses Supabase direct |
| **`app/routes/process.py`** | **Create** | New consolidated AI endpoints |
| `app/main.py` | Modify | Update router registrations |
| `.env.example` | Modify | Update env var template |

### Planning Files

| File | Action | Description |
|------|--------|-------------|
| `CLAUDE.md` | Update | Reflect new architecture |
| `planning/ARCHITECTURE.md` | Update | Document hybrid architecture |
| `planning/TASKS.md` | Update | Mark old tasks complete, add new section |

### Frontend Files (When Built)

| File | Action | Description |
|------|--------|-------------|
| `lib/supabase.ts` | Create | Supabase client setup |
| `hooks/useDocuments.ts` | Create | Direct Supabase data fetching |
| `hooks/useRealtime.ts` | Create | Supabase Realtime subscriptions |
| `lib/api.ts` | Simplify | Only process + re-extract calls |

---

## Authentication Strategy

**Keep Supabase Auth** (no migration to Clerk):
- Everything stays contained in Supabase ecosystem
- Auth is already configured and working
- RLS policies already use `auth.uid()`
- Less migration complexity

**Frontend auth flow:**
```typescript
// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Get session for API calls
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token

// Call FastAPI with token
fetch('/api/process', {
  headers: { Authorization: `Bearer ${token}` }
})
```

**FastAPI auth middleware:**
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def get_current_user(credentials: HTTPCredentials = Depends(security)):
    # Verify JWT with Supabase
    # Extract user_id from token
    # Return user_id
```

---

## Migration Risks & Mitigations

### Risk 1: Anthropic SDK Structured Output Different from LangChain

**Risk**: Tool use response format differs from LangChain's `with_structured_output()`

**Mitigation**: Create test spike first to validate extraction works before full migration

### Risk 2: Breaking Existing Test Data

**Risk**: Changing extractor may produce different field names/structures

**Mitigation**:
- Keep same prompt structure
- Test with existing documents
- Compare output before/after

### Risk 3: Supabase Realtime Complexity

**Risk**: Realtime subscriptions may have edge cases (reconnection, missed events)

**Mitigation**:
- Add fallback polling for initial implementation
- Test reconnection scenarios
- Use Supabase's built-in retry logic

---

## Success Criteria

**Migration is complete when:**

1. [ ] FastAPI has only 3 endpoints: `/health`, `/api/process`, `/api/re-extract`
2. [ ] LangChain removed from dependencies
3. [ ] Anthropic SDK extraction works for auto + custom modes
4. [ ] Existing documents can still be re-extracted
5. [ ] New documents process end-to-end (upload → OCR → extract → save)
6. [ ] Document status updates to 'completed' after processing

**Frontend (future) is complete when:**

1. [ ] Documents load directly from Supabase
2. [ ] Extractions load directly from Supabase
3. [ ] Status updates via Supabase Realtime
4. [ ] Edit saves directly to Supabase

---

## Related Documents

- **Migration Tasks**: `planning/MIGRATION-TASKS.md` - Step-by-step implementation tasks
- **Current Tasks**: `planning/TASKS.md` - Original MVP task list
- **Agent Architecture**: `planning/AGENT-NATIVE-ARCHITECTURE.md` - Strategic vision
- **Database Schema**: `planning/SCHEMA.md` - Table definitions

---

**Compiled by**: Claude Code
**Last Updated**: 2025-12-16
**Next Step**: Follow tasks in `MIGRATION-TASKS.md`
