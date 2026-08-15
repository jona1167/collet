import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ApiError, api } from "../../lib/api"
import { useStore } from "../../lib/store"
import { XIcon } from "../common/Icon"

type Signal = "term" | "kill"

/** Kill-confirm modal: signal radio + tree checkbox + danger confirm (single or batch). */
export function KillModal() {
  const targets = useStore((s) => s.killTarget)
  const closeKill = useStore((s) => s.closeKill)
  const [signal, setSignal] = useState<Signal>("term")
  const [tree, setTree] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (targets) {
      setSignal("term")
      setTree(false)
      setBusy(false)
    }
  }, [targets])

  useEffect(() => {
    if (!targets) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeKill()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [targets, closeKill])

  if (!targets || targets.length === 0) return null

  const batch = targets.length > 1
  const pids = targets.map((t) => t.pid)
  const totalPorts = targets.reduce((n, t) => n + t.ports.length, 0)

  const confirm = async () => {
    setBusy(true)
    try {
      const res = batch
        ? await api.killMany(pids, { force: signal === "kill", tree })
        : await api.kill(pids[0]!, { force: signal === "kill", tree })
      if (res.failed.length > 0 && res.killed.length === 0) {
        toast.error(`Nothing killed · ${res.failed[0]}`)
      } else {
        toast.success(
          batch
            ? `${res.signal} sent to ${res.killed.length} process${res.killed.length === 1 ? "" : "es"}`
            : `${res.signal} sent to ${targets[0]!.name} · ${targets[0]!.pid}`,
          { icon: <span style={{ color: "var(--accent)" }}>●</span> },
        )
      }
      // Optimistic removal from the live list
      const killedSet = new Set(res.killed)
      const state = useStore.getState()
      state.setPorts(state.ports.filter((p) => !killedSet.has(p.pid)))
      state.setLeaving((prev) => {
        const n = new Map(prev)
        for (const [k, p] of prev) {
          if (killedSet.has(p.pid)) n.delete(k)
        }
        return n
      })
      state.setSelectedPids((prev) => {
        const n = new Set(prev)
        for (const k of killedSet) n.delete(k)
        return n
      })
      closeKill()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Kill failed"
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  const name = batch
    ? `${targets.length} processes`
    : (targets[0]!.name ?? `pid ${targets[0]!.pid}`)

  return (
    <div className="modal-overlay" onClick={closeKill}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Kill ${name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 className="modal-title">{batch ? "Kill processes" : "Kill process"}</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--small"
            style={{ marginLeft: "auto" }}
            onClick={closeKill}
            aria-label="Close"
          >
            <XIcon size={14} />
          </button>
        </div>

        <div className="modal-target">
          <span className="proc-name">{name}</span>
          {!batch && (
            <span className="mono" style={{ color: "var(--text-3)" }}>
              pid {targets[0]!.pid}
            </span>
          )}
          <span className="modal-ports">
            {batch ? (
              <span className="chip chip--danger">:{totalPorts} ports</span>
            ) : (
              targets[0]!.ports.map((p) => (
                <span key={p} className="chip chip--danger">
                  :{p}
                </span>
              ))
            )}
          </span>
        </div>

        {batch && (
          <div className="modal-target-list">
            {targets.map((t) => (
              <div className="modal-target-row" key={t.pid}>
                <span className="proc-sub">{t.name}</span>
                <span className="mono" style={{ color: "var(--text-3)" }}>
                  pid {t.pid}
                </span>
                <span style={{ marginLeft: "auto" }} />
                <span className="modal-ports">
                  {t.ports.map((p) => (
                    <span key={p} className="chip chip--danger">
                      :{p}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="modal-body">
          <div className="radio-group" role="radiogroup" aria-label="Signal">
            {(
              [
                { value: "term", label: "Terminate", sub: "SIGTERM — graceful shutdown" },
                { value: "kill", label: "Force", sub: "SIGKILL — immediate, may orphan" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={signal === opt.value}
                className={`radio-option ${signal === opt.value ? "radio-option--active" : ""} ${
                  opt.value === "kill" ? "radio-option--danger" : ""
                }`}
                onClick={() => setSignal(opt.value)}
              >
                <span className="radio-mark" />
                <span style={{ fontWeight: 500 }}>{opt.label}</span>
                <span style={{ marginLeft: 4, color: "var(--text-3)", fontSize: 11 }}>
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>

          <label
            className="checkbox-row"
            style={{ cursor: tree ? "default" : "pointer" }}
          >
            <span
              className={`checkbox-box ${tree ? "checkbox-box--checked" : ""}`}
              role="checkbox"
              aria-checked={tree}
            >
              {tree && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </span>
            <input
              type="checkbox"
              checked={tree}
              onChange={(e) => setTree(e.target.checked)}
              style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
              tabIndex={-1}
            />
            Kill child processes (tree)
          </label>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={closeKill} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={confirm}
            disabled={busy}
          >
            {busy && <span className="spinner" />}
            {busy
              ? "Sending…"
              : signal === "kill"
                ? `Force kill ${name}`
                : `Terminate ${name}`}
          </button>
        </div>
      </div>
    </div>
  )
}