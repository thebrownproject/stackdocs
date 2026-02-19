# Backend CLAUDE.md

## Quick Facts

- **Framework**: FastAPI (Python 3.11+)
- **AI**: Claude Agent SDK with custom tools
- **OCR**: Mistral OCR API (`mistral-ocr-latest`)
- **Database**: Supabase PostgreSQL (service role key)
- **Auth**: Clerk JWT verification
- **Deployment**: DigitalOcean Droplet → Caddy → Docker

## Directory Structure

```
backend/
├── app/
│   ├── main.py                   # FastAPI app entry point
│   ├── auth.py                   # Clerk JWT verification
│   ├── config.py                 # Environment config
│   ├── database.py               # Supabase client setup
│   ├── models.py                 # Pydantic models
│   ├── routes/                   # See routes/CLAUDE.md for endpoints
│   ├── services/                 # See services/CLAUDE.md for details
│   └── agents/                   # See agents/CLAUDE.md for tools & patterns
│       ├── extraction_agent/     # Single document extraction
│       └── stack_agent/          # Multi-document batch extraction
├── migrations/                   # SQL migration files
└── tests/                        # Test files
```

## Agents

Built with Claude Agent SDK. Agents operate autonomously with scoped database tools.

- **extraction_agent** - Single document extraction → `extractions` table
- **stack_agent** - Multi-document batch extraction → `stack_tables` / `stack_table_rows`

See `app/agents/CLAUDE.md` for tools, data flow, and security patterns.

## API Endpoints

| Route File | Endpoints |
|------------|-----------|
| `document.py` | `/api/document/upload`, `/api/document/retry-ocr`, `/api/document/metadata` |
| `agent.py` | `/api/agent/extract`, `/api/agent/correct`, `/api/agent/health` |
| `test.py` | `/api/test/claude`, `/api/test/mistral` |

## Document Processing Flow

```
Upload (instant return)
     |
     v
BackgroundTask: OCR processing
     | - Updates status: 'uploading' -> 'processing' -> 'ocr_complete'
     | - On failure: status -> 'failed'
     |
     v on success (direct await, not BackgroundTasks chaining)
Metadata generation (fire-and-forget)
     | - Writes display_name, tags, summary to documents table
     | - Failures logged but don't affect OCR status
```

- **Frontend tracking:** Supabase Realtime subscription on `documents` table
- **Manual regenerate:** `POST /api/document/metadata` (SSE stream)
- **Retry failed OCR:** `POST /api/document/retry-ocr`

See `app/routes/CLAUDE.md` for auth, SSE streaming, and patterns.

## Environment Variables

```
# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_service_role_key  # Use service role key (not anon)

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_xxx
CLERK_AUTHORIZED_PARTIES=http://localhost:3000,https://www.stackdocs.io

# AI Services
ANTHROPIC_API_KEY=sk-ant-xxx
CLAUDE_MODEL=claude-haiku-4-5  # or claude-sonnet-4-20250514
MISTRAL_API_KEY=your_mistral_api_key

# Application
ENVIRONMENT=development  # development | staging | production
DEBUG=True  # True: Swagger testing without JWT, False: Full JWT validation

# CORS
ALLOWED_ORIGINS=http://localhost:3000
```

## Deployment

- **URL**: `api.stackdocs.io`
- **Host**: DigitalOcean Droplet (2GB, Sydney)
- **Proxy**: Caddy (auto HTTPS)
- **CI/CD**: GitHub Actions on push to `main` when `backend/**` changes

```bash
docker logs stackdocs-api -f    # View logs
docker restart stackdocs-api    # Restart
docker ps | grep stackdocs      # Check status
```
