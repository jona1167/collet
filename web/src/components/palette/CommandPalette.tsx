import { useEffect, useMemo, useState } from "react"
import { Command } from "cmdk"
import { portKey, useStore } from "../../lib/store"
import { SearchIcon, XIcon } from "../common/Icon"

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen)
  const setOpen = useStore((s) => s.setPaletteOpen)
  const ports = useStore((s) => s.ports)
  const pins = useStore((s) => s.pins)
  const openDrawer = useStore((s) => s.openDrawer)
  const setView = useStore((s) => s.setView)
  const [query, setQuery] = useState("")

  // ⌘K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(!useStore.getState().paletteOpen)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setOpen])

  // Esc closes
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, setOpen])

  const matchedPorts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ports.slice(0, 8)
    return ports
      .filter(
        (p) =>
          String(p.port).includes(q) ||
          p.label.toLowerCase().includes(q) ||
          p.process.toLowerCase().includes(q) ||
          p.cmdline.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [ports, query])

  if (!open) return null

  const close = () => setOpen(false)

  return (
    <div className="palette-overlay" onClick={close}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <Command label="Command palette">
          <div className="palette-input">
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search ports, processes, actions…"
              autoFocus
            />
            <kbd className="palette-esc" aria-hidden="true">
              esc
            </kbd>
            <button
              type="button"
              className="btn btn--ghost btn--icon btn--small palette-close"
              onClick={close}
              aria-label="Close"
              title="Close (esc)"
            >
              <XIcon size={14} />
            </button>
          </div>
          <Command.List>
            <Command.Empty>No results for “{query}”</Command.Empty>

            <Command.Group heading="Ports">
              {matchedPorts.map((p) => (
                <Command.Item
                  key={portKey(p)}
                  value={`port ${p.port} ${p.label} ${p.process} ${p.pid}`}
                  onSelect={() => {
                    openDrawer(p.pid)
                    close()
                  }}
                >
                  <span className="mono" style={{ color: "var(--text-1)", fontWeight: 600, minWidth: 44 }}>
                    {p.port}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.label}
                    {p.label !== p.process && (
                      <span style={{ color: "var(--text-3)", fontSize: 11 }}> · {p.process}</span>
                    )}
                  </span>
                  <span className="mono" style={{ marginLeft: "auto", color: "var(--text-3)" }}>
                    {p.pid}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Actions">
              <Command.Item
                value="inspect pid"
                onSelect={() => {
                  setView("ports")
                  close()
                }}
              >
                <SearchIcon size={13} />
                Inspect PID…
              </Command.Item>
              <Command.Item
                value="kill pid"
                onSelect={() => {
                  setView("ports")
                  close()
                }}
              >
                <span style={{ color: "var(--danger)" }}>Kill PID…</span>
              </Command.Item>
              <Command.Item
                value="toggle pin"
                onSelect={() => {
                  setView("pinned")
                  close()
                }}
              >
                Toggle pin
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Views">
              <Command.Item
                value="view overview"
                onSelect={() => {
                  setView("overview")
                  close()
                }}
              >
                Overview
              </Command.Item>
              <Command.Item
                value="view ports"
                onSelect={() => {
                  setView("ports")
                  close()
                }}
              >
                Ports
              </Command.Item>
              <Command.Item
                value="view pinned"
                onSelect={() => {
                  setView("pinned")
                  close()
                }}
              >
                Pinned
                <span className="mono" style={{ marginLeft: "auto", color: "var(--text-3)" }}>
                  {pins.length}
                </span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="palette-footer">
            <span><kbd>↑↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </div>
  )
}