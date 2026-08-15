# Collet API Contract v1

Base URL: `http://127.0.0.1:5335`
All responses JSON. All timestamps are unix seconds (ms where noted).

## Data model

```ts
type PortEntry = {
  port: number
  protocol: "tcp" | "udp"
  host: string              // raw bind address from lsof: "*" | "127.0.0.1" | "::1" | "0.0.0.0" | "192.168.x.x" | "[::1]"
  local: boolean            // true if bound to loopback only (*, 127.0.0.1, ::1 are loopback-safe; treat bare "*" IPv6/in6 as exposed)
  exposed: boolean          // true if reachable beyond loopback (e.g. "*", "0.0.0.0", LAN IP)
  pid: number
  process: string           // process name (comm)
  label: string             // human-readable app label (java main class, script name); falls back to process
  cmdline: string           // full command line
  type: string              // category: "java" | "node" | "bun" | "python" | "idea" | "docker" | "db" | "ai" | "other" (infer from comm+cmdline keywords; "ai" for llm/ollama/ai-server style cmds)
  user: string
  startedAt: string         // ISO 8601 local time (from ps lstart)
  startedEpoch: number      // unix seconds
  uptimeSec: number         // now - startedEpoch
  rssBytes: number          // resident set size (from ps RSS KB * 1024)
  cpuPct: number            // %cpu from ps
  pinned: boolean
  note: string
}

type ProcessDetail = {
  pid: number; ppid: number
  name: string; label: string; type: string; user: string
  cmdline: string; cwd: string | null; path: string | null   // path = executable resolved via lsof -p PID -d txt 2nd line
  startedAt: string; startedEpoch: number; uptimeSec: number
  rssBytes: number; cpuPct: number; threads: number
  ports: Array<{ port: number; protocol: string; host: string; exposed: boolean }>
  children: Array<{ pid: number; name: string; rssBytes: number; cpuPct: number; uptimeSec: number }>
}
```

## Endpoints

### `GET /api/overview`
Initial dashboard payload.
```jsonc
{
  "generatedAt": 1789412345,
  "machine": { "hostname": "...", "platform": "darwin", "arch": "arm64", "uptimeSec": 123, "loadAvg": [1.2, 0.8, 0.6] },
  "stats": {
    "listeningCount": 42,        // total listening sockets
    "tcpCount": 40, "udpCount": 2,
    "processCount": 18,          // unique PIDs holding listeners
    "exposedCount": 3,           // non-loopback binds
    "totalRssBytes": 1234567890, // sum RSS of listener processes
    "byType": { "java": 3, "node": 2, "bun": 1 }
  },
  "topRam": [ { "pid": 3794, "name": "java", "rssBytes": 512000000, "port": 16666 } ],
  "history": [ { "t": 1789412300, "count": 41, "rss": 1200000000 } ]  // last 120 samples (1/2s)
}
```

### `GET /api/ports?type=tcp|udp|all&query=`
Full listener list (sorted: port ascending).
```jsonc
{ "generatedAt": 1789412345, "ports": [ PortEntry ] }
```
`query` filters on port/process/cmdline substring (case-insensitive).

### `GET /api/processes/:pid`
Process detail. `404` if gone. `children` = direct descendants (from ppid map); `threads` via `ps -o nthreads`.

### `DELETE /api/processes/:pid?force=false&tree=false`
Kill. `force=false` → SIGTERM, `force=true` → SIGKILL. `tree=true` → descendants get signaled first (deepest first), then the target.
```jsonc
// 200
{ "killed": [3794, 3700], "signal": "SIGTERM", "failed": [] }
// 404 (already gone) | 403 (not owner / permission)
{ "error": "message" }
```

### `POST /api/kill`  body `{ "pids": number[], "force": false, "tree": false }`
Batch kill — one ps snapshot for the whole set; per-pid failures collected (no throw).
```jsonc
// 200
{ "killed": [3794, 3700], "signal": "SIGTERM", "failed": ["3701: process not found"] }
// 400 (missing/invalid pids)
{ "error": "message" }
```

### `GET /api/pins`
```jsonc
{ "pins": [ { "port": 16666, "note": "", "createdAt": 1789412000 } ] }
```
### `PUT /api/pins/:port`  body `{ "note": "optional" }`
### `DELETE /api/pins/:port`

Pins persist to `~/.collet/pins.json` (atomic write).

### `GET /api/events` — Server-Sent Events
Every `2000ms` (configurable, default 2s) a full snapshot:
```
event: snapshot
data: { "generatedAt": ..., "ports": [PortEntry] }

event: ping
data: {}
```
Clients diff locally for row-level animations.

### `GET /api/settings`
```jsonc
{ "pollIntervalMs": 2000, "colletPort": 5335 }
```

## Implementation notes (macOS)
- Listeners: `lsof -nP -iTCP -sTCP:LISTEN` + `lsof -nP -iUDP` (UDP: entries with no state field; filter `(LISTEN)`-less UDP rows = bound sockets).
- Process meta: single `ps -axo pid=,ppid=,comm=,etime=,lstart=,rss=,%cpu=,nthreads=,command=` call; parse `lstart` → epoch via `new Date(lstartStr).getTime()/1000` (macOS lstart format: `Wed Aug 14 09:12:00 2026`).
- Kill: `kill -TERM <pid>` / `kill -KILL <pid>`; tree = build ppid map, collect descendants recursively. Use `Bun.spawn` for all shell-outs (never shell string interpolation with user data).
- Exposed detection: host `*` (IPv6 in6 wildcard) or `0.0.0.0` or non-loopback literal → exposed. `127.0.0.1`, `::1` → local.
- RSS bytes: ps RSS is KB on macOS → `rss * 1024`.
- CORS: allow `http://localhost:5173` (vite dev) + `http://127.0.0.1:5173`.
- In dev, also proxy-less: frontend calls `http://127.0.0.1:5335` directly via `VITE_API_BASE`.