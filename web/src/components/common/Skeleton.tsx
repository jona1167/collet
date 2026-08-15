import type { ReactNode } from "react"

/** Skeleton block with 1.2s shimmer. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

/** Skeleton table rows matching the real table layout. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {["Port", "Protocol", "Host", "Process", "PID", "Started", "Uptime", "RAM", "CPU%", ""].map(
              (h) => (
                <th key={h}>{h}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} style={{ cursor: "default" }}>
              <td><Skeleton className="h-3 w-10" /></td>
              <td><Skeleton className="h-3 w-8" /></td>
              <td><Skeleton className="h-3 w-12" /></td>
              <td><Skeleton className="h-3 w-24" /></td>
              <td><Skeleton className="h-3 w-8" /></td>
              <td><Skeleton className="h-3 w-16" /></td>
              <td><Skeleton className="h-3 w-12" /></td>
              <td><Skeleton className="h-3 w-14" /></td>
              <td><Skeleton className="h-3 w-10" /></td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Centered designed empty state — never a bare "no data". */
export function EmptyState({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-square" />
      <div className="empty-title">{title}</div>
      {hint ? <div className="empty-hint">{hint}</div> : null}
      {children}
    </div>
  )
}