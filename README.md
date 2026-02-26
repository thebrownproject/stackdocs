# StackDocs

![Status](https://img.shields.io/badge/status-in_development-yellow)
![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![Claude Agent SDK](https://img.shields.io/badge/Claude_Agent_SDK-D97757?logo=anthropic&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![DigitalOcean](https://img.shields.io/badge/DigitalOcean-0080FF?logo=digitalocean&logoColor=white)

> AI-powered document extraction platform. Upload documents, extract structured data with autonomous agents, and organise results into stacks. Built with Claude Agent SDK.

## Overview

StackDocs automates manual data entry from business documents. Upload invoices, receipts, or contracts and an autonomous agent extracts structured data with confidence scores, then lets you correct results through natural language in the same session.

Documents can be grouped into **stacks** for batch extraction across multiple files into unified tables, with a canvas workspace for visual organisation.

**Live at** [stackdocs.io](https://stackdocs.io) | **API** at [api.stackdocs.io](https://api.stackdocs.io)

## Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   Next.js 16    │────▶│   FastAPI Backend    │────▶│  Supabase    │
│   (Vercel)      │     │   (DigitalOcean)     │     │  (Postgres)  │
│                 │     │                      │     │  + Storage   │
│  Clerk Auth     │     │  Claude Agent SDK    │     │  + Realtime  │
│  React Flow     │     │  Mistral OCR         │     │  + RLS       │
│  Zustand        │     │  Custom Agent Tools  │     └──────────────┘
│  shadcn/ui      │     │  SSE Streaming       │
└─────────────────┘     └─────────────────────┘
```

**Frontend** talks directly to Supabase for reads/writes (protected by RLS). AI operations (upload, OCR, extraction, correction) route through the FastAPI backend, which runs Claude agents with scoped database tools.

## Tech Stack

**Frontend:** Next.js 16 (App Router) · TypeScript · TailwindCSS v4 · React Flow · Zustand · shadcn/ui · TanStack Table · Motion

**Backend:** Python 3.11 · FastAPI · Claude Agent SDK · Mistral OCR · SSE Streaming

**Infrastructure:** Supabase (PostgreSQL + Storage + Realtime + RLS) · Clerk (Auth) · DigitalOcean (Backend) · Docker · GitHub Actions CI/CD · Caddy (Reverse Proxy)

## Features

### Agent System (Claude Agent SDK)

- Autonomous extraction agent with 6 custom tools built on the Agent SDK (read_ocr, save_extraction, set_field, delete_field, read_extraction, complete)
- Tool factory pattern locks database access to the requesting user and document so agents cannot override tenant boundaries
- Session-based corrections: resume a previous extraction conversation and refine results with natural language
- Auto mode (agent decides fields) and Custom mode (user specifies fields to extract)
- Confidence scores per field (0.0–1.0) for review
- SSE streaming of agent reasoning and tool calls to the frontend in real time

### Document Processing

- Upload with validation (PDF, JPEG, PNG, WebP, max 10MB)
- Mistral OCR integration with HTML table extraction (98.96% accuracy, 5–10s per document)
- OCR result caching allows re-extraction with different modes without re-OCRing
- Background metadata generation (display name, tags, summary) via a second agent
- Supabase Realtime subscriptions for live upload status tracking

### Stacks (Multi-Document Extraction)

- Group related documents into stacks (e.g. "Vendor Invoices")
- Define extraction tables with custom column schemas
- Batch extract across all documents in a stack into unified table rows
- Stack agent with 13 custom tools for table/row management

### Frontend

- Floating agent card with spring animations (iOS-style expand/collapse)
- 8 registered flows: upload, extract, create stack, edit stack, add documents, create table, manage columns, extract table
- Dual-panel layout with resizable PDF/OCR preview
- React Flow canvas for visual stack organisation
- TanStack Table with sorting, filtering, and confidence indicators
- Parallel routes for header/subbar composition (Next.js 16 pattern)
- CSV/JSON export

### Infrastructure

- Dockerised backend with multi-stage builds
- GitHub Actions CI/CD: auto-deploy to DigitalOcean on push to `main`
- Caddy reverse proxy with automatic HTTPS
- Clerk JWT verification + Supabase Row-Level Security for multi-tenancy
- Clerk webhook syncs user profiles to Supabase

## How It Works

```
Upload → Mistral OCR (cached) → Claude Agent extracts fields → SSE stream to UI
                                                                      │
                                          User corrects via chat ◀────┘
                                          (same session resumes)
```

1. **Upload**: file goes to Supabase Storage, OCR runs in background via Mistral
2. **Extract**: Claude agent reads OCR text, analyses document, saves structured fields with confidence scores
3. **Correct**: user sends natural language instruction, agent resumes the same session and updates specific fields
4. **Stack**: group documents, define table schema, batch-extract into rows

## Quick Start

```bash
# Backend
cd backend
cp .env.example .env  # fill in keys
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
cp .env.local.example .env.local  # fill in keys
npm install && npm run dev
```

### Environment Variables

**Backend:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-xxx
CLAUDE_MODEL=claude-haiku-4-5
MISTRAL_API_KEY=your-key
CLERK_SECRET_KEY=sk_test_xxx
```

**Frontend:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_API_URL=https://api.stackdocs.io
```
