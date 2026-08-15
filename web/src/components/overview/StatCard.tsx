import { Sparkline } from "../common/Sparkline"

interface StatCardProps {
  label: string
  value: string
  spark: number[]
  warn?: boolean
  delay?: number
}

export function StatCard({ label, value, spark, warn = false, delay = 0 }: StatCardProps) {
  return (
    <div
      className={`card stat-card ${warn ? "stat-card--warn" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{value}</div>
      <div className="stat-spark">
        <Sparkline
          data={spark}
          width={88}
          height={28}
          color={warn ? "var(--chart-3)" : "var(--chart-1)"}
        />
      </div>
    </div>
  )
}