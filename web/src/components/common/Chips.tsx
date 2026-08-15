import type { Protocol, ProcessType } from "../../lib/types"

const TYPE_LABELS: Record<ProcessType, string> = {
  java: "java",
  node: "node",
  bun: "bun",
  python: "python",
  idea: "idea",
  docker: "docker",
  db: "db",
  ai: "ai",
  other: "other",
}

/** Process category chip — neutral surface-2, mono 10px. */
export function TypeChip({ type }: { type: ProcessType }) {
  return <span className="chip">{TYPE_LABELS[type] ?? "other"}</span>
}

/** Protocol chip — tcp neutral, udp info-tinted. */
export function ProtocolChip({ protocol }: { protocol: Protocol }) {
  return (
    <span className={`chip ${protocol === "udp" ? "chip--warn" : ""}`}>
      {protocol}
    </span>
  )
}

export function LocalBadge({ exposed }: { exposed: boolean }) {
  return (
    <span className={`chip ${exposed ? "chip--warn" : "chip--ok"}`}>
      {exposed ? "exposed" : "local"}
    </span>
  )
}

/** Pinned marker in table rows — small volt-filled dot. */
export function PinnedDot() {
  return <span className="status-dot status-dot--ok" style={{ background: "var(--accent)" }} aria-label="pinned" />
}