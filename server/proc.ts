// server/proc.ts — macOS process/socket introspection.
// All shell-outs go through Bun.spawn with array args (never shell interpolation).

export interface PortEntry {
  port: number
  protocol: "tcp" | "udp"
  host: string // raw bind address from lsof: "*" | "127.0.0.1" | "::1" | "0.0.0.0" | "192.168.x.x" | "[::1]"
  local: boolean // true if bound to loopback only (127.0.0.1, ::1)
  exposed: boolean // true if reachable beyond loopback ("*", "0.0.0.0", LAN IP)
  pid: number
  process: string // process name (comm)
  label: string // human-readable app label derived from cmdline (main class / script name)
  cmdline: string // full command line
  type: string // "java" | "node" | "bun" | "python" | "idea" | "docker" | "db" | "ai" | "other"
  user: string
  startedAt: string // ISO 8601 local time (from ps lstart)
  startedEpoch: number // unix seconds
  uptimeSec: number // now - startedEpoch
  rssBytes: number // from ps RSS KB * 1024
  cpuPct: number // %cpu from ps (may be fractional)
  pinned: boolean
  note: string
}

export interface PsRow {
  pid: number
  ppid: number
  comm: string
  cmdline: string
  startedAt: string
  startedEpoch: number
  uptimeSec: number
  rssBytes: number
  cpuPct: number
  etimeSec: number | null
}

export interface ProcessDetail {
  pid: number
  ppid: number
  name: string
  label: string
  type: string
  user: string
  cmdline: string
  cwd: string | null
  path: string | null // executable resolved via lsof -p PID -d txt
  startedAt: string
  startedEpoch: number
  uptimeSec: number
  rssBytes: number
  cpuPct: number
  threads: number
  ports: Array<{ port: number; protocol: string; host: string; exposed: boolean }>
  children: Array<{ pid: number; name: string; rssBytes: number; cpuPct: number; uptimeSec: number }>
}

export interface MachineInfo {
  hostname: string
  platform: string
  arch: string
  uptimeSec: number
  loadAvg: [number, number, number]
}

export interface OverviewStatsData {
  listeningCount: number
  tcpCount: number
  udpCount: number
  processCount: number
  exposedCount: number
  totalRssBytes: number
  byType: Record<string, number>
}

export interface TopRamItem {
  pid: number
  name: string
  rssBytes: number
  port: number
}

export interface KillResult {
  killed: number[]
  signal: "SIGTERM" | "SIGKILL"
  failed: string[]
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

// macOS lstart: "Tue Aug  4 19:37:35 2026" (whitespace-normalized before matching)
const LSTART_RE = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4}\b/

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function run(cmd: string[], timeoutMs = 10000): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  // macOS ps truncates command= to the terminal width; force a wide COLUMNS.
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    timeout: timeoutMs,
    env: { ...process.env, COLUMNS: "10000" },
  })
  const [stdout, stderr] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
  ])
  const exitCode = await proc.exited
  return { stdout, stderr, exitCode }
}

// ---------------------------------------------------------------------------
// listeners()
// ---------------------------------------------------------------------------

interface ListenerSocket {
  port: number
  protocol: "tcp" | "udp"
  host: string
  local: boolean
  exposed: boolean
  pid: number
  user: string
  comm: string
}

// lsof row columns: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
// PROTOCOL is its own column (token 7, "TCP"/"UDP"); NAME may contain spaces
// ("*:64313 (LISTEN)"), so it is everything after token 8.
function parseLsofRow(line: string): ListenerSocket | null {
  const tokens = line.split(/\s+/)
  if (tokens.length < 9) return null
  const pid = Number(tokens[1])
  if (!Number.isInteger(pid) || pid <= 0) return null
  const protoTok = tokens[7] ?? ""
  const protocol = protoTok === "UDP" ? "udp" : protoTok === "TCP" ? "tcp" : null
  if (protocol === null) return null
  const addrPort = tokens.slice(8).join(" ").replace(/ \(LISTEN\)$/, "")
  if (protocol === "udp" && addrPort.includes("->")) return null // connected UDP socket, not a bound listener
  const lastColon = addrPort.lastIndexOf(":")
  if (lastColon < 0) return null
  const host = addrPort.slice(0, lastColon)
  const port = Number(addrPort.slice(lastColon + 1))
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null // skips UDP "*:*" rows
  const stripped = host.replace(/^\[/, "").replace(/\]$/, "")
  let local = false
  let exposed = false
  if (stripped === "127.0.0.1" || stripped === "::1") local = true
  else exposed = true // "*" (any family), "0.0.0.0", LAN/IPv6 literals
  const comm = (tokens[0] ?? "").replace(/\\x20/g, " ")
  return { port, protocol, host, local, exposed, pid, user: tokens[2] ?? "", comm }
}

