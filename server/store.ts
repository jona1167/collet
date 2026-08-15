// server/store.ts — polling cache + SSE fan-out.

import {
  listeners,
  psSnapshot,
  overviewStats,
  type PortEntry,
  type PsRow,
  type MachineInfo,
  type OverviewStatsData,
  type TopRamItem,
} from "./proc"
import { pins } from "./pins"

export interface HistorySample {
  t: number
  count: number
  rss: number
}

export interface SnapshotPayload {
  generatedAt: number
  ports: PortEntry[]
}

export interface OverviewPayload {
  generatedAt: number
  machine: MachineInfo
  stats: OverviewStatsData
  topRam: TopRamItem[]
  history: HistorySample[]
}

const envMs = Number.parseInt(process.env.COLLET_POLL_MS ?? process.env.KEEL_POLL_MS ?? "2000", 10)
export const POLL_MS = Number.isFinite(envMs) && envMs >= 250 ? envMs : 2000

class PollStore {
  private ports: PortEntry[] = []
  private ps = new Map<number, PsRow>()
  private overviewParts: { machine: MachineInfo; stats: OverviewStatsData; topRam: TopRamItem[] } | null = null
  private lastTickAt = 0
  private history: HistorySample[] = []
  private subscribers = new Set<(s: SnapshotPayload) => void>()
  private running = false
  private timer: ReturnType<typeof setInterval> | null = null

  get pollIntervalMs(): number {
    return POLL_MS
  }

  get generatedAt(): number {
    return this.lastTickAt
  }

  async refresh(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      const psP = psSnapshot()
      const entries = await listeners(psP)
      const ps = await psP
      await pins.init()
      for (const e of entries) {
        const pin = pins.get(e.port)
        e.pinned = pin !== undefined
        e.note = pin?.note ?? ""
      }
      this.ports = entries
      this.ps = ps
      this.overviewParts = await overviewStats(entries, ps)
      this.lastTickAt = Math.floor(Date.now() / 1000)
      this.history.push({ t: this.lastTickAt, count: entries.length, rss: this.overviewParts.stats.totalRssBytes })
      if (this.history.length > 120) this.history.shift()
      const payload: SnapshotPayload = { generatedAt: this.lastTickAt, ports: entries }
      for (const fn of [...this.subscribers]) {
        try {
          fn(payload)
        } catch {
          this.subscribers.delete(fn)
        }
      }
    } catch (e) {
      console.error("[collet] refresh failed:", e)
    } finally {
      this.running = false
    }
  }

  async start(): Promise<void> {
    await this.refresh()
    this.timer = setInterval(() => void this.refresh(), POLL_MS)
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  currentSnapshot(): SnapshotPayload {
    return { generatedAt: this.lastTickAt || Math.floor(Date.now() / 1000), ports: this.ports }
  }

  getPorts(): PortEntry[] {
    return this.ports
  }

  getOverview(): OverviewPayload {
    const now = Math.floor(Date.now() / 1000)
    const parts = this.overviewParts
    const machine: MachineInfo = parts?.machine ?? {
      hostname: "unknown",
      platform: process.platform,
      arch: "unknown",
      uptimeSec: 0,
      loadAvg: [0, 0, 0],
    }
    const stats: OverviewStatsData = parts?.stats ?? {
      listeningCount: this.ports.length,
      tcpCount: this.ports.filter((p) => p.protocol === "tcp").length,
      udpCount: this.ports.filter((p) => p.protocol === "udp").length,
      processCount: new Set(this.ports.map((p) => p.pid)).size,
      exposedCount: this.ports.filter((p) => p.exposed).length,
      totalRssBytes: 0,
      byType: {},
    }
    return {
      generatedAt: this.lastTickAt || now,
      machine,
      stats,
      topRam: parts?.topRam ?? [],
      history: [...this.history],
    }
  }

  subscribe(fn: (s: SnapshotPayload) => void): () => void {
    this.subscribers.add(fn)
    return () => {
      this.subscribers.delete(fn)
    }
  }
}

export const store = new PollStore()