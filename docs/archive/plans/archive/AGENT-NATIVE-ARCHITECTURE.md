# Agent-Native Stackdocs Architecture: Strategic Synthesis

**Date Compiled**: 2025-12-16
**Source**: Synthesized from Second Brain notes (Nov-Dec 2025)
**Purpose**: Re-planning Stackdocs with agent-native core architecture

---

## Executive Summary

Stackdocs has evolved from a simple PDF→CSV tool to an **agent-native platform** leveraging the Claude Agent SDK paradigm. This document synthesizes strategic insights and establishes the architectural foundation for Stackdocs v2+ development.

**Core Pivot**: From traditional SaaS to **Claude Agent SDK platform** with hybrid architecture: Next.js + Supabase (realtime frontend) ↔ FastAPI + Agent SDK (intelligent processing) ↔ Supabase PostgreSQL (data storage).

**Strategic Context**: Agent-native architecture positions Stackdocs as infrastructure that turns Dark Data (80% of enterprise information in PDFs) into structured database rows using intelligent agents and reusable skills.

---

## Part I: Strategic Evolution (Nov-Dec 2025)

### Stage 1: Platform Vision (2025-11-19)
**Note**: `2025-11-19_idea_stackdocs-v2-airtable-for-documents.md`

**Key Insight**: Pivot from one-off extractions to persistent data platforms
- Users create "Stacks" (schemas) once, drag 50 documents, watch table populate
- Grid editing interface with confidence scores
- Progressive automation: CSV → Webhook → Direct ERP integration
- **Positioning**: "Airtable for Documents" - replace Excel workflows entirely

**Technical Innovation**: Dynamic Pydantic models generated from user JSONB schemas
- User defines Stack schema → System generates Pydantic model → LLM extracts → Data stored in extracted_data JSONB
- Enables flexible schema per document type without migrations

### Stage 2: Digital Oil Refinery Thesis (2025-11-23)
**Note**: `2025-11-23_reflection_digital-oil-refinery-thesis.md`

**Cornerstone Insight**: Data structuring creates fortunes
- **Oracle** (Larry Ellison): Structured business transactions
- **Google** (Larry Page): Structured the web
- **Salesforce** (Marc Benioff): Structured customer interactions
- **Stackdocs** (2026): Structure Dark Data (80% of enterprise information locked in PDFs)

**Value Proposition Reframe**:
- **NOT**: "Chat with PDFs" (RAG - low value, nice to have)
- **IS**: "Turn PDFs into database rows" (Extraction - high value, need to have)

**Business Reality**:
- Data entry IS the transaction bottleneck in B2B services
- Construction: Can't get paid until docket is entered
- Medical: Can't see specialist until referral is entered
- Logistics: Container can't leave port until manifest is entered
- **By solving extraction, you unblock money/service**

### Stage 3: Agent-Native Pivot (2025-12-14)
**Note**: `2025-12-14_reflection_agent-native-stackdocs-architecture-pivot.md`

**Paradigm Shift**: "Models = Processes, Agents = OS, Skills = Applications"

**Hybrid Architecture**:
```
Next.js + Supabase Client (direct database access)
    ↕
FastAPI + Claude Agent SDK (AI processing only)
    ↕
Supabase PostgreSQL (data storage)
```

**Why This Works**:
- **Frontend**: Direct Supabase queries for data operations (no API roundtrips)
- **Backend**: Only AI processing - Mistral OCR, Claude extraction, background tasks
- **Agent SDK**: Reasoning, context understanding, structured outputs
- **Skills System**: Encoded domain expertise (construction, legal, engineering)

---

## Part II: Hybrid Architecture Deep Dive

### System Architecture

**Frontend (Next.js + Supabase Client)**:
- Direct database operations (no FastAPI roundtrips)
- Document uploads → Supabase Storage
- Reading extractions → Supabase PostgreSQL
- Document library → Supabase queries
- Real-time updates → Supabase Realtime
- Non-blocking file uploads with progress tracking

**Backend (FastAPI + Claude Agent SDK)**:
- ONLY for AI processing tasks
- Mistral OCR integration
- Claude Agent SDK structured extraction
- Usage limit enforcement
- Background AI task processing

**Data Flow**:
```
User Action → Frontend (Next.js)
    ↓
Direct Supabase Query (data operations)
    ↓
Trigger AI Task → FastAPI (AI processing only)
    ↓
Claude Agent SDK → OCR → Extraction → Quality Checks
    ↓
Save to Supabase → Realtime Update → Frontend UI
```

