import { useStore, type View } from "../../lib/store"
import { formatTimeOfDay } from "../../lib/format"
import { SearchIcon } from "../common/Icon"

const TITLES: Record<View, { title: string; context: (s: {
  portCount: number
  pinCount: number
}) => string }> = {
  overview: {
    title: "Overview",
    context: () => "Machine pulse",
  },
  ports: {
    title: "Ports",
    context: ({ portCount }) => `${portCount} listener${portCount === 1 ? "" : "s"}`,
  },
  pinned: {
    title: "Pinned",
    context: ({ pinCount }) => `${pinCount} pinned`,
  },
}

export function TopBar() {
  const view = useStore((s) => s.view)
  const serverUp = useStore((s) => s.serverUp)
  const lastRefresh = useStore((s) => s.lastRefresh)
  const setPaletteOpen = useStore((s) => s.setPaletteOpen)
  const portCount = useStore((s) => s.ports.length)
  const pinCount = useStore((s) => s.pins.length)

  const meta = TITLES[view]
  const context = meta.context({ portCount, pinCount })

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1 className="topbar-h1">{meta.title}</h1>
        <span className="topbar-context">{context}</span>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="search-trigger"
          onClick={() => setPaletteOpen(true)}
        >
          <SearchIcon size={13} />
          <span>Search</span>
          <span className="kbd">⌘K</span>
        </button>

        <div className="live-pill" title={serverUp ? "Live — SSE connected" : "Backend unreachable"}>
          <span className={`live-dot ${serverUp ? "" : "live-dot--danger"}`} />
          <span className={`live-label ${serverUp ? "live-label--up" : ""}`}>
            {serverUp ? "LIVE" : "DOWN"}
          </span>
        </div>

        <span className="refresh-tick" title="Last snapshot">
          {lastRefresh > 0 ? formatTimeOfDay(lastRefresh) : "--:--:--"}
        </span>
      </div>
    </header>
  )
}