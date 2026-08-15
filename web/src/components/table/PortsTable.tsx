import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  getCoreRowModel,
  getSortedRowModel,
  legacyCreateColumnHelper,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy"
import { api } from "../../lib/api"
import { portKey, useStore, type KillTarget } from "../../lib/store"
import { usePinActions } from "../../lib/hooks"
import type { PortEntry } from "../../lib/types"
import { FilterBar } from "./FilterBar"
import { PortRow } from "./PortRow"
import { EmptyState, TableSkeleton } from "../common/Skeleton"
import { SortIcon } from "../common/Icon"

const columnHelper = legacyCreateColumnHelper<PortEntry>()

const COLUMNS: LegacyColumnDef<PortEntry, any>[] = [
  columnHelper.accessor("port", { header: "Port" }),
  columnHelper.accessor("protocol", { header: "Protocol" }),
  columnHelper.accessor("host", { header: "Host" }),
  columnHelper.accessor("process", { header: "Process" }),
  columnHelper.accessor("pid", { header: "PID" }),
  columnHelper.accessor("startedEpoch", { header: "Started" }),
  columnHelper.accessor("uptimeSec", { header: "Uptime" }),
  columnHelper.accessor("rssBytes", { header: "RAM" }),
  columnHelper.accessor("cpuPct", { header: "CPU%" }),
]

