// server/pins.ts — pin persistence at ~/.collet/pins.json (atomic tmp+rename).

import os from "node:os"
import path from "node:path"
import fs from "node:fs"

export interface Pin {
  port: number
  note: string
  createdAt: number
}

const pinsPath = path.join(os.homedir(), ".collet", "pins.json")

function parsePin(v: unknown): Pin | null {
  if (typeof v !== "object" || v === null) return null
  const o = v as Record<string, unknown>
  const port = o.port
  const note = o.note
  const createdAt = o.createdAt
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) return null
  if (typeof note !== "string") return null
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) return null
  return { port, note, createdAt }
}

class PinStore {
  private pins = new Map<number, Pin>()
  private loaded = false

  async init(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      const f = Bun.file(pinsPath)
      if (!(await f.exists())) return
      const raw: unknown = JSON.parse(await f.text())
      if (typeof raw !== "object" || raw === null || !("pins" in raw)) return
      const list = raw.pins
      if (!Array.isArray(list)) return
      for (const item of list) {
        const pin = parsePin(item)
        if (pin) this.pins.set(pin.port, pin)
      }
    } catch (e) {
      console.error("[collet] failed to load pins:", e)
    }
  }

  get(port: number): Pin | undefined {
    return this.pins.get(port)
  }

  set(port: number, note: string): Pin {
    const existing = this.pins.get(port)
    const pin: Pin = existing ?? { port, note: "", createdAt: Math.floor(Date.now() / 1000) }
    pin.note = note
    this.pins.set(port, pin)
    return pin
  }

  remove(port: number): boolean {
    return this.pins.delete(port)
  }

  all(): Pin[] {
    return [...this.pins.values()].sort((a, b) => a.port - b.port)
  }

  async persist(): Promise<void> {
    try {
      fs.mkdirSync(path.dirname(pinsPath), { recursive: true })
      const tmp = `${pinsPath}.tmp`
      await Bun.write(tmp, JSON.stringify({ pins: this.all() }, null, 2))
      fs.renameSync(tmp, pinsPath)
    } catch (e) {
      console.error("[collet] failed to save pins:", e)
    }
  }
}

export const pins = new PinStore()
