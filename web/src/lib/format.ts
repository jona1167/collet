/* Humanizers: bytes, uptime, relative time, clocks. All tabular-safe. */

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—"
  let v = n
  let unit = 0
  while (v >= 1024 && unit < BYTE_UNITS.length - 1) {
    v /= 1024
    unit++
  }
  const digits = v >= 100 || unit === 0 ? v.toFixed(0) : v.toFixed(1)
  return `${digits} ${BYTE_UNITS[unit]}`
}

export function formatUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—"
  const s = Math.floor(sec)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${ss}s`
  return `${ss}s`
}

export function formatRelative(epochSec: number, nowSec = Date.now() / 1000): string {
  const diff = Math.max(0, nowSec - epochSec)
  if (diff < 10) return "just now"
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const

const pad2 = (n: number) => String(n).padStart(2, "0")

/** "14 Aug 09:12" — local clock from unix seconds. */
export function formatClock(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** "09:12:41" — time-of-day from epoch ms (refresh tick). */
export function formatTimeOfDay(epochMs: number): string {
  const d = new Date(epochMs)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/** ISO local time for tooltips. */
export function formatIsoLocal(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()
  return iso.replace("T", " ").slice(0, 19)
}

export function formatCpu(pct: number): string {
  if (!Number.isFinite(pct)) return "—"
  return pct.toFixed(1)
}

export function formatHost(host: string): string {
  if (host === "*") return "*"
  if (host === "0.0.0.0") return "0.0.0.0"
  return host
}