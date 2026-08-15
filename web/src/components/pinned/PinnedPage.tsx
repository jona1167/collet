import { useState } from "react"
import { useStore } from "../../lib/store"
import { usePinActions } from "../../lib/hooks"
import { formatRelative } from "../../lib/format"
import { EmptyState } from "../common/Skeleton"
import { EyeIcon, PinIcon, XIcon } from "../common/Icon"

export function PinnedPage() {
  const pins = useStore((s) => s.pins)
  const ports = useStore((s) => s.ports)
  const openDrawer = useStore((s) => s.openDrawer)
  const { setNote, unpin } = usePinActions()

  if (pins.length === 0) {
    return (
      <div className="pinned-grid">
        <div className="table-wrap" style={{ gridColumn: "1 / -1" }}>
          <EmptyState
            title="Nothing pinned"
            hint="Pin a port from the Ports table to keep a note on it here. Pins persist across restarts."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="pinned-grid">
      {pins.map((pin) => {
        const entry = ports.find((p) => p.port === pin.port)
        return (
          <div className="card pinned-card" key={pin.port}>
            <div className="pinned-head">
              <span className="status-dot status-dot--ok" style={{ background: "var(--accent)" }} />
              <span className="pinned-port mono">{pin.port}</span>
              {entry && (
                <span className="chip">{entry.process}</span>
              )}
              <button
                type="button"
                className="btn btn--ghost btn--icon btn--small"
                style={{ marginLeft: "auto" }}
                title="Unpin"
                aria-label={`Unpin port ${pin.port}`}
                onClick={() => void unpin(pin.port)}
              >
                <XIcon size={13} />
              </button>
            </div>

            <NoteEditor port={pin.port} note={pin.note} onSave={setNote} />

            <div className="pinned-meta mono">
              pinned {formatRelative(pin.createdAt)}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn--small"
                disabled={!entry}
                onClick={() => entry && openDrawer(entry.pid)}
              >
                <EyeIcon size={13} />
                Open
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => void unpin(pin.port)}
              >
                <PinIcon size={13} />
                Unpin
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NoteEditor({
  port,
  note,
  onSave,
}: {
  port: number
  note: string
  onSave: (port: number, note: string) => Promise<void>
}) {
  const [value, setValue] = useState(note)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (value === note) return
    setSaving(true)
    await onSave(port, value)
    setSaving(false)
  }

  return (
    <input
      className={`note-input ${value ? "note-input--filled" : ""}`}
      placeholder="Add a note…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
      }}
      disabled={saving}
      spellCheck={false}
    />
  )
}