### Claude Agent SDK Capabilities

**1. Structured Outputs**:
- Guaranteed valid JSON matching Pydantic schemas
- No manual parsing or validation required
- Type-safe access to all fields
- Dynamic schema generation for custom fields
- Automatic error handling for malformed outputs

**2. Quality Control System**:
- **PreToolUse Hooks**: Budget checking, permission validation, cost control
- **PostToolUse Hooks**: Result validation, confidence checking, error detection
- **Automatic Retry**: Exponential backoff for failed extractions
- **Session Management**: Persistent conversations for refinement workflows

**3. Security & Isolation**:
- **Tool Permissions**: Fine-grained control over agent capabilities
- **MCP Servers**: Isolated execution environment for tools
- **User Isolation**: Supabase RLS enforces data access at database level
- **Cost Management**: Per-operation budget controls with automatic cancellation

**4. Performance & Concurrency**:
- **Semaphore Control**: Limit concurrent operations
- **Batch Processing**: Process multiple documents with controlled parallelism
- **Background Tasks**: Non-blocking extraction workflows
- **Real-time Monitoring**: Track extraction progress as it happens

**5. Production Features**:
- **Rich Error Types**: Specific error classes (CLINotFoundError, ProcessError, etc.)
- **Metadata Tracking**: Session IDs, cost tracking, performance metrics
- **Graceful Degradation**: Handle partial failures, low confidence results
- **Developer Experience**: Pythonic async patterns, extensive customization

### Skills as Competitive Moat

**Technical Strategy**: Each skill built becomes harder to replicate
- `construction-drawings-skill`: 10 years architectural experience encoded
- `legal-contract-skill`: Contract analysis patterns
- `engineering-specs-skill`: Technical document understanding

**Business Model Transformation**:
- **Traditional Document Tools**: $50/user/month (static extraction rules)
- **Agent-Native Platform**: $500/agent/month (dynamic, contextual, learns over time)

**Skills Marketplace Potential**:
- Customers create/shares workflows
- Internal skill libraries for large organizations
- Revenue share with skill creators

---

## Part III: Security Architecture - Clerk + Supabase RLS

### Authentication Layer

**Clerk Authentication**:
- Handles all user authentication, organization management, session security
- Implementation takes 5-15 minutes with pre-built components
- Enterprise features: MFA, SAML, custom roles out of the box

**Supabase RLS (Row Level Security)**:
- Enforces data isolation at database level
- Every query automatically scoped to authenticated user's data
- JWT claims from Clerk control access

### RLS Implementation

```sql
-- Documents table with user ownership
create table documents (
  id UUID default gen_random_uuid() primary key,
  user_id text not null,  -- Clerk user ID from JWT
  filename text not null,
  status text,
  created_at timestamptz default now()
);

-- RLS policies ensuring users only access their own data
create policy "Users can manage their own documents"
on documents for all
using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
```

### Hybrid System Security Flow

1. **Clerk JWT** → Contains user ID (`sub` claim) and role claims
2. **Supabase RLS** → Extracts Clerk user ID from JWT and enforces access
3. **Agent Processing** → Agents only process documents user has access to
4. **Data Export** → Results inherit document permissions automatically

**Result**: Enterprise-grade security where even if agents/APIs compromised, users cannot access other customers' data due to database-level RLS enforcement.

### Why This Architecture Wins

**Speed**: Clerk implementation in 15 minutes vs Supabase Auth in 2+ hours
**Security**: Database-level RLS enforcement impossible to bypass in application code
**Scalability**: Automatic multi-tenancy with zero application logic
**Enterprise Ready**: Built-in organization management, SSO, role-based access
**B2B Pricing Model**: $500/agent/month justified by sophisticated security

---

## Part IV: Career Transition Alignment

### Target Roles Reimagined (from 2025-11-19 roadmap)

**Before**:
- Backend Engineer → Agent Infrastructure Engineer
- AI Solutions Engineer → This IS the role
- Platform Engineer → Agent platforms are the new platform layer

**Unique Positioning**:
- Architectural draftsman background = domain expertise
- Understanding of complex documents (building plans, compliance docs)
- Knowledge of workflow automation (construction processes)
- Professional maturity (33, 10 years experience) → skip junior phase

