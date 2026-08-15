import { useCallback, useEffect, useRef } from "react"
import { api, connectEvents } from "./api"
import { portKey, useStore } from "./store"
import type { PortEntry, SnapshotEvent } from "./types"

/** 1s heartbeat — drives live uptime / RAM cells. */
export function useLiveTick(): void {
  const bumpTick = useStore((s) => s.bumpTick)
  useEffect(() => {
    const id = window.setInterval(bumpTick, 1000)
    return () => window.clearInterval(id)
  }, [bumpTick])
}

/** SSE stream: applies snapshots with row-level enter/leave/change diffing. */
export function usePortsStream(): void {
  const setPorts = useStore((s) => s.setPorts)
  const setPortsLoaded = useStore((s) => s.setPortsLoaded)
  const setServerUp = useStore((s) => s.setServerUp)
  const setLastRefresh = useStore((s) => s.setLastRefresh)
  const setFlashKeys = useStore((s) => s.setFlashKeys)
  const setLeaving = useStore((s) => s.setLeaving)
  const setChangedKeys = useStore((s) => s.setChangedKeys)
  const retryNonce = useStore((s) => s.retryNonce)
  const prevRef = useRef<Map<string, PortEntry>>(new Map())

  const applySnapshot = useCallback(
    (event: SnapshotEvent) => {
      const snap = event.ports
      const next = new Map<string, PortEntry>()
      for (const p of snap) next.set(portKey(p), p)
      const prev = prevRef.current

      const newKeys: string[] = []
      const goneKeys: string[] = []
      const changedKeys: string[] = []
      next.forEach((entry, key) => {
        const old = prev.get(key)
        if (!old) newKeys.push(key)
        else if (old.rssBytes !== entry.rssBytes || old.cpuPct !== entry.cpuPct) {
          changedKeys.push(key)
        }
      })
      prev.forEach((_entry, key) => {
        if (!next.has(key)) goneKeys.push(key)
      })

      if (newKeys.length > 0) {
        const keys = new Set(newKeys)
        setFlashKeys((cur) => new Set([...cur, ...keys]))
        window.setTimeout(() => {
          setFlashKeys((cur) => {
            const n = new Set(cur)
            for (const k of newKeys) n.delete(k)
            return n
          })
        }, 400)
      }
      if (changedKeys.length > 0) {
        const keys = new Set(changedKeys)
        setChangedKeys((cur) => new Set([...cur, ...keys]))
        window.setTimeout(() => {
          setChangedKeys((cur) => {
            const n = new Set(cur)
            for (const k of changedKeys) n.delete(k)
            return n
          })
        }, 900)
      }
      if (goneKeys.length > 0) {
        setLeaving((cur) => {
          const n = new Map(cur)
          for (const k of goneKeys) {
            const entry = prev.get(k)
            if (entry) n.set(k, entry)
          }
          return n
        })
        window.setTimeout(() => {
          setLeaving((cur) => {
            const n = new Map(cur)
            for (const k of goneKeys) n.delete(k)
            return n
          })
        }, 320)
      }

      prevRef.current = next
      setPorts(snap)
      setPortsLoaded(true)
      setLastRefresh(Date.now())
    },
    [setChangedKeys, setFlashKeys, setLastRefresh, setLeaving, setPorts, setPortsLoaded],
  )

  useEffect(() => {
    const es = connectEvents(applySnapshot, setServerUp)
    return () => es.close()
  }, [applySnapshot, retryNonce, setServerUp])
}

/** Overview: fetch on mount, every 30s, and on manual retry. */
export function useOverview(): void {
  const setOverview = useStore((s) => s.setOverview)
  const setServerUp = useStore((s) => s.setServerUp)
  const retryNonce = useStore((s) => s.retryNonce)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await api.overview()
        if (!cancelled) {
          setOverview(data)
          setServerUp(true)
        }
      } catch {
        if (!cancelled) setServerUp(false)
      }
    }
    void load()
    const id = window.setInterval(load, 30000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [retryNonce, setOverview, setServerUp])
}

/** Pins: fetch on mount, every 15s, and on manual retry. */
export function usePins(): void {
  const setPins = useStore((s) => s.setPins)
  const retryNonce = useStore((s) => s.retryNonce)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await api.pins()
        if (!cancelled) setPins(data.pins)
      } catch {
        /* silent — pins are secondary */
      }
    }
    void load()
    const id = window.setInterval(load, 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [retryNonce, setPins])
}

/** Pin mutations with local store sync. */
export function usePinActions(): {
  togglePin: (entry: PortEntry) => Promise<void>
  setNote: (port: number, note: string) => Promise<void>
  unpin: (port: number) => Promise<void>
} {
  const setPins = useStore((s) => s.setPins)
  const setPorts = useStore((s) => s.setPorts)

  const refreshPins = useCallback(async () => {
    try {
      const data = await api.pins()
      setPins(data.pins)
    } catch {
      /* keep current pins */
    }
  }, [setPins])

  const togglePin = useCallback(
    async (entry: PortEntry) => {
      const willPin = !entry.pinned
      try {
        if (willPin) await api.putPin(entry.port, entry.note)
        else await api.deletePin(entry.port)
        await refreshPins()
        setPorts(
          useStore.getState().ports.map((p) =>
            p.pid === entry.pid && p.port === entry.port
              ? { ...p, pinned: willPin }
              : p,
          ),
        )
      } catch {
        /* toast handled by caller if desired */
      }
    },
    [refreshPins, setPorts],
  )

  const setNote = useCallback(
    async (port: number, note: string) => {
      try {
        await api.putPin(port, note)
        await refreshPins()
        setPorts(
          useStore.getState().ports.map((p) =>
            p.port === port ? { ...p, note } : p,
          ),
        )
      } catch {
        /* note save failed — keep server state */
      }
    },
    [refreshPins, setPorts],
  )

  const unpin = useCallback(
    async (port: number) => {
      try {
        await api.deletePin(port)
        await refreshPins()
        setPorts(
          useStore.getState().ports.map((p) =>
            p.port === port ? { ...p, pinned: false } : p,
          ),
        )
      } catch {
        /* ignore */
      }
    },
    [refreshPins, setPorts],
  )

  return { togglePin, setNote, unpin }
}