/**
 * Parse lsof listener output into PortEntry[]. Pass a ps snapshot (or its
 * promise) to fill process metadata; entries for processes missing from ps
 * get safe defaults (process died between lsof and ps).
 */
export async function listeners(
  psInput?: Promise<Map<number, PsRow>> | Map<number, PsRow>,
): Promise<PortEntry[]> {
  const psPromise = Promise.resolve(psInput ?? undefined)
  const [tcpRes, udpRes] = await Promise.all([
    run(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"]),
    run(["lsof", "-nP", "-iUDP"]),
  ])
  const ps = await psPromise
  const seen = new Set<string>()
  const entries: PortEntry[] = []
  const rows = [...tcpRes.stdout.split("\n"), ...udpRes.stdout.split("\n")]
  for (const line of rows) {
    const sock = parseLsofRow(line)
    if (!sock) continue
    const key = `${sock.pid}:${sock.protocol}:${sock.port}:${sock.host}`
    if (seen.has(key)) continue
    seen.add(key)
    const row = ps?.get(sock.pid)
    entries.push({
      port: sock.port,
      protocol: sock.protocol,
      host: sock.host,
      local: sock.local,
      exposed: sock.exposed,
      pid: sock.pid,
      process: row?.comm ?? sock.comm,
      label: row ? smartLabel(row.comm, row.cmdline) : smartLabel(sock.comm, ""),
      cmdline: row?.cmdline ?? "",
      type: row ? inferType(row.comm, row.cmdline) : inferType(sock.comm, ""),
      user: sock.user,
      startedAt: row?.startedAt ?? "",
      startedEpoch: row?.startedEpoch ?? 0,
      uptimeSec: row?.uptimeSec ?? 0,
      rssBytes: row?.rssBytes ?? 0,
      cpuPct: row?.cpuPct ?? 0,
      pinned: false,
      note: "",
    })
  }
  entries.sort((a, b) => a.port - b.port || a.protocol.localeCompare(b.protocol))
  return entries
}

// ---------------------------------------------------------------------------
// psSnapshot()
// ---------------------------------------------------------------------------

let psHasThreads = false // some macOS ps versions support nthreads, most don't
let psCapabilityDetected = false

export async function psSnapshot(): Promise<Map<number, PsRow>> {
  // macOS ps truncates comm= to 16 chars when wide columns are present, so the
  // process name is derived from the cmdline's argv[0] basename instead.
  const res = await run(
    ["ps", "-axo", "pid=,ppid=,etime=,lstart=,rss=,%cpu=,nthreads=,command="],
    15000,
  )
  if (!psCapabilityDetected) {
    psHasThreads = !/keyword not found/i.test(res.stderr)
    psCapabilityDetected = true
  }
  const now = Math.floor(Date.now() / 1000)
  const map = new Map<number, PsRow>()
  for (const line of res.stdout.split("\n")) {
    const row = parsePsLine(line, psHasThreads, now)
    if (row) map.set(row.pid, row)
  }
  return map
}

// Anchors on the lstart token sequence ("Day Mon D HH:MM:SS YYYY") so that a
// multi-word cmdline cannot shift columns. Columns: pid ppid etime lstart rss %cpu [nthreads] command.
function parsePsLine(line: string, hasThreads: boolean, now: number): PsRow | null {
  if (!line.trim()) return null
  const norm = line.trim().replace(/\s+/g, " ")
  const m = LSTART_RE.exec(norm)
  if (!m || m.index === undefined) return null
  const before = norm.slice(0, m.index).trim()
  const startIndex = before === "" ? 0 : before.split(" ").length
  const tokens = norm.split(" ")
  const pid = Number(tokens[0])
  if (!Number.isInteger(pid) || pid <= 0) return null
  const ppid = Number(tokens[1])
  if (!Number.isInteger(ppid)) return null
  const etimeStr = tokens[startIndex - 1] ?? ""
  const lstartStr = tokens.slice(startIndex, startIndex + 5).join(" ")
  const rssKb = Number(tokens[startIndex + 5])
  const cpuTok = tokens[startIndex + 6]
  const cpuPct = Number(cpuTok)
  const cmdline = tokens.slice(startIndex + (hasThreads ? 8 : 7)).join(" ")
  const comm = nameFromCmdline(cmdline)
  const startedEpoch = parseLstartEpoch(lstartStr)
  const etimeSec = parseEtime(etimeStr)
  const rssBytes = Number.isFinite(rssKb) && rssKb > 0 ? Math.round(rssKb * 1024) : 0
  let startedAt = ""
  let epoch = 0
  let uptimeSec = 0
  if (startedEpoch !== null) {
    epoch = startedEpoch
    startedAt = isoLocal(epoch)
    uptimeSec = Math.max(0, now - epoch)
  } else if (etimeSec !== null) {
    uptimeSec = etimeSec
  }
  return {
    pid,
    ppid,
    comm,
    cmdline,
    startedAt,
    startedEpoch: epoch,
    uptimeSec,
    rssBytes,
    cpuPct: Number.isFinite(cpuPct) ? cpuPct : 0,
    etimeSec,
  }
}

function nameFromCmdline(cmdline: string): string {
  const argv0 = cmdline.split(/\s+/)[0] ?? ""
  const base = argv0.replace(/^[-/]+/, "").split("/").pop() ?? ""
  return base || "unknown"
}

function parseLstartEpoch(s: string): number | null {
  const viaDate = Date.parse(s)
  if (Number.isFinite(viaDate)) return Math.floor(viaDate / 1000)
  const m = s.match(/^(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})$/)
  if (!m) return null
  const month = MONTHS[(m[2] ?? "").toLowerCase()]
  if (month === undefined) return null
  const day = Number(m[3])
  const hh = Number(m[4])
  const mi = Number(m[5])
  const ss = Number(m[6])
  const yy = Number(m[7])
  const d = new Date(yy, month, day, hh, mi, ss)
  if (d.getFullYear() !== yy || d.getMonth() !== month || d.getDate() !== day) return null
  return Math.floor(d.getTime() / 1000)
}

