/* Types mirroring server/api.md exactly. */

export type Protocol = "tcp" | "udp"

export type ProcessType =
  | "java"
  | "node"
  | "bun"
  | "python"
  | "idea"
  | "docker"
  | "db"
  | "ai"
  | "other"

export interface PortEntry {
  port: number
  protocol: Protocol
  host: string
  local: boolean
  exposed: boolean
  pid: number
  process: string
  label: string
  cmdline: string
  type: ProcessType
  user: string
  startedAt: string
  startedEpoch: number
  uptimeSec: number
  rssBytes: number
  cpuPct: number
  pinned: boolean
  note: string
}

export interface ProcessSocket {
  port: number
  protocol: string
  host: string
  exposed: boolean
}

export interface ProcessChild {
  pid: number
  name: string
  rssBytes: number
  cpuPct: number
  uptimeSec: number
}

export interface ProcessDetail {
  pid: number
  ppid: number
  name: string
  label: string
  type: ProcessType
  user: string
  cmdline: string
  cwd: string | null
  path: string | null
  startedAt: string
  startedEpoch: number
  uptimeSec: number
  rssBytes: number
  cpuPct: number
  threads: number
  ports: ProcessSocket[]
  children: ProcessChild[]
}

export interface MachineInfo {
  hostname: string
  platform: string
  arch: string
  uptimeSec: number
  loadAvg: number[]
}

export interface OverviewStats {
  listeningCount: number
  tcpCount: number
  udpCount: number
  processCount: number
  exposedCount: number
  totalRssBytes: number
  byType: Record<string, number>
}

export interface TopRamEntry {
  pid: number
  name: string
  rssBytes: number
  port: number
}

export interface HistoryPoint {
  t: number
  count: number
  rss: number
}

export interface Overview {
  generatedAt: number
  machine: MachineInfo
  stats: OverviewStats
  topRam: TopRamEntry[]
  history: HistoryPoint[]
}

export interface PortsResponse {
  generatedAt: number
  ports: PortEntry[]
}

export interface Pin {
  port: number
  note: string
  createdAt: number
}

export interface PinsResponse {
  pins: Pin[]
}

export interface KillResponse {
  killed: number[]
  signal: string
  failed: string[]
}

export interface SnapshotEvent {
  generatedAt: number
  ports: PortEntry[]
}

export interface Settings {
  pollIntervalMs: number
  colletPort: number
}