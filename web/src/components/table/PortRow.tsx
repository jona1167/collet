import { memo } from "react"
import type { PortEntry } from "../../lib/types"
import { useStore } from "../../lib/store"
import { formatBytes, formatClock, formatCpu, formatIsoLocal, formatUptime } from "../../lib/format"
import { LocalBadge, ProtocolChip, TypeChip } from "../common/Chips"
import { EyeIcon, KillIcon, PinIcon } from "../common/Icon"

interface PortRowProps {
  entry: PortEntry
  flash: boolean
  leaving: boolean
  changed: boolean
  cursor: boolean
  selected: boolean
  onSelect: (pid: number) => void
  onOpen: (pid: number) => void
  onPin: (entry: PortEntry) => void
  onKill: (entry: PortEntry) => void
}

/** Live uptime cell — re-renders from the 1s store tick, never from SSE. */
function UptimeCell({ startedEpoch }: { startedEpoch: number }) {
  const now = useStore((s) => s.now)
  return <span className="cell-time">{formatUptime(now / 1000 - startedEpoch)}</span>
}

export const PortRow = memo(function PortRow({
  entry,
  flash,
  leaving,
  changed,
  cursor,
  selected,
  onSelect,
  onOpen,
  onPin,
  onKill,
}: PortRowProps) {
  const open = () => onOpen(entry.pid)

  const rowClass = [
    flash ? "row-enter" : "",
    leaving ? "row-leave" : "",
    cursor ? "row-cursor" : "",
    selected ? "row-selected" : "",
  ]
    .filter(Boolean)
    .join("")

  return (
    <tr
      className={rowClass}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          open()
        }
      }}
      tabIndex={0}
      data-row-key={`${entry.pid}:${entry.port}:${entry.protocol}`}
    >
      <td className="cell-select">
        <label
          className="select-box"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(entry.pid)}
            aria-label={`Select pid ${entry.pid}`}
          />
          <span className={`checkbox-box ${selected ? "checkbox-box--checked" : ""}`} aria-hidden="true">
            {selected && (
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </span>
        </label>
      </td>
      <td className="cell-port">
        {entry.pinned && (
          <span
            className="status-dot"
            style={{ background: "var(--accent)", marginRight: 6, verticalAlign: 1 }}
            aria-label="pinned"
          />
        )}
        {entry.port}
      </td>
      <td>
        <ProtocolChip protocol={entry.protocol} />
      </td>
      <td>
        <span
          className="mono"
          style={{ display: "inline-block", minWidth: 72, marginRight: 6, color: "var(--text-2)" }}
        >
          {entry.host}
        </span>
        <LocalBadge exposed={entry.exposed} />
      </td>
      <td>
        <span className="proc-name">{entry.label}</span>
        {entry.label !== entry.process && <span className="proc-sub">{entry.process}</span>}{" "}
        <TypeChip type={entry.type} />
      </td>
      <td className="cell-pid">{entry.pid}</td>
      <td className="cell-time" title={`Started ${formatIsoLocal(entry.startedEpoch)}`}>
        {formatClock(entry.startedEpoch)}
      </td>
      <td>
        <UptimeCell startedEpoch={entry.startedEpoch} />
      </td>
      <td className={`cell-num ${changed ? "cell-changed" : ""}`}>
        {formatBytes(entry.rssBytes)}
      </td>
      <td className={`cell-num ${changed ? "cell-changed" : ""}`}>
        {formatCpu(entry.cpuPct)}
      </td>
      <td className="note-cell" title={entry.note || undefined}>
        {entry.pinned && entry.note ? entry.note : ""}
      </td>
      <td className="actions-cell">
        <span className="row-actions">
          <button
            type="button"
            className={`btn btn--ghost btn--icon btn--small ${entry.pinned ? "btn-icon-pin--active" : ""}`}
            title={entry.pinned ? "Unpin" : "Pin port"}
            aria-label={entry.pinned ? "Unpin" : "Pin port"}
            onClick={(e) => {
              e.stopPropagation()
              onPin(entry)
            }}
          >
            <PinIcon size={13} />
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--small"
            title="Inspect process"
            aria-label="Inspect process"
            onClick={(e) => {
              e.stopPropagation()
              open()
            }}
          >
            <EyeIcon size={13} />
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--small"
            title="Kill process"
            aria-label="Kill process"
            onClick={(e) => {
              e.stopPropagation()
              onKill(entry)
            }}
          >
            <KillIcon size={13} />
          </button>
        </span>
      </td>
    </tr>
  )
})