function isoLocal(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// etime forms: "09-14:42:03" (d-hh:mm:ss), "01:04:41" (hh:mm:ss), "12:48" (mm:ss)
function parseEtime(s: string): number | null {
  const m = s.match(/^(?:(\d+)-)?(\d+):(\d+):(\d+)$/)
  if (m) {
    return Number(m[1] ?? 0) * 86400 + Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4])
  }
  const m2 = s.match(/^(\d+):(\d+)$/)
  if (m2) return Number(m2[1]) * 60 + Number(m2[2])
  return null
}

// ---------------------------------------------------------------------------
// inferType()
// ---------------------------------------------------------------------------

const COMM_RULES: Array<[string, RegExp]> = [
  ["idea", /\b(idea|intellij|jetbrains|pycharm|webstorm|goland|clion|datagrip|phpstorm|rubymine|cef_serve|cef)\b/i],
  ["ai", /\b(ollama|llama|llm|ai-server|cursor|copilot|claude|codex|chatgpt|openai|whisper|stable.?diffusion|comfyui|langchain)\b/i],
  ["docker", /\b(docker|dockerd|containerd|colima|lima)\b/i],
  ["db", /\b(postgres|postmaster|mysql|mariadb|redis|mongod|mongo|memcached|elasticsearch|clickhouse|sqlite|cassandra)\b/i],
  ["java", /\b(java|jvm|kotlin|gradle|maven|tomcat|spring)\b/i],
  ["node", /\b(node|npm|npx|tsx|vite|next|nuxt)\b/i],
  ["bun", /\b(bun|bunx)\b/i],
  ["python", /\b(python|python3|pip|uv|jupyter|django|flask|celery)\b/i],
]

const CMDLINE_RULES: Array<[string, RegExp]> = [
  ["java", /\b(java|jvm|kotlin|gradle|maven|tomcat|spring)\b/i],
  ["node", /\b(node|npm|npx|tsx|vite|next|nuxt)\b/i],
  ["bun", /\b(bun|bunx)\b/i],
  ["python", /\b(python|python3|pip|uv|jupyter|django|flask|celery)\b/i],
  ["idea", /\b(idea|intellij|jetbrains|pycharm|webstorm|goland|clion|datagrip|phpstorm|rubymine|cef_serve|cef)\b/i],
  ["ai", /\b(ollama|llama|llm|ai-server|cursor|copilot|claude|codex|chatgpt|openai|whisper|stable.?diffusion|comfyui|langchain)\b/i],
  ["docker", /\b(docker|dockerd|containerd|colima|lima)\b/i],
  ["db", /\b(postgres|postmaster|mysql|mariadb|redis|mongod|mongo|memcached|elasticsearch|clickhouse|sqlite|cassandra)\b/i],
]

