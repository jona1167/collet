import { useEffect, useRef } from "react"
import { TYPE_OPTIONS, useStore, type StatusFilter, type TypeFilter } from "../../lib/store"
import { SearchIcon } from "../common/Icon"

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All",
  java: "Java",
  node: "Node",
  bun: "Bun",
  python: "Python",
  idea: "IDE",
  docker: "Docker",
  db: "DB",
  ai: "AI",
  other: "Other",
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "exposed", label: "Exposed" },
  { value: "pinned", label: "Pinned" },
]

export function FilterBar() {
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)
  const searchRef = useRef<HTMLInputElement>(null)

  // ⌘F focuses the table search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="filter-bar">
      <div className="filter-search">
        <span className="filter-search-icon">
          <SearchIcon size={13} />
        </span>
        <input
          ref={searchRef}
          className="input"
          type="text"
          placeholder="Filter port, process, command…"
          value={filters.query}
          onChange={(e) => setFilters({ query: e.target.value })}
          spellCheck={false}
        />
      </div>

      <div className="filter-group">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t}
            type="button"
            className={`filter-chip ${filters.type === t ? "filter-chip--active" : ""}`}
            onClick={() => setFilters({ type: t })}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="filter-divider" />

      <div className="filter-group">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`filter-chip ${filters.status === value ? "filter-chip--active" : ""}`}
            onClick={() => setFilters({ status: value })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}