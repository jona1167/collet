import { create } from "zustand"
import type { Overview, Pin, PortEntry } from "./types"

export type View = "overview" | "ports" | "pinned"

export type TypeFilter =
  | "all"
  | "java"
  | "node"
  | "bun"
  | "python"
  | "idea"
  | "docker"
  | "db"
  | "ai"
  | "other"

export type StatusFilter = "all" | "exposed" | "pinned"

export interface Filters {
  query: string
  type: TypeFilter
  status: StatusFilter
}

export const TYPE_OPTIONS: TypeFilter[] = [
  "all", "java", "node", "bun", "python", "idea", "docker", "db", "ai", "other",
]

export function portKey(p: Pick<PortEntry, "pid" | "port" | "protocol">): string {
  return `${p.pid}:${p.port}:${p.protocol}`
}

export interface KillTarget {
  pid: number
  name: string
  ports: number[]
}

interface AppState {
  view: View
  setView: (view: View) => void

  sidebarCollapsed: boolean
  toggleSidebar: () => void

  ports: PortEntry[]
  setPorts: (ports: PortEntry[]) => void
  portsLoaded: boolean
  setPortsLoaded: (loaded: boolean) => void

  pins: Pin[]
  setPins: (pins: Pin[]) => void

  overview: Overview | null
  setOverview: (overview: Overview | null) => void

  serverUp: boolean
  setServerUp: (up: boolean) => void
  retryNonce: number
  retry: () => void

  filters: Filters
  setFilters: (patch: Partial<Filters>) => void

  selectedPid: number | null
  openDrawer: (pid: number) => void
  closeDrawer: () => void

  killTarget: KillTarget[] | null
  openKill: (targets: KillTarget[]) => void
  closeKill: () => void

  selectedPids: Set<number>
  toggleSelectPid: (pid: number) => void
  setSelectedPids: (update: Set<number> | ((prev: Set<number>) => Set<number>)) => void
  clearSelectedPids: () => void

  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void

  /** Monotonic counter bumped every second — drives live uptime cells. */
  tick: number
  /** Wall-clock ms captured on each tick — avoids Date.now() in render. */
  now: number
  bumpTick: () => void

  lastRefresh: number
  setLastRefresh: (t: number) => void

  flashKeys: Set<string>
  setFlashKeys: (update: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  leaving: Map<string, PortEntry>
  setLeaving: (
    update: Map<string, PortEntry> | ((prev: Map<string, PortEntry>) => Map<string, PortEntry>),
  ) => void
  changedKeys: Set<string>
  setChangedKeys: (update: Set<string> | ((prev: Set<string>) => Set<string>)) => void
}

export const useStore = create<AppState>((set) => ({
  view: "overview",
  setView: (view) => set({ view }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  ports: [],
  setPorts: (ports) => set({ ports }),
  portsLoaded: false,
  setPortsLoaded: (portsLoaded) => set({ portsLoaded }),

  pins: [],
  setPins: (pins) => set({ pins }),

  overview: null,
  setOverview: (overview) => set({ overview }),

  serverUp: true,
  setServerUp: (serverUp) => set({ serverUp }),
  retryNonce: 0,
  retry: () => set((s) => ({ retryNonce: s.retryNonce + 1, serverUp: true })),

  filters: { query: "", type: "all", status: "all" },
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

  selectedPid: null,
  openDrawer: (selectedPid) => set({ selectedPid }),
  closeDrawer: () => set({ selectedPid: null }),

  killTarget: null,
  openKill: (killTarget) => set({ killTarget }),
  closeKill: () => set({ killTarget: null }),

  selectedPids: new Set(),
  toggleSelectPid: (pid) =>
    set((s) => {
      const next = new Set(s.selectedPids)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return { selectedPids: next }
    }),
  setSelectedPids: (update) =>
    set((s) => ({
      selectedPids: typeof update === "function" ? update(s.selectedPids) : update,
    })),
  clearSelectedPids: () => set({ selectedPids: new Set() }),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  tick: 0,
  now: Date.now(),
  bumpTick: () => set((s) => ({ tick: s.tick + 1, now: Date.now() })),

  lastRefresh: 0,
  setLastRefresh: (lastRefresh) => set({ lastRefresh }),

  flashKeys: new Set(),
  setFlashKeys: (update: Set<string> | ((prev: Set<string>) => Set<string>)) =>
    set((s) => ({
      flashKeys:
        typeof update === "function" ? update(s.flashKeys) : update,
    })),
  leaving: new Map(),
  setLeaving: (
    update: Map<string, PortEntry> | ((prev: Map<string, PortEntry>) => Map<string, PortEntry>),
  ) =>
    set((s) => ({
      leaving: typeof update === "function" ? update(s.leaving) : update,
    })),
  changedKeys: new Set(),
  setChangedKeys: (update: Set<string> | ((prev: Set<string>) => Set<string>)) =>
    set((s) => ({
      changedKeys: typeof update === "function" ? update(s.changedKeys) : update,
    })),
}))