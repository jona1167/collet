import { useMemo } from "react"
import { useStore } from "../../lib/store"
import { formatBytes } from "../../lib/format"
import { StatCard } from "./StatCard"
import { TopRam } from "./TopRam"
import { ExposedBanner } from "./ExposedBanner"
import { Skeleton } from "../common/Skeleton"

export function OverviewPage() {
  const overview = useStore((s) => s.overview)
  const ports = useStore((s) => s.ports)

  const exposedPorts = useMemo(
    () => ports.filter((p) => p.exposed).map((p) => p.port),
    [ports],
  )

  if (!overview) {
    return (
      <div className="overview">
        <div className="stat-grid">
          {[0, 1, 2, 3].map((i) => (
            <div className="card stat-card" key={i}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <Skeleton className="h-3 w-20 mb-3" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-full mb-2" />
          ))}
        </div>
      </div>
    )
  }

  const { stats, history, topRam } = overview
  const countSeries = history.map((h) => h.count)
  const rssSeries = history.map((h) => h.rss / 1024 / 1024)

  return (
    <div className="overview">
      <ExposedBanner count={stats.exposedCount} ports={exposedPorts} />

      <div className="stat-grid">
        <StatCard
          label="Listening ports"
          value={String(stats.listeningCount)}
          spark={countSeries}
          delay={0}
        />
        <StatCard
          label="Exposed binds"
          value={String(stats.exposedCount)}
          spark={countSeries}
          warn={stats.exposedCount > 0}
          delay={50}
        />
        <StatCard
          label="Total RSS"
          value={formatBytes(stats.totalRssBytes)}
          spark={rssSeries}
          delay={100}
        />
        <StatCard
          label="Processes holding ports"
          value={String(stats.processCount)}
          spark={countSeries}
          delay={150}
        />
      </div>

      <TopRam items={topRam} />
    </div>
  )
}