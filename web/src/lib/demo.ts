/* demo.ts — offline sample data so the GitHub Pages build showcases the UI.
 * Activated when served from github.io or when ?demo is in the URL.
 */

import type {
  Overview,
  Pin,
  PortEntry,
  ProcessChild,
  ProcessDetail,
  ProcessSocket,
  SnapshotEvent,
} from "./types"

export const IS_DEMO =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).has("demo") ||
    window.location.hostname.endsWith("github.io"))

/* ---------- sample data ---------- */

const BASE = Math.floor(Date.now() / 1000)

function entry(
  port: number,
  protocol: "tcp" | "udp",
  host: string,
  process: string,
  label: string,
  cmdline: string,
  type: PortEntry["type"],
  pid: number,
  rssBytes: number,
  cpuPct: number,
  opts: { exposed?: boolean; uptimeSec?: number; pinned?: boolean; note?: string } = {},
): PortEntry {
  const exposed = opts.exposed ?? false
  const local = host === "127.0.0.1" || host === "::1" || host === "localhost"
  const uptimeSec = opts.uptimeSec ?? 600 + port * 97
  return {
    port,
    protocol,
    host,
    local,
    exposed,
    pid,
    process,
    label,
    cmdline,
    type,
    user: "dev",
    startedAt: new Date((BASE - uptimeSec) * 1000).toISOString().slice(0, 19),
    startedEpoch: BASE - uptimeSec,
    uptimeSec,
    rssBytes,
    cpuPct,
    pinned: opts.pinned ?? false,
    note: opts.note ?? "",
  }
}

let mockPorts: PortEntry[] = [
  entry(5173, "tcp", "127.0.0.1", "vite", "collet-web", "node node_modules/.bin/vite", "node", 8120, 214_000_000, 2.1),
  entry(5335, "tcp", "127.0.0.1", "bun", "collet-server", "bun run --cwd server dev", "bun", 8121, 96_000_000, 1.4),
  entry(8080, "tcp", "127.0.0.1", "java", "spring-boot:main", "java -jar backend.jar", "java", 8122, 512_000_000, 6.8),
  entry(3000, "tcp", "::1", "node", "next-dev", "node .next/bin/next dev", "node", 8123, 388_000_000, 4.2),
  entry(5432, "tcp", "127.0.0.1", "postgres", "postgres", "postgres -D /usr/local/var/postgres", "db", 8124, 310_000_000, 1.1),
  entry(6379, "tcp", "127.0.0.1", "redis-server", "redis-server", "redis-server *:6379", "db", 8125, 24_000_000, 0.3),
  entry(9200, "tcp", "127.0.0.1", "java", "elasticsearch", "java -Xms1g -Xmx1g org.elasticsearch.bootstrap.Elasticsearch", "db", 8126, 1_240_000_000, 3.9),
  entry(11434, "tcp", "127.0.0.1", "ollama", "ollama", "ollama serve", "ai", 8127, 890_000_000, 5.5),
  entry(5000, "tcp", "0.0.0.0", "python", "flask-api", "python -m flask run --host 0.0.0.0", "python", 8128, 86_000_000, 1.9, { exposed: true }),
  entry(7000, "tcp", "127.0.0.1", "docker", "docker-proxy", "docker-proxy -proto tcp -host-ip 0.0.0.0 -host-port 7000", "docker", 8129, 18_000_000, 0.2, { exposed: true }),
  entry(8888, "tcp", "127.0.0.1", "jupyter", "jupyter-notebook", "python -m jupyter notebook --no-browser", "python", 8130, 142_000_000, 2.7),
  entry(3306, "tcp", "127.0.0.1", "mysqld", "mysqld", "mysqld --datadir=/usr/local/mysql", "db", 8131, 228_000_000, 1.0),
  entry(1900, "udp", "192.168.1.50", "ssdpd", "ssdp-discovery", "ssdpd", "other", 8132, 12_000_000, 0.1, { exposed: true }),
  entry(5353, "udp", "192.168.1.50", "mDNSResponder", "mDNSResponder", "mDNSResponder", "other", 8133, 20_000_000, 0.4),
  entry(5353, "udp", "192.168.1.51", "mDNSResponder", "mDNSResponder", "mDNSResponder", "other", 8134, 20_000_000, 0.4),
  entry(6048, "tcp", "127.0.0.1", "java", "idea:updater", "/Applications/IntelliJ IDEA.app/Contents/MacOS/idea", "idea", 8135, 1_900_000_000, 12.7),
  entry(6942, "tcp", "127.0.0.1", "electron", "desktop-app", "/Applications/Collet.app/Contents/MacOS/Collet", "other", 8136, 460_000_000, 3.3),
  entry(9090, "tcp", "0.0.0.0", "prometheus", "prometheus", "prometheus --config.file=/etc/prometheus.yml", "other", 8137, 205_000_000, 1.6, { exposed: true }),
]

const mockPinMap = new Map<number, Pin>([
  [5173, { port: 5173, note: "collet web — hot reload", createdAt: BASE - 3600 }],
  [5432, { port: 5432, note: "local postgres (dev DB)", createdAt: BASE - 86_400 }],
])

let transient: { ports: PortEntry[]; until: number } | null = null

function currentPorts(): PortEntry[] {
  if (transient && transient.until > Date.now()) return [...mockPorts, ...transient.ports]
  return mockPorts
}

/* ---------- API responses ---------- */

