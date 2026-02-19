# Sprites.dev API Reference

Quick reference for the Sprites.dev APIs used by Stackdocs. Based on testing during Phase 0 pre-flight (2026-02-06, CLI v0.0.1-rc31).

---

## Authentication

```
Authorization: Bearer {SPRITES_TOKEN}
```

Token format: `{org}/{id}/{token_id}/{token_value}`

CLI auth: `sprite auth setup --token "..."` or `sprite login` (Fly.io OAuth flow).

---

## Key Behavior

- **Processes frozen on sleep** (checkpoint/CRIU) — same PID on wake. NOT killed.
- **TCP connections die on sleep** — must reconnect TCP Proxy after wake.
- **Active exec sessions keep sprite awake** — won't auto-sleep while a session exists.
- **Any API call wakes a sleeping sprite** — no explicit wake endpoint needed.
- **30s auto-sleep** after last activity (no API calls, no active exec sessions).
- **Cold wake time:** 1-12 seconds.
- **Sprite environment:** Ubuntu 25.04, Python 3.13.3, 99GB disk, 7.8GB RAM.

---

## Core Endpoints

Base URL: `https://api.sprites.dev`

### Sprites

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/sprites` | Create sprite |
| GET | `/v1/sprites` | List sprites |
| GET | `/v1/sprites/{name}` | Get sprite status |
| PUT | `/v1/sprites/{name}` | Update sprite settings |
| DELETE | `/v1/sprites/{name}` | Destroy sprite |

**Create sprite:**
```bash
curl -X POST "https://api.sprites.dev/v1/sprites" \
  -H "Authorization: Bearer $SPRITES_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-sprite"}'
```

Response: `201` with `{id, name, status, url, organization, created_at, ...}`

Status values: `cold`, `warm`, `running`

### Exec (WebSocket)

Execute commands on a sprite. This is a **WebSocket** endpoint, not REST.

| Method | Endpoint | Description |
|--------|----------|-------------|
| WSS | `/v1/sprites/{name}/exec` | Execute command (WebSocket) |
| GET | `/v1/sprites/{name}/exec` | List active exec sessions |
| DELETE | `/v1/sprites/{name}/exec/{id}` | Kill exec session |

**Query parameters for exec WebSocket:**

| Param | Description |
|-------|-------------|
| `cmd` | Command to execute (repeat for args: `?cmd=python3&cmd=server.py`) |
| `path` | Explicit path to executable |
| `tty` | Enable TTY mode (default: false) |
| `stdin` | Enable stdin (default: false for non-TTY) |
| `max_run_after_disconnect` | How long to run after WS disconnect. `0` = forever. Default: `10s` |
| `env` | Environment variables as `KEY=VALUE` (repeat for multiple) |
| `id` | Attach to existing session by ID |

**Start a persistent server (our pattern):**
```bash
# Connect via WebSocket, server keeps running forever after disconnect
wss://api.sprites.dev/v1/sprites/{name}/exec?cmd=python3&cmd=/workspace/src/server.py&max_run_after_disconnect=0&env=ANTHROPIC_API_KEY=sk-...&env=MISTRAL_API_KEY=...
```

**Binary protocol (non-TTY mode):**
Each binary message is prefixed with a stream ID byte:
- `0` = stdin (client → server)
- `1` = stdout (server → client)
- `2` = stderr (server → client)
- `3` = exit code (server → client)
- `4` = stdin EOF (client → server)

**JSON messages from server:**
```json
{"type": "session_info", "session_id": 28, "command": "python3", "tty": false, "is_owner": false}
{"type": "port_opened", "port": 8765, "address": "10.0.0.1", "pid": 954}
{"type": "exit", "exit_code": 0}
```

**List sessions:**
```bash
curl -H "Authorization: Bearer $SPRITES_TOKEN" \
  "https://api.sprites.dev/v1/sprites/{name}/exec"
```

Response: `{count, sessions: [{id, created, command, is_active, last_activity, ...}]}`

### TCP Proxy (WebSocket)

Tunnel TCP connections to ports inside the sprite. This is how Bridge communicates with the Sprite's Python WebSocket server.

| Method | Endpoint | Description |
|--------|----------|-------------|
| WSS | `/v1/sprites/{name}/proxy` | TCP tunnel (WebSocket) |

**Protocol flow:**
1. Connect WebSocket to `wss://api.sprites.dev/v1/sprites/{name}/proxy`
2. Send JSON init message: `{"host": "localhost", "port": 8765}`
3. Receive JSON response: `{"status": "connected", "target": "10.0.0.1:8765"}`
4. Connection becomes raw TCP relay — all subsequent messages are binary passthrough

