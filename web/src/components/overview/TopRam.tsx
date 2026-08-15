import type { TopRamEntry } from "../../lib/types"
import { formatBytes } from "../../lib/format"

export function TopRam({ items }: { items: TopRamEntry[] }) {
  if (items.length === 0) return null
  const max = Math.max(...items.map((i) => i.rssBytes), 1)

  return (
    <div className="card" style={{ padding: "12px 8px" }}>
      <div className="panel-title" style={{ padding: "0 8px 8px" }}>
        Top RAM
      </div>
      {items.map((item) => (
        <div className="ram-row" key={item.pid}>
          <div className="ram-meta">
            <span className="ram-name">{item.name}</span>
            <span className="ram-pid mono">{item.pid}</span>
            {item.port > 0 && <span className="ram-port mono">:{item.port}</span>}
          </div>
          <div className="ram-bar-track">
            <div
              className="ram-bar"
              style={{ width: `${Math.max(2, (item.rssBytes / max) * 100)}%` }}
            />
          </div>
          <div className="ram-value mono">{formatBytes(item.rssBytes)}</div>
        </div>
      ))}
    </div>
  )
}