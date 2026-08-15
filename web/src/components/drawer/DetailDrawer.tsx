import { useCallback, useEffect, useState } from "react"
import { ApiError, api } from "../../lib/api"
import { useStore } from "../../lib/store"
import type { ProcessDetail } from "../../lib/types"
import {
  formatBytes,
  formatClock,
  formatCpu,
  formatIsoLocal,
  formatRelative,
  formatUptime,
} from "../../lib/format"
import { LocalBadge, TypeChip } from "../common/Chips"
import { RefreshIcon, XIcon } from "../common/Icon"

type Tab = "overview" | "ports" | "children" | "actions"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "ports", label: "Ports" },
  { id: "children", label: "Children" },
  { id: "actions", label: "Actions" },
]

export function DetailDrawer() {
  const pid = useStore((s) => s.selectedPid)
  const closeDrawer = useStore((s) => s.closeDrawer)
  const openKill = useStore((s) => s.openKill)
  const [tab, setTab] = useState<Tab>("overview")
  const [detail, setDetail] = useState<ProcessDetail | null>(null)
  const [gone, setGone] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (pid === null) return
    setLoading(true)
    try {
      const d = await api.process(pid)
      setDetail(d)
      setGone(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setGone(true)
        setDetail(null)
      }
    } finally {
      setLoading(false)
    }
  }, [pid])

  useEffect(() => {
    if (pid === null) return
    setTab("overview")
    setDetail(null)
    setGone(false)
    void load()
    const id = window.setInterval(load, 5000)
    return () => window.clearInterval(id)
  }, [pid, load])

  useEffect(() => {
    if (pid === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pid, closeDrawer])

  if (pid === null) return null

  return (
    <>
      <div className="scrim" onClick={closeDrawer} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Process detail">
        <div className="drawer-head">
          <span className="drawer-title">
            {detail ? detail.label : gone ? "Process" : "…"}
          </span>
          {detail && (
            <>
              <TypeChip type={detail.type} />
              <span className="mono" style={{ color: "var(--text-3)" }}>
                {detail.pid}
              </span>
            </>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--icon drawer-close"
            onClick={closeDrawer}
            aria-label="Close drawer"
          >
            <XIcon size={14} />
          </button>
        </div>

        {!gone && (
          <div className="drawer-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`drawer-tab ${tab === t.id ? "drawer-tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="drawer-body">
          {gone ? (
            <div className="drawer-empty">
              <span className="live-dot" />
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-2)" }}>
                Process gone — released
              </div>
              <div style={{ fontSize: 12 }}>
                pid {pid} no longer holds any listeners.
              </div>
              <button type="button" className="btn" onClick={closeDrawer}>
                Close
              </button>
            </div>
          ) : loading && !detail ? (
            <div className="drawer-empty">
              <span className="spinner" style={{ color: "var(--text-3)" }} />
              <div style={{ fontSize: 12 }}>Reading process…</div>
            </div>
          ) : detail ? (
            <>
              {tab === "overview" && <OverviewTab detail={detail} />}
              {tab === "ports" && <PortsTab detail={detail} />}
              {tab === "children" && <ChildrenTab detail={detail} />}
              {tab === "actions" && (
                <ActionsTab
                  detail={detail}
                  onKill={() =>
                    openKill([
                      {
                        pid: detail.pid,
                        name: detail.label,
                        ports: detail.ports.map((p) => p.port),
                      },
                    ])
                  }
                  onRefresh={() => void load()}
                />
              )}
            </>
          ) : null}
        </div>
      </aside>
    </>
  )
}

function OverviewTab({ detail }: { detail: ProcessDetail }) {
  const now = useStore((s) => s.now)
  return (
    <div>
      <div className="cmdline-block">{detail.cmdline || "—"}</div>
      <div className="kv-grid">
        <KvRow k="User" v={detail.user} />
        <KvRow k="Started" v={`${formatIsoLocal(detail.startedEpoch)} · ${formatRelative(detail.startedEpoch)}`} />
        <KvRow k="Uptime" v={formatUptime(now / 1000 - detail.startedEpoch)} />
        <KvRow k="Threads" v={String(detail.threads)} />
        <KvRow k="RSS" v={formatBytes(detail.rssBytes)} />
        <KvRow k="CPU" v={`${formatCpu(detail.cpuPct)}%`} />
        <KvRow k="CWD" v={detail.cwd ?? "—"} />
        <KvRow k="Path" v={detail.path ?? "—"} />
        <KvRow k="Parent" v={String(detail.ppid)} />
      </div>
    </div>
  )
}

function PortsTab({ detail }: { detail: ProcessDetail }) {
  if (detail.ports.length === 0) {
    return (
      <div className="drawer-empty">
        <span style={{ fontSize: 12 }}>No sockets held by this process.</span>
      </div>
    )
  }
  return (
    <div>
      <div className="section-title">Sockets</div>
      {detail.ports.map((s) => (
        <div className="socket-row" key={`${s.port}:${s.protocol}`}>
          <span className="mono" style={{ color: "var(--text-1)", fontWeight: 600 }}>
            {s.port}
          </span>
          <span className="chip">{s.protocol}</span>
          <span className="mono" style={{ color: "var(--text-3)" }}>
            {s.host}
          </span>
          <LocalBadge exposed={s.exposed} />
        </div>
      ))}
    </div>
  )
}

function ChildrenTab({ detail }: { detail: ProcessDetail }) {
  if (detail.children.length === 0) {
    return (
      <div className="drawer-empty">
        <span style={{ fontSize: 12 }}>No child processes.</span>
      </div>
    )
  }
  return (
    <div>
      <div className="section-title">Direct descendants</div>
      {detail.children.map((c) => (
        <div className="child-row" key={c.pid}>
          <span className="mono" style={{ color: "var(--text-3)" }}>
            {c.pid}
          </span>
          <span className="child-name">{c.name}</span>
          <span className="mono num" style={{ textAlign: "right" }}>
            {formatBytes(c.rssBytes)}
          </span>
          <span className="mono num" style={{ textAlign: "right" }}>
            {formatCpu(c.cpuPct)}%
          </span>
        </div>
      ))}
    </div>
  )
}

function ActionsTab({
  detail,
  onKill,
  onRefresh,
}: {
  detail: ProcessDetail
  onKill: () => void
  onRefresh: () => void
}) {
  return (
    <div>
      <div className="section-title">Process control</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn--danger" onClick={onKill}>
          Kill {detail.label}
        </button>
        <button type="button" className="btn" onClick={onRefresh}>
          <RefreshIcon size={13} />
          Refresh
        </button>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)" }}>
        Started {formatClock(detail.startedEpoch)} · {detail.user}
      </div>
    </div>
  )
}

function KvRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv-row">
      <span className="kv-key">{k}</span>
      <span className="kv-value">{v}</span>
    </div>
  )
}