**Example with websocat:**
```bash
websocat "wss://api.sprites.dev/v1/sprites/{name}/proxy" \
  -H "Authorization: Bearer $SPRITES_TOKEN"
# Then send: {"host": "localhost", "port": 8765}
```

**Python example:**
```python
import websockets, json

async with websockets.connect(proxy_url, additional_headers=headers) as ws:
    await ws.send(json.dumps({"host": "localhost", "port": 8765}))
    response = json.loads(await ws.recv())  # {"status": "connected", ...}
    # Now send/receive binary data directly to the target port
```

### Checkpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/sprites/{name}/checkpoints` | Create checkpoint |
| GET | `/v1/sprites/{name}/checkpoints` | List checkpoints |
| GET | `/v1/sprites/{name}/checkpoints/{id}` | Get checkpoint info |
| POST | `/v1/sprites/{name}/checkpoints/{id}/restore` | Restore checkpoint |

### Filesystem

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/sprites/{name}/fs/read` | Read file |
| POST | `/v1/sprites/{name}/fs/write` | Write file |
| GET | `/v1/sprites/{name}/fs/list` | List directory |
| DELETE | `/v1/sprites/{name}/fs` | Delete file/directory |
| POST | `/v1/sprites/{name}/fs/rename` | Rename |
| POST | `/v1/sprites/{name}/fs/copy` | Copy |

### Services API (BUGGY — Do Not Use)

**Status:** Returns `400: "service name required"` on all PUT requests as of v0.0.1-rc31. Not needed for our use case — process persistence through sleep/wake means we don't need auto-restart.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/sprites/{name}/services` | List services (works) |
| PUT | `/v1/sprites/{name}/services/{name}` | Create/update service (**BROKEN**) |
| POST | `/v1/sprites/{name}/services/{name}/start` | Start service |
| POST | `/v1/sprites/{name}/services/{name}/stop` | Stop service |
| GET | `/v1/sprites/{name}/services/{name}/logs` | Stream logs |

Expected body (from docs, doesn't work in practice):
```json
{"cmd": "python3", "args": ["/home/user/server.py"], "http_port": 8000, "needs": ["postgres"]}
```

---

## CLI Quick Reference

```bash
# Auth
sprite login                          # Fly.io OAuth
sprite auth setup --token "..."       # Manual token
sprite org list                       # Show configured orgs

# Sprites
sprite create my-sprite               # Create
sprite list                           # List all
sprite destroy my-sprite              # Delete

# Exec
sprite exec -s my-sprite -- echo hi              # Run command
sprite exec -s my-sprite -o org -- python3 app.py  # With org

# API wrapper (passes args to curl with auth)
sprite api -s my-sprite /exec -X GET             # List sessions
sprite api -s my-sprite /services -X GET         # List services
# Path is relative to /v1/sprites/{sprite-name}/ when -s is used

# Checkpoints
sprite checkpoint create              # Create checkpoint
sprite checkpoint list                # List checkpoints
sprite restore {checkpoint-id}        # Restore from checkpoint
```

---

## Stackdocs Usage Pattern

```
Bridge (Fly.io)                        Sprite (sprites.dev)
─────────────────                      ────────────────────
1. Create sprite from checkpoint       POST /v1/sprites
2. Start server via exec WS            WSS  /v1/sprites/{name}/exec
   (max_run_after_disconnect=0)              ?cmd=python3&cmd=/workspace/src/server.py
   (env vars for API keys)                   &env=ANTHROPIC_API_KEY=...
3. Connect TCP Proxy                   WSS  /v1/sprites/{name}/proxy
   → {"host":"localhost","port":8765}        → {"status":"connected"}
4. Forward messages                    Binary passthrough ↔ Python WS server
5. Keepalive pings every 15s           Prevents 30s auto-sleep
6. On disconnect: reconnect proxy      Server still running (same PID)
```

---

## Latency (AU → Sprites.dev)

| Operation | Latency |
|-----------|---------|
| GET sprite status | ~180ms avg |
| Exec (warm) | ~466ms |
| Exec (cold wake) | ~1.1s |
| TCP Proxy connect | ~1s |
| TCP Proxy message RTT | ~200ms |
| Create sprite | ~1s |