### 2026 Execution Plan

**Q1 (Jan-Mar 2026)**:
- AWS Solutions Architect certification
- Stackdocs v1 with agent-native core
- Clerk+RLS security implementation
- 3-5 foundational skills (construction, legal, engineering)

**Q2 (Apr-Jun 2026)**:
- Decision point: Startup route vs Job hunt
- If startup: Generation AI + LaunchVic + traction signals
- If job: AI platform team roles + interviews + $90k-$110k offers

### Interview Narrative (Q2 2026)

> "I built Stackdocs - infrastructure for converting Dark Data into structured database rows. 80% of enterprise data is locked in PDFs. I built a flexible schema engine that lets businesses define their own extraction templates using dynamic Pydantic models generated from user input.
>
> I pivoted to agent-native architecture using the Claude Agent SDK - think of it as an operating system where skills are applications. Each skill encodes domain expertise: construction drawings, legal contracts, engineering specs. My background in architecture means I understand why this data matters and where the transaction bottlenecks are.
>
> The system uses Clerk authentication with Supabase Row Level Security for enterprise-grade data isolation. I'm building cutting-edge agent infrastructure that turns unstructured documents into database rows - the Digital Oil Refinery for enterprise data."

**Why This Lands**:
- Systems thinking (Dark Data → Structured Data pipeline)
- Product vision (Horizontal engine → Vertical use cases)
- Technical execution (Dynamic schemas, agent-native architecture)
- Domain expertise (Construction industry insight)
- Business acumen (Transaction bottleneck analysis)
- Modern AI engineering (Claude Agent SDK, structured outputs)

---

## Part V: Implementation Framework

### Immediate Next Steps (December 2025)

1. **Implement Clerk authentication** with Next.js 15 (5-15 minutes setup)
2. **Configure Supabase RLS policies** for secure multi-tenancy
3. **Create document upload** UI and API endpoints
4. **Prototype agent-based document processing** with Mistral OCR integration

### Q1 2026 Build Plan

**Week 1-2: Foundation**
- Clerk + Supabase RLS security layer
- Document upload/processing API
- Basic extraction pipeline

**Week 3-4: Agent Integration**
- Claude Agent SDK integration
- Skills system architecture
- First 2-3 skills (construction, legal, generic)

**Week 5-6: Frontend**
- Next.js 15 application
- Document library with grid view
- Confidence score indicators

**Week 7-8: Polish & Deploy**
- CSV/JSON export
- Webhook integration
- Production deployment (Railway/Vercel)

### Technical Architecture Details

**Backend**:
- **FastAPI** (API gateway, authentication middleware)
- **Supabase** (PostgreSQL + Storage + Auth via Clerk integration)
- **Mistral OCR** (PDF → Markdown text extraction)
- **Claude Agent SDK** (reasoning + skills orchestration)

**Frontend**:
- **Next.js 15** (React Server Components)
- **Clerk** (authentication components)
- **TailwindCSS** (UI styling)
- **TanStack Table** (grid view for document library)

**Database Schema**:
```sql
-- Users via Clerk (JWT-based auth)
-- Stacks (user-defined schemas)
-- Documents (uploaded files + metadata)
-- extractions (structured results + confidence scores)
-- ocr_results (cached raw text for re-extraction)
```

### Skills System Structure

**Directory Structure**:
```
skills/
  construction-drawings/
    SKILL.md (metadata, usage instructions)
    references/ (domain knowledge)
    scripts/ (extraction logic)
    assets/ (templates, examples)

  legal-contracts/
    SKILL.md
    references/
    scripts/
    assets/

  engineering-specs/
    SKILL.md
    references/
    scripts/
    assets/
```

**Progressive Disclosure**:
1. Load SKILL.md metadata (what this skill does)
2. If user selects skill, load references
3. Only load scripts/assets when processing document of that type

---

## Part VI: Competitive Analysis

### vs. Traditional OCR Tools (Adobe, ABBYY)

**They Give**: Text (you still need to structure it)
**Stackdocs Gives**: Structured data directly
**Advantage**: No human post-processing required

### vs. Invoice-Specific Tools (Dext, Receipt Bank)

**They're Rigid**: Invoices only, predefined fields
**Stackdocs Is Flexible**: Any document type, user-defined schema
**Advantage**: Long tail use cases Big Tech ignores

### vs. RAG Chatbots

