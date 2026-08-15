// server/index.ts — collet HTTP server (API per server/api.md + static SPA in prod).

import fs from "node:fs"
import path from "node:path"
import { store } from "./store"
import { pins } from "./pins"
import { killPid, killMany, processDetail, ApiError } from "./proc"
import { handleEvents } from "./events"

const PORT = 5335
const HOST = "127.0.0.1"
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"])
const KNOWN_API_PATHS = new Set(["/api/overview", "/api/ports", "/api/settings", "/api/pins", "/api/events", "/api/kill"])

const distDir = path.resolve(import.meta.dir, "..", "web", "dist")
const serveStatic = process.env.NODE_ENV === "production" || fs.existsSync(distDir)

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin")
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  }
  return {}
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  const body = JSON.stringify(data) ?? ""
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  })
}

function apiError(status: number, message: string, extra: Record<string, string> = {}): Response {
  return json({ error: message }, status, extra)
}

function serveFile(pathname: string, cors: Record<string, string>): Response {
  try {
    const decoded = decodeURIComponent(pathname)
    const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "")
    const full = path.normalize(path.join(distDir, rel))
    if (full !== distDir && !full.startsWith(distDir + path.sep)) {
      return apiError(404, "not found", cors)
    }
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      const ext = path.extname(full).toLowerCase()
      return new Response(Bun.file(full), {
        headers: { ...cors, "Content-Type": MIME[ext] ?? "application/octet-stream" },
      })
    }
    const index = path.join(distDir, "index.html")
    if (fs.existsSync(index)) {
      return new Response(Bun.file(index), {
        headers: { ...cors, "Content-Type": "text/html; charset=utf-8" },
      })
    }
    return apiError(404, "not found", cors)
  } catch {
    return apiError(404, "not found", cors)
  }
}

async function handleFetch(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { pathname } = url
  const cors = corsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  try {
    if (pathname === "/api/overview" && req.method === "GET") {
      return json(store.getOverview(), 200, cors)
    }
    if (pathname === "/api/ports" && req.method === "GET") {
      const typeParam = url.searchParams.get("type") ?? "all"
      const query = (url.searchParams.get("query") ?? "").trim().toLowerCase()
      let ports = store.getPorts()
      if (typeParam === "tcp" || typeParam === "udp") {
        ports = ports.filter((p) => p.protocol === typeParam)
      }
      if (query) {
        ports = ports.filter((p) =>
          `${p.port} ${p.process} ${p.cmdline} ${p.type} ${p.host}`.toLowerCase().includes(query),
        )
      }
      return json({ generatedAt: store.generatedAt, ports }, 200, cors)
    }
    if (pathname === "/api/settings" && req.method === "GET") {
      return json({ pollIntervalMs: store.pollIntervalMs, colletPort: PORT }, 200, cors)
    }
    if (pathname === "/api/pins" && req.method === "GET") {
      return json({ pins: pins.all() }, 200, cors)
    }
    const pinsMatch = pathname.match(/^\/api\/pins\/(\d+)$/)
    if (pinsMatch) {
      const port = Number(pinsMatch[1])
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return apiError(400, "invalid port", cors)
      }
      if (req.method === "PUT") {
        let body: unknown
        try {
          body = await req.json()
        } catch {
          return apiError(400, "invalid JSON body", cors)
        }
        let note = ""
        if (typeof body === "object" && body !== null && "note" in body) {
          const n = body.note
          if (typeof n === "string") note = n
        }
        const pin = pins.set(port, note)
        await pins.persist()
        return json(pin, 200, cors)
      }
      if (req.method === "DELETE") {
        if (!pins.remove(port)) {
          return apiError(404, "pin not found", cors)
        }
        await pins.persist()
        return json({ ok: true }, 200, cors)
      }
      return apiError(405, "method not allowed", cors)
    }
    if (pathname === "/api/kill" && req.method === "POST") {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return apiError(400, "invalid JSON body", cors)
      }
      if (typeof body !== "object" || body === null || !("pids" in body)) {
        return apiError(400, "missing pids", cors)
      }
      const raw = (body as { pids?: unknown }).pids
      if (!Array.isArray(raw) || raw.length === 0) {
        return apiError(400, "pids must be a non-empty array", cors)
      }
      const pids = raw.map(Number)
      if (pids.some((p) => !Number.isInteger(p) || p <= 0)) {
        return apiError(400, "invalid pid", cors)
      }
      const b = body as { force?: unknown; tree?: unknown }
      const force = b.force === true
      const tree = b.tree === true
      try {
        const result = await killMany(pids, { force, tree })
        return json(result, 200, cors)
      } catch (e) {
        if (e instanceof ApiError) return apiError(e.status, e.message, cors)
        throw e
      }
    }
    const procMatch = pathname.match(/^\/api\/processes\/(\d+)$/)
    if (procMatch) {
      const pid = Number(procMatch[1])
      if (!Number.isInteger(pid) || pid <= 0) {
        return apiError(400, "invalid pid", cors)
      }
      if (req.method === "GET") {
        const detail = await processDetail(pid)
        if (!detail) return apiError(404, "process not found", cors)
        return json(detail, 200, cors)
      }
      if (req.method === "DELETE") {
        const force = url.searchParams.get("force") === "true"
        const tree = url.searchParams.get("tree") === "true"
        try {
          const result = await killPid(pid, { force, tree })
          return json(result, 200, cors)
        } catch (e) {
          if (e instanceof ApiError) return apiError(e.status, e.message, cors)
          throw e
        }
      }
      return apiError(405, "method not allowed", cors)
    }
    if (pathname === "/api/events" && req.method === "GET") {
      return handleEvents(req, cors)
    }
    if (pathname.startsWith("/api/")) {
      if (KNOWN_API_PATHS.has(pathname) || /^\/api\/(pins|processes)\/\d+$/.test(pathname)) {
        return apiError(405, "method not allowed", cors)
      }
      return apiError(404, "not found", cors)
    }
    if (serveStatic) {
      return serveFile(pathname, cors)
    }
    return apiError(404, "not found", cors)
  } catch (e) {
    console.error("[collet] request failed:", e)
    return apiError(500, "internal error", cors)
  }
}

await store.start()
const server = Bun.serve({ hostname: HOST, port: PORT, fetch: handleFetch })
console.log(`collet ▸ listening on http://${HOST}:${PORT}`)
if (serveStatic) console.log(`collet ▸ serving static from ${distDir}`)

const shutdown = () => {
  store.stop()
  server.stop(true)
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)