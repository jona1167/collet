import { useStore } from "../../lib/store"

interface ExposedBannerProps {
  count: number
  ports: number[]
}

/** Warn-tinted banner — jumps to the Ports view filtered to exposed. */
export function ExposedBanner({ count, ports }: ExposedBannerProps) {
  const setFilters = useStore((s) => s.setFilters)
  const setView = useStore((s) => s.setView)

  if (count === 0) return null

  const jump = () => {
    setFilters({ status: "exposed" })
    setView("ports")
  }

  return (
    <button type="button" className="banner" onClick={jump}>
      <span className="status-dot status-dot--warn" />
      <span>
        {count} exposed {count === 1 ? "port" : "ports"} reachable beyond loopback
      </span>
      <span className="banner-ports">
        {[...new Set(ports)].slice(0, 3).join(" · ")}
        {new Set(ports).size > 3 ? " ·…" : ""}
      </span>
      <span className="banner-action">View</span>
    </button>
  )
}