export function demoOverview(): Overview {
  const ports = currentPorts()
  const pids = new Set(ports.map((p) => p.pid))
  const listening = ports.length
  const exposed = ports.filter((p) => p.exposed).length
  const totalRss = ports.reduce((n, p) => n + p.rssBytes, 0)
  const byType: Record<string, number> = {}
  for (const p of ports) byType[p.type] = (byType[p.type] ?? 0) + 1
  const topRam = [...pids].map((pid) => {
    const p = ports.find((x) => x.pid === pid)!
    return { pid, name: p.process, rssBytes: p.rssBytes, port: p.port }
  })
  topRam.sort((a, b) => b.rssBytes - a.rssBytes)
  const history: Overview["history"] = Array.from({ length: 24 }, (_, i) => ({
    t: Math.floor((Date.now() - (23 - i) * 2000) / 1000),
    count: listening + Math.round(Math.sin(i / 2.4) * 2),
    rss: totalRss + Math.round(Math.sin(i / 3.1) * 4e7),
  }))
  return {
    generatedAt: Math.floor(Date.now() / 1000),
    machine: { hostname: "demo.local", platform: "darwin", arch: "arm64", uptimeSec: 2_592_000, loadAvg: [1.4, 1.2, 1.1] },
    stats: {
      listeningCount: listening,
      tcpCount: ports.filter((p) => p.protocol === "tcp").length,
      udpCount: ports.filter((p) => p.protocol === "udp").length,
      processCount: pids.size,
      exposedCount: exposed,
      totalRssBytes: totalRss,
      byType,
    },
    topRam,
    history,
  }
}

export function demoPorts(params: { type?: string; query?: string } = {}): {
  generatedAt: number
  ports: PortEntry[]
} {
  let ports = currentPorts()
  if (params.type && params.type !== "all") ports = ports.filter((p) => p.type === params.type)
  if (params.query) {
    const q = params.query.toLowerCase()
    ports = ports.filter((p) =>
      `${p.port} ${p.process} ${p.cmdline} ${p.type} ${p.host}`.toLowerCase().includes(q),
    )
  }
  return { generatedAt: Math.floor(Date.now() / 1000), ports }
}

export function demoProcess(pid: number): ProcessDetail | null {
  const p = currentPorts().find((x) => x.pid === pid)
  if (!p) return null
  const siblings = currentPorts().filter((x) => x.pid === pid)
  const sockets: ProcessSocket[] = siblings.map((s) => ({
    port: s.port,
    protocol: s.protocol,
    host: s.host,
    exposed: s.exposed,
  }))
  const children: ProcessChild[] = [
    { pid: pid + 10, name: `${p.process}:worker`, rssBytes: p.rssBytes / 5, cpuPct: 0.4, uptimeSec: p.uptimeSec },
    { pid: pid + 11, name: `${p.process}:reporter`, rssBytes: p.rssBytes / 9, cpuPct: 0.2, uptimeSec: p.uptimeSec },
  ]
  return {
    pid: p.pid,
    ppid: 1,
    name: p.process,
    label: p.label,
    type: p.type,
    user: "dev",
    cmdline: p.cmdline,
    cwd: p.type === "node" || p.type === "bun" ? "/Users/dev/projects/demo" : null,
    path: p.type === "bun" ? "/opt/homebrew/bin/bun" : null,
    startedAt: p.startedAt,
    startedEpoch: p.startedEpoch,
    uptimeSec: p.uptimeSec,
    rssBytes: p.rssBytes,
    cpuPct: p.cpuPct,
    threads: 8 + (pid % 20),
    ports: sockets,
    children,
  }
}

export function demoPins(): { pins: Pin[] } {
  return { pins: [...mockPinMap.values()] }
}

export function demoPutPin(port: number, note: string): Pin {
  const pin: Pin = { port, note, createdAt: Date.now() }
  mockPinMap.set(port, pin)
  return pin
}

export function demoDeletePin(port: number): boolean {
  return mockPinMap.delete(port)
}

export function demoSettings() {
  return { pollIntervalMs: 2000, colletPort: 5335 }
}

/* ---------- fake SSE stream ---------- */

function nextMockSnapshot(): SnapshotEvent {
  const ports = currentPorts().map((p, i) => {
    if (i % 5 === 0) {
      return { ...p, cpuPct: Math.max(0, p.cpuPct + (Math.random() - 0.5) * 2), uptimeSec: p.uptimeSec + 2 }
    }
    return { ...p, uptimeSec: p.uptimeSec + 2 }
  })
  if (!transient && Math.random() < 0.25) {
    transient = {
      until: Date.now() + 40_000,
      ports: [entry(4444, "tcp", "127.0.0.1", "node", "ephemeral-server", "node server.js", "node", 8199, 40_000_000, 1.0)],
    }
  }
  if (transient && transient.until < Date.now()) transient = null
  return { generatedAt: Math.floor(Date.now() / 1000), ports }
}

/** Minimal EventSource stand-in: same surface connectEvents() expects. */
export class DemoEventSource {
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private listeners = new Map<string, Set<(ev: { data: string }) => void>>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor() {
    queueMicrotask(() => this.onopen?.())
    this.timer = setInterval(() => {
      const snap = nextMockSnapshot()
      const msg = { data: JSON.stringify(snap) }
      this.listeners.get("snapshot")?.forEach((cb) => cb(msg))
    }, 2000)
  }

  addEventListener(type: string, cb: (ev: { data: string }) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(cb)
  }

  close(): void {
    if (this.timer) clearInterval(this.timer)
  }
}
