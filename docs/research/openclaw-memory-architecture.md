# OpenClaw Memory Architecture — Research Notes

> Researched 2026-02-08, Session 133. Sources: binds.ch systems analysis, Milvus engineering blog, Medium AIMonks deep dive, mem0 integration post, Leonis newsletter.

## The Core Mental Model

> "Treat the LLM context as a cache and treat disk memory as the source of truth. Then add a compactor to keep the cache bounded and a retriever to page state back in. **It is virtual memory for cognition.**"
> — binds.ch/blog/openclaw-systems-analysis

- Context window = RAM (fast, limited)
- Disk files (md, JSONL) = hard drive (source of truth, large, slow)
- Compaction = garbage collection / memory paging
- Retrieval = page fault handler (bring relevant info back into context)

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  CONTEXT WINDOW (RAM — limited)         │
│                                         │
│  soul.md         — agent identity       │
│  user.md         — user preferences     │
│  MEMORY.md       — accumulated facts    │
│  Recent journals — daily summaries      │
│  ────────────────────────────           │
│  Cold start: ~2,000-3,000 tokens        │
│  + conversation turns grow here         │
│                                         │
│  When nearing limit → FLUSH → FRESH     │
└──────────────┬──────────────────────────┘
               │ pre-compaction flush
               ▼
┌─────────────────────────────────────────┐
│  DISK (source of truth — unlimited)     │
│                                         │
│  soul.md       — identity, never lost   │
│  user.md       — preferences, curated   │
│  MEMORY.md     — key facts, evolves     │
│  journals/     — daily summaries        │
│  transcripts/  — raw JSONL audit logs   │
└─────────────────────────────────────────┘
```

## Two-Tier Memory System

### Tier 1: Curated Markdown Files (loaded into context)

| File | Purpose | Updated by | Size target |
|------|---------|------------|-------------|
| `soul.md` | Agent identity, core instructions, extraction rules | Developer/agent | ~500 tokens |
| `user.md` | User preferences, habits, communication style | Agent (via tool) | ~200 tokens |
| `MEMORY.md` | Accumulated facts, learnings, key decisions | Agent (via tool) | ~1,000 tokens |
| Daily journals | Session summaries, what happened today | Agent (via flush) | ~500 tokens/day |

These files are human-readable, editable, and inspectable. The agent reads them at session start to reconstruct who it is, who the user is, and what's been happening.

### Tier 2: Raw JSONL Transcripts (never loaded into context)

Append-only audit log of everything that happened. Used for:
- Search and retrieval (future FTS5 or vector search)
- Export and debugging
- Raw material for summarization
- Compliance and audit trail

Example transcript entries:
```jsonl
{"timestamp":"2026-02-08T12:15:00","session_id":"sess_abc","event_type":"user_message","text":"Extract data from this invoice"}
{"timestamp":"2026-02-08T12:15:05","session_id":"sess_abc","event_type":"tool_call","tool":"create_card","args":{"title":"Invoice #1234"}}
{"timestamp":"2026-02-08T12:15:06","session_id":"sess_abc","event_type":"tool_result","tool":"create_card","result":"success"}
{"timestamp":"2026-02-08T12:15:08","session_id":"sess_abc","event_type":"agent_response","text":"I've created a card showing the extracted invoice data..."}
{"timestamp":"2026-02-08T12:16:00","session_id":"sess_abc","event_type":"user_message","text":"Actually I prefer dates in DD/MM/YYYY"}
{"timestamp":"2026-02-08T12:16:02","session_id":"sess_abc","event_type":"tool_call","tool":"update_user_prefs","args":{"content":"Date format: DD/MM/YYYY"}}
{"timestamp":"2026-02-08T12:16:03","session_id":"sess_abc","event_type":"agent_response","text":"Got it, I'll use DD/MM/YYYY from now on."}
```

## Pre-Compaction Flush (Critical Mechanism)

The most important design pattern in OpenClaw's memory system. From the Medium deep dive:

> "Before compacting away detail, you run a 'write durable notes now' step. That is not merely performance; it prevents forgetting. If you lose information before persisting it, that information is gone forever."

### How it works

1. Context window is getting full (or session is ending)
2. Before starting a new context: **agent writes important facts to disk**
3. Agent calls its own memory tools:
   - `append_journal("Processed 12 invoices from Acme Corp, total $48,000 AUD...")`
   - `update_memory("Acme Corp invoices typically have 4-6 line items")`
   - `update_user_prefs("User wants invoices over $5k flagged in red")`
4. New session starts, loads curated files — context is light but informed

### Why the agent writes the summary (not the system)

The agent is the only entity that knows what mattered. A system-level summary would capture everything equally. The agent knows:
- Which facts the user cared about
- What preferences were expressed
- What tasks were completed vs still pending
- What it learned that's worth remembering

This is a tool call the agent makes on itself — "summarize this session into a journal entry."

## Flush Triggers (When to Compact)

OpenClaw uses multiple triggers. In order of criticality:

### 1. Context Window Guard (mandatory safety net)
Monitor token count. When context reaches ~80% capacity, trigger flush immediately. The agent needs enough remaining room to execute the summarization tool calls. If you wait until 100%, you can't summarize — you've already lost.

### 2. Session Boundary (disconnect/sleep)
When the user disconnects (closes browser, walks away) and the agent is about to go idle. Natural moment to write notes. In Stackdocs: Bridge detects last browser disconnect → tells Sprite → flush before 30s auto-sleep.

### 3. Inactivity Timeout
No user message for N minutes (15-30). User has probably walked away. Flush while you still have context and are still awake. Safer than waiting for disconnect.

### 4. Heartbeat (periodic reflection)
The OpenClaw signature: agent wakes every 30 minutes, reviews recent context, writes notes, reflects. More about proactivity than just flushing. Makes the agent feel "alive."

### 5. Turn Count (simple fallback)
Every N turns (e.g., 30), write a journal entry. Crude but prevents unbounded growth if other triggers don't fire.

## Context Window Guard Details

From OpenClaw's implementation:

- Base system prompt: 10,000-20,000 tokens (identity, tools, memory files)
- Working space for conversation: remaining tokens
- Guard threshold: ~80% of max context
- When triggered:
  1. Agent summarizes current session → writes to journal
  2. Agent updates MEMORY.md with new learnings
  3. System starts fresh session with curated files loaded
  4. User doesn't notice the boundary (seamless)

Key insight: **tool output is the biggest context bloater**. A single Bash command can dump 5,000 tokens of output. OpenClaw prunes tool traces aggressively during summarization.

## Session Lifecycle (How It All Fits Together)

```
User connects
  → Sprite wakes (if sleeping)
  → Load soul.md + user.md + MEMORY.md + 2 days of journals (~2,200 tokens)
  → Start SDK session (get session_id, save to SQLite)

