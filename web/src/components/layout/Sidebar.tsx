import { useStore, type View } from "../../lib/store"
import { formatUptime } from "../../lib/format"
import {
  BookmarkIcon,
  CollapseIcon,
  ExpandIcon,
  LayersIcon,
  TableIcon,
} from "../common/Icon"

const NAV: Array<{ view: View; label: string; icon: typeof LayersIcon }> = [
  { view: "overview", label: "Overview", icon: LayersIcon },
  { view: "ports", label: "Ports", icon: TableIcon },
  { view: "pinned", label: "Pinned", icon: BookmarkIcon },
]

export function Sidebar() {
  const collapsed = useStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const overview = useStore((s) => s.overview)
  const pinCount = useStore((s) => s.pins.length)

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="brand">
        <img className="brand-icon" src="/icon.png" alt="collet" />
        {!collapsed && <span className="brand-word">collet</span>}
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ view: v, label, icon: Icon }) => (
          <button
            key={v}
            type="button"
            className={`nav-item ${view === v ? "nav-item--active" : ""}`}
            onClick={() => setView(v)}
            title={collapsed ? label : undefined}
          >
            <span className="nav-icon">
              <Icon size={15} />
            </span>
            {!collapsed && <span>{label}</span>}
            {!collapsed && v === "pinned" && (
              <span className="nav-badge num">{pinCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="machine-stats">
            <span>{overview?.machine.hostname ?? "offline"}</span>
            <span>
              {overview ? formatUptime(overview.machine.uptimeSec) : "—"} uptime
            </span>
          </div>
        )}
        <div className="sidebar-toggle">
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={toggleSidebar}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ExpandIcon size={15} /> : <CollapseIcon size={15} />}
          </button>
        </div>
      </div>
    </aside>
  )
}