export function PortsPage() {
  const ports = useStore((s) => s.ports)
  const portsLoaded = useStore((s) => s.portsLoaded)
  const leaving = useStore((s) => s.leaving)
  const flashKeys = useStore((s) => s.flashKeys)
  const changedKeys = useStore((s) => s.changedKeys)
  const filters = useStore((s) => s.filters)
  const openDrawer = useStore((s) => s.openDrawer)
  const openKill = useStore((s) => s.openKill)
  const selectedPids = useStore((s) => s.selectedPids)
  const toggleSelectPid = useStore((s) => s.toggleSelectPid)
  const setSelectedPids = useStore((s) => s.setSelectedPids)
  const clearSelectedPids = useStore((s) => s.clearSelectedPids)
  const { togglePin } = usePinActions()
  const [cursor, setCursor] = useState(-1)
  const [filtered, setFiltered] = useState<PortEntry[] | null>(null)
  const tbodyRef = useRef<HTMLTableSectionElement>(null)
  const modalOpen = useStore((s) => s.killTarget !== null || s.paletteOpen)

  const serverFiltered = filters.query !== ""

  // Server-side filtering via ?query= (port/process/cmdline substring)
  useEffect(() => {
    if (!serverFiltered) {
      setFiltered(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await api.ports({ query: filters.query })
        if (!cancelled) setFiltered(res.ports)
      } catch {
        /* keep last filtered result */
      }
    }
    void load()
    const id = window.setInterval(load, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [serverFiltered, filters.query])

  // Base list: server-filtered when querying, else full SSE snapshot
  const base = filtered ?? ports

  // Client-side category + status filtering
  const rows = useMemo(() => {
    let list = base
    if (filters.type !== "all") list = list.filter((p) => p.type === filters.type)
    if (filters.status === "exposed") list = list.filter((p) => p.exposed)
    if (filters.status === "pinned") list = list.filter((p) => p.pinned)
    if (serverFiltered) return list
    // append leaving rows only when showing the live full list
    const keySet = new Set(list.map((p) => portKey(p)))
    const extras: PortEntry[] = []
    leaving.forEach((p, k) => {
      if (!keySet.has(k)) extras.push(p)
    })
    return extras.length > 0 ? [...list, ...extras] : list
  }, [base, filters.status, leaving, serverFiltered])

  const table = useLegacyTable({
    data: rows,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => portKey(row),
    initialState: {
      sorting: [{ id: "port", desc: false }],
    },
  })

  const sortedRows = table.getRowModel().rows
  const cursorPid = cursor >= 0 ? sortedRows[cursor]?.original.pid : undefined

  // Select-all over the current (filtered+sorted) view, keyed by pid
  const visiblePids = [...new Set(rows.map((p) => p.pid))]
  const allSelected = visiblePids.length > 0 && visiblePids.every((p) => selectedPids.has(p))
  const someSelected = visiblePids.some((p) => selectedPids.has(p))

  const toggleSelectAll = () => {
    setSelectedPids((prev) => {
      const next = new Set(prev)
      for (const p of visiblePids) {
        if (allSelected) next.delete(p)
        else next.add(p)
      }
      return next
    })
  }

  // Batch kill targets: group selected entries by pid, merge their ports
  const selectedTargets = useMemo(() => {
    const byPid = new Map<number, KillTarget>()
    for (const p of base) {
      if (!selectedPids.has(p.pid)) continue
      const t = byPid.get(p.pid)
      if (t) t.ports.push(p.port)
      else byPid.set(p.pid, { pid: p.pid, name: p.label, ports: [p.port] })
    }
    return [...byPid.values()]
  }, [base, selectedPids])

  // Keyboard: ↑↓ navigate, Enter open, X kill, esc clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        modalOpen ||
        (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"))
      ) {
        return
      }
      if (e.key === "Escape") {
        setCursor(-1)
        return
      }
      if (sortedRows.length === 0) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, sortedRows.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      } else if (e.key === "Enter" && cursorPid !== undefined) {
        e.preventDefault()
        openDrawer(cursorPid)
      } else if (e.key.toLowerCase() === "x" && cursorPid !== undefined) {
        e.preventDefault()
        const entry = sortedRows[cursor]?.original
        if (entry) {
          openKill([{ pid: entry.pid, name: entry.label, ports: [entry.port] }])
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sortedRows, cursor, cursorPid, openDrawer, openKill, modalOpen])

  // Keep cursor row visible
  useEffect(() => {
    if (cursor < 0) return
    tbodyRef.current
      ?.querySelector(`tr[data-row-key]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [cursor])

  const handleOpen = useCallback(
    (pid: number) => {
      openDrawer(pid)
    },
    [openDrawer],
  )

  const handleKill = useCallback(
    (entry: PortEntry) => {
      openKill([{ pid: entry.pid, name: entry.label, ports: [entry.port] }])
    },
    [openKill],
  )

  const handleBatchKill = useCallback(() => {
    if (selectedTargets.length > 0) openKill(selectedTargets)
  }, [selectedTargets, openKill])

  const handlePin = useCallback(
    (entry: PortEntry) => {
      void togglePin(entry)
    },
    [togglePin],
  )

  if (!portsLoaded && filtered === null) {
    return (
      <div className="ports-page">
        <FilterBar />
        <TableSkeleton />
      </div>
    )
  }

  if (sortedRows.length === 0 && leaving.size === 0) {
    return (
      <div className="ports-page">
        <FilterBar />
        <div className="table-wrap">
          <EmptyState
            title="Nothing holding the line"
            hint="No listening ports match. Start a server and it will appear here within two seconds."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="ports-page">
      <FilterBar />
      {selectedPids.size > 0 && (
        <div className="batch-bar">
          <div className="batch-group">
            <span className="batch-count">
              {selectedPids.size} process{selectedPids.size === 1 ? "" : "es"} selected
            </span>
            <span className="batch-hint">
              {selectedTargets.length} pid{selectedTargets.length === 1 ? "" : "s"} ·{" "}
              {selectedTargets.reduce((n, t) => n + t.ports.length, 0)} ports
            </span>
          </div>
          <span className="batch-divider" aria-hidden="true" />
          <div className="batch-actions">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={clearSelectedPids}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn--danger btn--small"
              onClick={handleBatchKill}
              disabled={selectedTargets.length === 0}
            >
              Kill {selectedTargets.length} process{selectedTargets.length === 1 ? "" : "es"}
            </button>
          </div>
        </div>
      )}
      <div
        className={`table-wrap${selectedPids.size > 0 ? " table-wrap--batch" : ""}`}
      >
        <table className="table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                <th className="th-select" aria-label="Select all">
                  <label
                    className="select-box"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible"
                    />
                    <span
                      className={`checkbox-box ${allSelected ? "checkbox-box--checked" : ""}`}
                      aria-hidden="true"
                    >
                      {(allSelected || someSelected) && (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                          <path
                            d={someSelected && !allSelected ? "M2.5 5h5" : "M2 5l2 2 4-4"}
                            stroke="#fff"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </span>
                  </label>
                </th>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      data-sorted={sorted ? "true" : undefined}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : "none"
                      }
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className="th-btn"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {String(header.column.columnDef.header)}
                          <span className="th-sort">
                            <SortIcon size={11} />
                          </span>
                        </button>
                      )}
                    </th>
                  )
                })}
                <th data-sorted={undefined} aria-label="Actions" />
              </tr>
            ))}
          </thead>
          <tbody ref={tbodyRef}>
            {sortedRows.map((row, i) => {
              const entry = row.original
              const key = portKey(entry)
              return (
                <PortRow
                  key={key}
                  entry={entry}
                  flash={flashKeys.has(key)}
                  leaving={leaving.has(key)}
                  changed={changedKeys.has(key)}
                  cursor={i === cursor}
                  selected={selectedPids.has(entry.pid)}
                  onSelect={toggleSelectPid}
                  onOpen={handleOpen}
                  onPin={handlePin}
                  onKill={handleKill}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}