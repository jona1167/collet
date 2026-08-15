import type {
  KillResponse,
  Overview,
  Pin,
  PinsResponse,
  PortEntry,
  PortsResponse,
  ProcessDetail,
  Settings,
  SnapshotEvent,
} from "./types"

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

const BASE = "/api"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, init)
  } catch {
    throw new ApiError(0, "Backend unreachable")
  }
  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as T
}

export interface PortsParams {
  type?: string
  query?: string
}

export const api = {
  overview: () => request<Overview>("/overview"),

  ports: (params: PortsParams = {}) => {
    const qs = new URLSearchParams()
    if (params.type && params.type !== "all") qs.set("type", params.type)
    if (params.query) qs.set("query", params.query)
    const q = qs.toString()
    return request<PortsResponse>(`/ports${q ? `?${q}` : ""}`)
  },

  process: (pid: number) => request<ProcessDetail>(`/processes/${pid}`),

  kill: (pid: number, opts: { force: boolean; tree: boolean }) =>
    request<KillResponse>(
      `/processes/${pid}?force=${opts.force}&tree=${opts.tree}`,
      { method: "DELETE" },
    ),

  killMany: (pids: number[], opts: { force: boolean; tree: boolean }) =>
    request<KillResponse>("/kill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pids, force: opts.force, tree: opts.tree }),
    }),

  pins: () => request<PinsResponse>("/pins"),

  putPin: (port: number, note: string) =>
    request<{ ok: boolean }>(`/pins/${port}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }),

  deletePin: (port: number) =>
    request<{ ok: boolean }>(`/pins/${port}`, { method: "DELETE" }),

  settings: () => request<Settings>("/settings"),
}

/** EventSource wrapper. EventSource auto-reconnects natively. */
export function connectEvents(
  onSnapshot: (event: SnapshotEvent) => void,
  onStatus: (up: boolean) => void,
): EventSource {
  const es = new EventSource(`${BASE}/events`)
  es.addEventListener("snapshot", (ev) => {
    try {
      onSnapshot(JSON.parse((ev as MessageEvent).data) as SnapshotEvent)
    } catch {
      /* malformed frame — ignore */
    }
  })
  es.onopen = () => onStatus(true)
  es.onerror = () => onStatus(false)
  return es
}

export function isPortEntry(value: unknown): value is PortEntry {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.port === "number" &&
    typeof v.pid === "number" &&
    typeof v.process === "string"
  )
}

export type { Pin }