**RAG Value**: Low (nice to have, saves reading time)
**Extraction Value**: High (need to have, replaces human employee)
**Advantage**: "Unblocks transactions" vs "answers questions"

### vs. Airtable + Manual Entry

**Airtable Requires**: Typing data row by row
**Stackdocs Auto-populates**: From documents
**Advantage**: 10x faster data entry

### Unique Positioning

**"Universal Data Extraction Engine with Custom Schemas"**
- Not competing on extraction accuracy (commoditized)
- Winning on flexible schemas + domain expertise
- Long tail industries (construction, medical, legal, logistics)
- Big Tech ignores these because too specific

---

## Part VII: Market Opportunity & Competitive Analysis

### Dark Data Market Opportunity

**The Problem**: 80% of enterprise data is unstructured (PDFs, images, emails) - "Dark Data"
**The Solution**: Stackdocs as "Digital Oil Refinery" - turns crude unstructured data into structured database rows
**The Value**: Businesses pay to unblock transactions, not for convenience

### Long Tail Strategy

**What Big Tech Will Solve**:
- Standard invoices (Xero)
- Generic receipts (Google)

**What Big Tech Will Ignore** (Stackdocs territory):
- Construction dockets, medical referrals, legal discovery
- **Win by being flexible, not accurate**

**Competitive Positioning**:
- **NOT**: "Chat with PDFs" (RAG - low value, nice to have)
- **IS**: "Turn PDFs into database rows" (Extraction - high value, need to have)

### Industries & Use Cases

**Construction**:
- Concrete dockets, site safety checklists, induction forms
- **Pain Point**: Can't get paid until docket is entered

**Medical**:
- Patient referral letters, specialist reports
- **Pain Point**: Can't see specialist until referral is entered

**Legal**:
- Discovery documents, police reports
- **Pain Point**: Manual review delays case progress

**Logistics**:
- Bills of lading, customs declarations
- **Pain Point**: Container can't leave port until manifest is entered

**Why Stackdocs Wins**: Flexible schema engine lets users define their own extraction templates for any document type. Big Tech can't handle the long tail because too specific.

### Market Sizing

**Total Addressable Market (TAM)**:
- Enterprise document processing: $200M+ globally
- Dark data extraction: $500M+ (growing 25% annually)
- **Strategy**: Start with long tail industries, expand horizontally

---

## Part VIII: Key Insights & Principles

### 1. Infrastructure vs Application Layer

**Infrastructure** (Stackdocs position):
- Harder to disrupt (high switching costs)
- Commands B2B pricing (not consumer SaaS margins)
- Gets B2B pricing and enterprise investment priority
- **This is the defensible position**

### 2. Dark Data = Digital Oil

**Economic Parallel**:
- Crude oil (unstructured data) → Refinery (Stackdocs) → Petrol (structured data)
- Value created in refinement, not extraction
- Stackdocs is the refinery, not the oil well

### 3. Transaction Bottleneck Economics

**B2B Reality**:
- Data entry = payment delay = cash flow problem
- Stackdocs solves cash flow, not convenience
- **This is why businesses pay premium**

### 4. Long Tail Strategy

**Big Tech Will Solve**:
- Standard invoices (Xero)
- Generic receipts (Google)

**Big Tech Will Ignore** (Stackdocs territory):
- Construction dockets, medical referrals, legal discovery
- **Win by being flexible, not accurate**

### 5. Agent-Native Timing

**Paradigm Window**:
- Caught transition from agent experimentation → production infrastructure
- First-mover advantage: establish as "agent-native document platform"
- Build while regulation light ("opportunity first" approach)

---

## Part IX: Success Metrics

### Product-Market Fit Indicators

**Usage Signals**:
- Users create 3+ Stacks (building workflows, not testing)
- Average 20+ documents per Stack (real usage, not toy data)
- 30%+ enable webhook sync (want automation)

**Business Metrics**:
- 10 paying customers at $500/agent/month = $5,000 MRR
- $3,000/month profit after API costs
- 60%+ conversion from free trial to paid

### Career Metrics (Primary for 2026)

**Portfolio**:
- Can demo live during interviews
- Can explain architecture decisions confidently
- Can show real user feedback/testimonials
- Demonstrates "builder" credibility