Turn 1-N: Normal conversation
  → Each turn: SDK resume (remembers prior turns)
  → Each turn: append to JSONL transcript
  → Agent uses tools, creates cards, writes memory as needed

Context getting full (guard trigger) OR user idle (inactivity trigger):
  → Agent summarizes: "What happened? What did I learn? What's pending?"
  → Writes journal entry (daily summary)
  → Updates MEMORY.md (new facts)
  → Updates user.md (new preferences)
  → Start NEW SDK session (fresh context)
  → Load memory files again (~2,200 tokens)
  → Continue seamlessly

User disconnects:
  → Final flush (if not recently flushed)
  → Sprite auto-sleeps after 30s
  → Process checkpointed (CRIU)

User reconnects (hours/days later):
  → Sprite wakes, process resumes
  → Load memory files (includes yesterday's journal)
  → Fresh session, but agent knows everything important
  → "Welcome back! Last time we processed those Acme invoices..."
```

## Key Principles from OpenClaw

1. **Files over databases for memory.** Human-readable, editable, portable. No vendor lock-in.
2. **Append-only JSONL for audit.** Never loaded into context. Pure audit trail.
3. **Agent writes its own summaries.** Only the agent knows what mattered.
4. **Flush before you forget.** Pre-compaction flush is the critical mechanism.
5. **Context is a cache, disk is truth.** Design for cache misses (fresh sessions).
6. **Lane queue for memory writes.** Serial by default — prevents race conditions when updating memory files.
7. **Hybrid search for retrieval.** Combine keyword and semantic search over memory files (post-MVP).

## Comparison: OpenClaw vs Stackdocs (Current)

| Component | OpenClaw | Stackdocs (built) | Stackdocs (needed) |
|-----------|----------|-------------------|-------------------|
| soul.md | Yes | Yes | - |
| user.md | Yes | Yes | - |
| MEMORY.md | Yes | Yes | - |
| Daily journals | Yes | Yes | - |
| JSONL transcripts | Rich (all events) | Basic (tool calls only) | Richer event types |
| Memory loader | Yes | Yes (5 files) | - |
| Pre-compaction flush | Yes | No | **Critical** |
| Context window guard | Yes | No | **Important** |
| SDK session resume | N/A (uses Messages API) | No | Needed for multi-turn |
| Heartbeat | Yes (30 min) | No | Post-MVP |
| Hybrid search (FTS5) | Yes | No | Tracked (m7b.6.1) |
| Inactivity flush trigger | Yes | No | Needed |
| Disconnect flush trigger | Yes | No | Needed |

## Sources

- [binds.ch — Decoding OpenClaw: The Surprising Elegance of Two Simple Primitives](https://binds.ch/blog/openclaw-systems-analysis)
- [Milvus — Build Clawdbot-Style AI Agents with LangGraph & Milvus](https://milvus.io/blog/clawdbot-long-running-ai-agents-langgraph-milvus.md)
- [Medium/AIMonks — Clawdbot's Memory Architecture & Pre-Compaction Flush](https://medium.com/aimonks/clawdbots-memory-architecture-pre-compaction-flush-the-engineering-reality-behind-never-c8ff84a4a11a)
- [mem0 — We Built Persistent Memory for OpenClaw](https://mem0.ai/blog/mem0-memory-for-openclaw)
- [Leonis Newsletter — OpenClaw aka Clawdbot and the AI Agent](https://leonisnewsletter.substack.com/p/openclaw-aka-clawdbot-and-the-ai)
- [Nextword — The Ambient AI Era: Clawdbot's Ripple Effects](https://nextword.substack.com/p/the-ambient-ai-and-clawdbot-openclaw-implications)
