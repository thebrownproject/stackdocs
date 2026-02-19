# Pre-flight Validation Results

**Date:** 2026-02-06
**Sprite CLI:** v0.0.1-rc31
**Test Sprite:** `preflight-test` (org: `fraser-brown`)
**Test Location:** Australia (Sydney)

---

## 1. Fly.io Account

- **Status:** Account created, billing configured
- **Note:** No app deployed yet — Bridge deployment is Phase 1 work
- **CLI:** `flyctl` installed and authenticated

## 2. Sprites.dev Account

- **Status:** Account created, API token obtained
- **CLI:** `sprite` CLI v0.0.1-rc31 installed and authenticated
- **Sprite Environment:** Ubuntu 25.04, Python 3.13.3, 99GB disk, 7.8GB RAM

## 3. Sprites API Validation

### 3.1 Core APIs — All Working

| API | Method | Result | Latency |
|-----|--------|--------|---------|
| List Sprites | `GET /v1/sprites` | 200 OK | 725ms |
| Create Sprite | `POST /v1/sprites` | 201 Created | 1.06s |
| Get Sprite | `GET /v1/sprites/{name}` | 200 OK | 165-230ms |
| Exec (cold start) | `POST /v1/sprites/{name}/exec` | 200 OK | 1.12s |
| Exec (warm) | `POST /v1/sprites/{name}/exec` | 200 OK | 466ms |
| List Exec Sessions | `GET /v1/sprites/{name}/exec` | 200 OK | ~200ms |
| TCP Proxy | `WSS /v1/sprites/{name}/proxy` | 101 → connected | 972ms connect |
| List Services | `GET /v1/sprites/{name}/services` | 200 OK | ~200ms |

### 3.2 TCP Proxy — Full Bidirectional Messaging Confirmed

Test: Python asyncio TCP server on port 8765, connected via TCP Proxy WebSocket.

```
ProxyInitMessage → {"status":"connected","target":"10.0.0.1:8765"}
Server greeting  → {"status":"alive","time":"...","pid":17}
Echo request     → {"echo":"hello from bridge","time":"...","pid":17}
```

- **WS Connect:** 972ms (AU → Sprites.dev)
- **Proxy Init:** 1.2s (includes init + server greeting)
- **Full RTT:** 1.4s (connect + init + send + receive)
- **Warm message RTT:** ~200ms (once connected)

**Verdict:** TCP Proxy works perfectly for Bridge ↔ Sprite communication.

### 3.3 Services API — 400 Error (Non-blocking)

| Attempt | Result |
|---------|--------|
| `PUT /v1/sprites/{name}/services/{name}` with `{"cmd":"...","args":[...]}` | 400: "service name required" |
| Same with `name` in body | 400 |
| Different service name formats (hyphens, no hyphens) | 400 |
| Via `sprite api` CLI wrapper | 400 |
| Matching docs example exactly | 400 |

**Conclusion:** Services API appears to have a bug in v0.0.1-rc31, or the docs are out of date. However, this is **not a blocker** because process persistence makes it unnecessary (see Section 4).

## 4. Auto-restart / Process Persistence — CRITICAL FINDING

### Spec Assumption (WRONG)
> "Processes KILLED on sleep (filesystem-only persistence, no CRIU)"

### Actual Behavior (TESTED)
**Processes SURVIVE sleep/wake with the same PID.**

**Test procedure:**
1. Started Python TCP server via `exec` WebSocket with `max_run_after_disconnect=0`
2. Disconnected exec WebSocket session
3. Waited 50s with zero API calls
4. Sprite status changed to `warm` (confirming it had been sleeping)
5. Connected via TCP Proxy → server alive, **same PID (28)**

**Evidence:**
```
Before sleep: PID=28, status=running
After 50s silence: status=warm (was sleeping)
After wake: PID=28, server responding normally
```

### Implications
- Sprites.dev likely uses **CRIU or VM checkpointing** — processes are frozen, not killed
- The Services API auto-restart feature may be for processes that crash, not sleep/wake
- Starting the server via `exec` with `max_run_after_disconnect=0` is sufficient
- **No fallback needed** — process persistence means the server just survives sleep

### Updated Spec Recommendations
1. Remove "processes killed on sleep" assumption
2. Remove Service auto-restart dependency for server lifecycle
3. Bridge reconnection still needed (TCP connections DO die on sleep)
4. Server start strategy: `exec` with `max_run_after_disconnect=0` at provisioning time

## 5. Latency Measurements (AU → Sprites.dev)

| Operation | Avg | Min | Max | Target |
|-----------|-----|-----|-----|--------|
| GET sprite status (warm) | 189ms | 165ms | 230ms | <200ms |
| GET sprite status (5-run) | 174ms | 165ms | 190ms | <200ms |
| Exec (warm) | 466ms | — | — | — |
| Exec (cold wake) | 1,118ms | — | — | — |
| TCP Proxy connect | 972ms | — | — | — |
| TCP Proxy message RTT | ~200ms | — | — | — |

**Verdict:** API latency averages ~180ms, within the <200ms target. TCP Proxy message RTT ~200ms is acceptable for real-time Canvas updates. Initial connection is ~1s (acceptable, one-time cost per session).

## 6. Exec API Details

- **Protocol:** WebSocket with binary multiplexing (stream IDs: 0=stdin, 1=stdout, 2=stderr, 3=exit)
- **Session persistence:** `max_run_after_disconnect=0` keeps process running indefinitely after WS disconnect
- **Session tracking:** Sessions visible via `GET /exec`, include `is_active` and `last_activity`
- **Port notification:** Server receives `port_opened` event when process binds a port
- **Active sessions keep sprite awake** — sprite will not auto-sleep while exec sessions are active

## 7. Gate Decision

**PASS — All critical checks pass.**

| Check | Status |
|-------|--------|
| Fly.io account + billing | PASS |
| Sprites.dev account + API token | PASS |
| Core APIs (create, exec, status) | PASS |
| TCP Proxy (bidirectional messaging) | PASS |
| Process persistence through sleep/wake | PASS (better than expected) |
| Latency from Australia (<200ms) | PASS (avg 180ms) |
| Services API | FAIL (400 bug) — **non-blocking** |

**Proceed to Phase 1: Infrastructure Scaffold.**

---

## Appendix: Spec Updates Needed

1. **Section: Sprites.dev behavior** — Change "Processes killed on sleep" to "Processes frozen on sleep (preserved via checkpoint, same PID on wake)"
2. **Section: Bridge reconnection** — Keep as-is. TCP proxy connections DO die on sleep. Bridge must reconnect.
3. **Section: Services API** — Downgrade from "required for auto-restart" to "nice-to-have for crash recovery". Process persistence handles sleep/wake.
4. **Task m7b.2.5 (Sprite Python WS server)** — Start server via `exec` WS with `max_run_after_disconnect=0` instead of Services API
5. **Task m7b.2.7 (Bridge reconnection)** — After reconnecting TCP Proxy, verify server is still alive (it should be). If not, restart via exec.
6. **Risk register** — Downgrade "Service auto-restart fails on wake" from HIGH to LOW (process persistence eliminates the risk)