**Interview Impact**:
- Technical depth (dynamic schemas, agent-native architecture)
- Business acumen (dark data, transaction bottlenecks)
- Domain expertise (construction industry insight)
- Modern AI engineering (Claude Agent SDK, structured outputs)

---

## Part X: Risks & Mitigation

### 1. Big Tech Competition

**Risk**: Microsoft/AWS bundle document extraction with their platforms
**Mitigation**: Domain-specific requirements (construction, medical, legal expertise). Generic OCR ≠ specialized document extraction. Flexible schema engine vs rigid templates.

### 2. API Cost Escalation

**Risk**: Mistral OCR or Claude API costs increase, making processing unprofitable
**Mitigation**: Multi-provider strategy (OpenAI, Google, Anthropic). Caching OCR results. Usage-based pricing passes costs to customers.

### 3. Solo Founder Burnout

**Risk**: Stackdocs complex (document + AI + compliance). Building solo while studying + working.
**Mitigation**: Q2 decision point (reassess Apr-Jun). Job hunt backup prepared. "If not fun by Q2, get job + build on side."

### 4. Scope Creep

**Risk**: Keep adding features, never ship
**Mitigation**: Define v1.0 clearly. Ship → get users → iterate. Don't build v2 before v1 deployed.

---

## Part XI: Action Items

### This Week (Dec 16-20, 2025)

1. **Read through all source notes** in Second Brain (notes/)
2. **Review existing Stackdocs codebase** (backend/, frontend/, planning/)
3. **Identify gaps** between current state and agent-native architecture
4. **Prioritize migration tasks** (auth → Clerk, LLM → Claude SDK, etc.)

### Next Session (Dec 17-20)

1. **Re-plan project scope** with agent-native core
2. **Update TASKS.md** with new architecture requirements
3. **Create technical spike** for Clerk + RLS integration
4. **Research Claude Agent SDK** implementation patterns

### January 2026 (Post-Adelaide)

1. **Week 1**: Authentication migration (Supabase Auth → Clerk)
2. **Week 2**: Database schema updates (Stacks, agent context)
3. **Week 3**: Claude Agent SDK integration
4. **Week 4**: First skill development (construction drawings)

---

## Part XII: Key Quotes for Reference

> "You are building a Digital Oil Refinery. You take 'Crude Oil' (messy PDFs) and turn it into 'Petrol' (Structured SQL/JSON) that powers the business engine."

> "Businesses do not want to 'chat' with their data. They want their data to do work."

> "80% of enterprise data is Unstructured. This is called 'Dark Data.' It is currently invisible to analytics and automation software."

> "In B2B services, Data Entry IS the transaction bottleneck. By solving the extraction, you unblock the money/service."

> "Stackdocs wins because you offer a Flexible Schema. You let the user define the mess, and you let the AI clean it up."

> "I will build the interface that allows companies to treat their Dark Data (PDFs) exactly like their Structured Data (Database)."

> "Paradigm shift: Models = Processes, Agents = OS, Skills = Applications"

> "Skills are competitive moats. Each skill built becomes harder to replicate."

> "80% of enterprise data is Dark Data - Stackdocs is the Digital Oil Refinery that turns it into structured fuel."

> "Stackdocs is infrastructure, not a feature - we refine crude oil (PDFs) into petrol (database rows)."

---

## Sources

### Second Brain Notes
1. `2025-11-19_idea_stackdocs-v2-airtable-for-documents.md` - Platform vision
2. `2025-11-23_reflection_digital-oil-refinery-thesis.md` - Business thesis
3. `2025-11-19_reflection_2026-career-transition-roadmap.md` - Career strategy
4. `2025-12-03_learning_national-ai-plan-leverage-strategy-stackdocs-govai.md` - Government alignment
5. `2025-12-14_reflection_agent-native-stackdocs-architecture-pivot.md` - Agent-native architecture

### Stackdocs Codebase
- `/Users/fraserbrown/stackdocs/README.md` - Current project status
- `/Users/fraserbrown/stackdocs/CLAUDE.md` - Implementation guidance
- `/Users/fraserbrown/stackdocs/planning/ARCHITECTURE.md` - Technical architecture
- `/Users/fraserbrown/stackdocs/planning/PRD.md` - Product requirements
- `/Users/fraserbrown/stackdocs/planning/TASKS.md` - Development tasks

---

**Compiled by**: Claude Code
**Last Updated**: 2025-12-16
**Next Review**: After re-planning session (Dec 17-20, 2025)