export function inferType(comm: string, cmdline: string): string {
  const c = comm.toLowerCase()
  for (const [type, re] of COMM_RULES) if (re.test(c)) return type
  const cl = cmdline.toLowerCase()
  for (const [type, re] of CMDLINE_RULES) if (re.test(cl)) return type
  return "other"
}

// ---------------------------------------------------------------------------
// smartLabel()
// ---------------------------------------------------------------------------

// FQCN launcher bootstraps → label shown instead of the raw class (noise).
const JVM_BOOTSTRAP_LABELS: Record<string, string> = {
  "com.intellij.rt.execution.application.AppMainV2": "idea-launcher",
  "org.gradle.launcher.daemon.bootstrap.GradleDaemon": "gradle-daemon",
  "org.apache.catalina.startup.Bootstrap": "tomcat",
  "org.jetbrains.kotlin.daemon.KotlinCompileDaemon": "kotlin-daemon",
}

function javaMainClass(cmdline: string): string | null {
  const tokens = cmdline.split(/\s+/)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]
    if (!t) continue
    if (t.includes("=") || t.includes(":")) continue // -D flag or classpath token
    if (!/^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)+$/.test(t)) continue // not an FQCN
    const bootstrap = JVM_BOOTSTRAP_LABELS[t]
    if (bootstrap) return bootstrap
    return t.split(".").pop() ?? null
  }
  return null
}

function scriptBase(cmdline: string): string | null {
  // `node|bun|python3|... /path/to/script.js` → "script" (extension stripped)
  const m = cmdline.match(/(?:^|\s)(?:node|bun|bunx|npx|tsx|deno|python3?|uv|ruby|php)\s+([^\s]+)\.(?:js|mjs|cjs|ts|py|rb|php)\b/i)
  if (m?.[1]) {
    const base = m[1].split("/").pop()
    if (base) return base
  }
  // `python -m uvicorn app.main:app` → last module segment
  const mod = cmdline.match(/(?:^|\s)-m\s+([a-zA-Z_][\w.]*)/)
  if (mod?.[1]) return mod[1].split(".").pop() ?? null
  return null
}

/** Generic comms ("java", "node") → identifiable label (main class / script name). Falls back to comm. */
export function smartLabel(comm: string, cmdline: string): string {
  if (/^java$/i.test(comm) || /\b(?:java|javaw)\b/i.test(cmdline)) {
    const main = javaMainClass(cmdline)
    if (main) return main
    const jar = cmdline.match(/([^/:\s]+\.jar)\s*$/i)?.[1]
    if (jar) return jar
  }
  const script = scriptBase(cmdline)
  if (script) return script
  return comm
}

// ---------------------------------------------------------------------------
// processDetail()
// ---------------------------------------------------------------------------

export async function processDetail(pid: number): Promise<ProcessDetail | null> {
  if (!Number.isInteger(pid) || pid <= 0) return null
  const psP = psSnapshot()
  const [ps, ports] = await Promise.all([psP, listeners(psP)])
  const row = ps.get(pid)
  if (!row) return null
  const [info, cwd, threads] = await Promise.all([lsofInfo(pid), cwdOf(pid), threadCount(pid)])
  const children = [...ps.values()]
    .filter((r) => r.ppid === pid)
    .map((r) => ({ pid: r.pid, name: r.comm, rssBytes: r.rssBytes, cpuPct: r.cpuPct, uptimeSec: r.uptimeSec }))
  const myPorts = ports
    .filter((p) => p.pid === pid)
    .map((p) => ({ port: p.port, protocol: p.protocol, host: p.host, exposed: p.exposed }))
  return {
    pid,
    ppid: row.ppid,
    name: row.comm,
    label: smartLabel(row.comm, row.cmdline),
    type: inferType(row.comm, row.cmdline),
    user: info.user ?? "",
    cmdline: row.cmdline,
    cwd,
    path: info.path,
    startedAt: row.startedAt,
    startedEpoch: row.startedEpoch,
    uptimeSec: row.uptimeSec,
    rssBytes: row.rssBytes,
    cpuPct: row.cpuPct,
    threads,
    ports: myPorts,
    children,
  }
}

