# Sprite Provisioning

How new Sprites are created and kept up to date.

---

## Architecture

Each stack gets its own Sprite VM. There is no cross-sprite checkpoint cloning — every new sprite is bootstrapped from scratch.

**`stackdocs-golden`** is a reference sprite only. It was used to validate the environment (Ubuntu 25.04, Python 3.13.3, 99GB disk, 7.8GB RAM) and test the bootstrap procedure. It is NOT cloneable.

---

## Bootstrap Flow

When a user's stack has `sprite_status='pending'`, the Bridge provisions a new Sprite via `bootstrapSprite()`. Takes ~30-60 seconds.

**Steps (in order):**

1. **Create Sprite** via Sprites.dev REST API
2. **Create directories**: `/workspace/documents/`, `ocr/`, `artifacts/`, `memory/`, `transcripts/`, `src/`
3. **Install python3-venv**: `sudo apt-get install -y python3-venv`
4. **Create venv**: `python3 -m venv /workspace/.venv`
5. **Deploy requirements.txt** to `/workspace/` via FS API
6. **Install packages**: `/workspace/.venv/bin/pip install -r /workspace/requirements.txt`
   - websockets, aiosqlite, anthropic, claude-agent-sdk, mistralai, httpx
7. **Deploy source code**: `sprite/src/*.py` to `/workspace/src/` via FS API
8. **Initialize SQLite database** at `/workspace/agent.db` — documents, ocr_results, extractions, memory_fts tables
9. **Create memory templates**: `/workspace/memory/soul.md`, `user.md`, `MEMORY.md`
10. **Write VERSION file**: `/workspace/VERSION` set to `CURRENT_VERSION`

**Code:** `bridge/src/bootstrap.ts` (`bootstrapSprite()`), called from `bridge/src/provisioning.ts`.

**Status transitions:** `pending` -> `provisioning` -> `active` (or `failed`, retried on next connect).

---

## Lazy Updates

When the Bridge establishes a connection to a sprite, it calls `checkAndUpdate(spriteName)` before opening the TCP Proxy connection.

**Update flow:**

1. Read `/workspace/VERSION` from sprite via FS API
2. Compare with `CURRENT_VERSION` (exported from `bridge/src/bootstrap.ts`)
3. If outdated: deploy new code, run `pip install -r requirements.txt`, write new VERSION
4. If current: no-op

**Best-effort** — update failures are caught and logged. The connection proceeds regardless.

**Bump process:** When code or deps change, increment `CURRENT_VERSION` in `bridge/src/bootstrap.ts`. All sprites will be updated on their next connection.

**Code:** `bridge/src/updater.ts` (`checkAndUpdate()`), called from `bridge/src/proxy.ts` inside `ensureSpriteConnection()`.

---

## Server Startup

The Bridge starts the Sprite's Python WebSocket server via exec WebSocket:

```
/workspace/.venv/bin/python3 /workspace/src/server.py
```

- Uses `max_run_after_disconnect=0` — process persists indefinitely through sleep/wake
- Server listens on port 8765
- Bridge connects via TCP Proxy API: `WSS /v1/sprites/{name}/proxy` + `ProxyInitMessage`
- NOT via Services API (has bug in v0.0.1-rc31, not needed)

API keys (ANTHROPIC_API_KEY, MISTRAL_API_KEY) are injected as env vars via the exec command.

---

## Sprite Sleep/Wake

- **30s auto-sleep** after last activity (no API calls, no active exec sessions)
- Bridge sends keepalive pings during active sessions to prevent sleep
- **Processes survive sleep** — CRIU checkpoint freezes processes, same PID on wake
- **TCP connections die on sleep** — Bridge must reconnect TCP Proxy after wake
- **Cold wake:** 1-12 seconds (any API call wakes the sprite)
- **Checkpoint creation:** ~300ms

---

## File Layout on Sprite

```
/workspace/
├── .venv/                  # Python virtual environment
├── src/                    # Deployed source code (server.py, gateway.py, etc.)
├── requirements.txt        # Python dependencies
├── VERSION                 # Integer version, compared to CURRENT_VERSION
├── agent.db                # SQLite database
├── documents/              # Uploaded files
├── ocr/                    # Cached OCR text ({doc_id}.md)
├── artifacts/              # Generated exports
├── memory/
│   ├── soul.md             # Stack identity and extraction rules
│   ├── user.md             # User preferences
│   └── MEMORY.md           # Global context
└── transcripts/            # JSONL audit logs
```