// First data row of `lsof -p PID -d txt` carries the executable path (last
// column; the file may contain spaces, so it is everything after token 8).
async function lsofInfo(pid: number): Promise<{ path: string | null; user: string | null }> {
  const res = await run(["lsof", "-p", String(pid), "-d", "txt"], 5000)
  let path: string | null = null
  let user: string | null = null
  for (const line of res.stdout.split("\n")) {
    const tokens = line.split(/\s+/)
    if (tokens.length < 9) continue
    if (tokens[1] !== String(pid)) continue
    if (path === null) {
      const p = tokens.slice(8).join(" ").replace(/ \(deleted\)$/, "")
      if (p) path = p
      user = tokens[2] ?? null
    }
  }
  return { path, user }
}

async function cwdOf(pid: number): Promise<string | null> {
  const res = await run(["lsof", "-a", "-p", String(pid), "-d", "cwd", "-Fn"], 5000)
  for (const line of res.stdout.split("\n")) {
    if (line.startsWith("n")) return line.slice(1) || null
  }
  return null
}

// `ps -M <pid>` prints one line per thread (USER PID TT ... COMMAND).
async function threadCount(pid: number): Promise<number> {
  const res = await run(["ps", "-M", String(pid)], 5000)
  let n = 0
  for (const line of res.stdout.split("\n")) {
    const t = line.trim().split(/\s+/)
    if (t[1] === String(pid)) n++
  }
  return n
}

// ---------------------------------------------------------------------------
// killPid() / killMany()
// ---------------------------------------------------------------------------

function buildChildrenMap(ps: Map<number, PsRow>): Map<number, number[]> {
  const children = new Map<number, number[]>()
  for (const r of ps.values()) {
    const list = children.get(r.ppid) ?? []
    list.push(r.pid)
    children.set(r.ppid, list)
  }
  return children
}

async function sendSignals(
  targets: number[],
  flag: string,
): Promise<{ killed: number[]; failed: string[] }> {
  const killed: number[] = []
  const failed: string[] = []
  for (const t of targets) {
    const res = await run(["kill", flag, String(t)], 3000)
    if (res.exitCode === 0) killed.push(t)
    else failed.push(`${t}: ${res.stderr.trim() || `kill failed (exit ${String(res.exitCode)})`}`)
  }
  await sleep(300)
  const after = await psSnapshot()
  const stillAlive = killed.filter((k) => after.has(k))
  if (stillAlive.length > 0) {
    console.error(`[collet] warning: still alive after ${flag}: ${stillAlive.join(", ")}`)
  }
  return { killed, failed }
}

function collectTreeTargets(
  root: number,
  children: Map<number, number[]>,
  into: Set<number>,
): void {
  const stack: number[] = [root]
  const desc: Array<{ p: number; depth: number }> = []
  while (stack.length > 0) {
    const cur = stack.pop()
    if (cur === undefined) break
    const depth = desc.find((d) => d.p === cur)?.depth ?? 0
    for (const c of children.get(cur) ?? []) {
      desc.push({ p: c, depth: depth + 1 })
      stack.push(c)
      into.add(c)
    }
  }
  desc.sort((a, b) => b.depth - a.depth)
  for (const d of desc) into.add(d.p)
}

export async function killPid(pid: number, opts: { force: boolean; tree: boolean }): Promise<KillResult> {
  const ps = await psSnapshot()
  if (!ps.has(pid)) throw new ApiError(404, "process not found")
  const signal: "SIGTERM" | "SIGKILL" = opts.force ? "SIGKILL" : "SIGTERM"
  const flag = opts.force ? "-KILL" : "-TERM"
  const children = buildChildrenMap(ps)
  const targets: number[] = []
  if (opts.tree) {
    const into = new Set<number>()
    collectTreeTargets(pid, children, into)
    targets.unshift(...into)
  }
  targets.push(pid)
  const { killed, failed } = await sendSignals(targets, flag)
  if (failed.length > 0) {
    const perm = failed.some((f) => /not permitted|operation not permitted/i.test(f))
    if (perm && !opts.tree) throw new ApiError(403, failed[0] ?? "permission denied")
  }
  return { killed, signal, failed }
}

/** Batch kill — one ps snapshot for the whole set; per-pid failures collected. */
export async function killMany(
  pids: number[],
  opts: { force: boolean; tree: boolean },
): Promise<KillResult> {
  const signal: "SIGTERM" | "SIGKILL" = opts.force ? "SIGKILL" : "SIGTERM"
  const flag = opts.force ? "-KILL" : "-TERM"
  if (pids.length === 0) return { killed: [], signal, failed: [] }
  const ps = await psSnapshot()
  const children = buildChildrenMap(ps)
  const targetSet = new Set<number>()
  const failed: string[] = []
  for (const pid of pids) {
    if (!ps.has(pid)) {
      failed.push(`${pid}: process not found`)
      continue
    }
    if (opts.tree) collectTreeTargets(pid, children, targetSet)
    targetSet.add(pid)
  }
  const targets = [...targetSet]
  const { killed } = await sendSignals(targets, flag)
  return { killed, signal, failed }
}

// ---------------------------------------------------------------------------
// overviewStats()
// ---------------------------------------------------------------------------

let machineCache: { hostname: string; arch: string; bootSec: number | null } | null = null

export async function getMachine(): Promise<MachineInfo> {
  if (!machineCache) {
    const [hostname, arch, boottime] = await Promise.all([
      run(["hostname"], 3000),
      run(["uname", "-m"], 3000),
      run(["sysctl", "-n", "kern.boottime"], 3000),
    ])
    let bootSec = parseBoottime(boottime.stdout)
    if (bootSec === null) {
      const up = await run(["uptime"], 3000)
      bootSec = parseUptimeBoot(up.stdout)
    }
    machineCache = {
      hostname: hostname.stdout.trim() || "unknown",
      arch: arch.stdout.trim() || "unknown",
      bootSec,
    }
  }
  const load = await run(["sysctl", "-n", "vm.loadavg"], 3000)
  const loadAvg = parseLoadavg(load.stdout)
  const uptimeSec =
    machineCache.bootSec === null ? 0 : Math.max(0, Math.floor(Date.now() / 1000) - machineCache.bootSec)
  return {
    hostname: machineCache.hostname,
    platform: process.platform,
    arch: machineCache.arch,
    uptimeSec,
    loadAvg,
  }
}

function parseBoottime(s: string): number | null {
  const m = s.match(/sec\s*=\s*(\d+)/)
  return m ? Number(m[1]) : null
}

function parseUptimeBoot(s: string): number | null {
  const m = s.match(/up\s+(?:(\d+)\s+days?,\s+)?(\d+):(\d+)/)
  if (!m) return null
  return Number(m[1] ?? 0) * 86400 + Number(m[2]) * 3600 + Number(m[3]) * 60
}

function parseLoadavg(s: string): [number, number, number] {
  const nums = s.match(/[\d.]+/g)?.map(Number) ?? []
  const a = Number.isFinite(nums[0]) ? (nums[0] as number) : 0
  const b = Number.isFinite(nums[1]) ? (nums[1] as number) : 0
  const c = Number.isFinite(nums[2]) ? (nums[2] as number) : 0
  return [a, b, c]
}

export async function overviewStats(
  ports: PortEntry[],
  ps: Map<number, PsRow>,
): Promise<{ machine: MachineInfo; stats: OverviewStatsData; topRam: TopRamItem[] }> {
  const machine = await getMachine()
  const byPid = new Map<number, PortEntry>()
  for (const p of ports) if (!byPid.has(p.pid)) byPid.set(p.pid, p)
  const pids = [...byPid.keys()]
  const tcpCount = ports.filter((p) => p.protocol === "tcp").length
  const udpCount = ports.length - tcpCount
  const exposedCount = ports.filter((p) => p.exposed).length
  let totalRssBytes = 0
  const byType: Record<string, number> = {}
  const topRam: TopRamItem[] = []
  for (const pid of pids) {
    const entry = byPid.get(pid)
    if (!entry) continue
    const row = ps.get(pid)
    const type = row ? inferType(row.comm, row.cmdline) : entry.type
    byType[type] = (byType[type] ?? 0) + 1
    const rss = row?.rssBytes ?? entry.rssBytes
    totalRssBytes += rss
    topRam.push({ pid, name: row ? smartLabel(row.comm, row.cmdline) : entry.label, rssBytes: rss, port: entry.port })
  }
  topRam.sort((a, b) => b.rssBytes - a.rssBytes)
  return {
    machine,
    stats: {
      listeningCount: ports.length,
      tcpCount,
      udpCount,
      processCount: pids.length,
      exposedCount,
      totalRssBytes,
      byType,
    },
    topRam: topRam.slice(0, 5),
  }
}
