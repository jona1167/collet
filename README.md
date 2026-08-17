<div align="center">

<img src="https://jona1167.github.io/collet/icon.png" alt="collet" width="72">

# collet

**Hold the line.**

A premium dark-first macOS port & process monitor. Watch every socket on your machine, spot what's exposed beyond loopback, and kill it with one click — SIGTERM first, SIGKILL when it's rude.

![Made with Bun](https://img.shields.io/badge/Made_with-Bun-%23fbf0df?style=flat-square&logo=bun&logoColor=white&labelColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white&labelColor=black)
![React 19](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black&labelColor=black)
![Vite 8](https://img.shields.io/badge/Vite_8-646CFF?style=flat-square&logo=vite&logoColor=white&labelColor=black)
![Tailwind v4](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white&labelColor=black)
![macOS](https://img.shields.io/badge/platform-macOS-000000?style=flat-square&logo=apple&logoColor=white&labelColor=black)
![Stars](https://img.shields.io/github/stars/jona1167/collet?style=flat-square&logo=github&logoColor=white&labelColor=black)
![License](https://img.shields.io/github/license/jona1167/collet?style=flat-square&labelColor=black)

</div>

---

Local dev servers, Spring Boot, Docker, LLM services, mDNS noise — everything holding a port on your machine, in one live view. Collet polls `lsof` every 2 seconds, streams every snapshot to your browser over SSE, and gives you the full picture: what's bound, what's exposed beyond loopback, who's eating RAM, and which process to thank (or terminate).

<p align="center">
  <img src="https://jona1167.github.io/collet/screenshots/overview.png" alt="Collet overview" width="880">
</p>

## ✦ What it does

| | |
|---|---|
| **Live port table** | Every listening TCP/UDP socket, refreshed every 2s via SSE with row-level enter/leave animations. Sortable columns, server-side search, filters by process type / exposed / pinned. |
| **Process drawer** | PID, user, threads, RSS, CPU, CWD, executable path, parent, sockets, children — with tabs for Ports / Children / Actions. |
| **Kill flow** | One click to open a kill modal: SIGTERM (graceful) vs SIGKILL (force), optional tree-kill for descendants. Batch-kill from multi-select. |
| **Overview** | Stat cards (listening count, exposed binds, total RSS, processes) with sparklines, a Top RAM panel, and an exposed-port warning banner that jumps to a filtered view. |
| **Pins** | Pin a port and leave a note on it; persists to `~/.collet/pins.json`. |
| **Command palette** | `⌘K` to jump to ports / pins / overview, or inspect & kill a process by name. |

<p align="center">
  <img src="https://jona1167.github.io/collet/screenshots/ports.png" alt="Collet ports table" width="880">
</p>

## ✦ A closer look

<p align="center">
  <img src="https://jona1167.github.io/collet/screenshots/drawer.png" alt="Collet process drawer" width="880">
  <img src="https://jona1167.github.io/collet/screenshots/palette.png" alt="Collet command palette" width="880">
</p>

## ✦ Quick start

Requires [Bun](https://bun.sh) (>= 1.2). macOS only — it reads `lsof` and `ps`.

```bash
bun install          # root + server + web
bun run dev          # server (:5335) + web (:5173) together
```

Then open **http://localhost:5173**.

### Install from a release

Prefer a binary? Grab the latest `collet-<version>-darwin-<arch>.zip` from [Releases](../../releases), unzip it, and run:

```bash
./collet              # standalone binary — serves the built UI + API on :5335
```

Then open **http://localhost:5335**. No Node, no Bun install needed.

| Script | What it does |
|---|---|
| `bun run dev` | concurrently runs `server` (Bun, `--watch`) and `web` (Vite) |
| `bun run build` | typecheck + production build of the frontend (`web/dist`) |
| `bun run start` | run the server alone (serves `web/dist` statically at `:5335`) |
| `bun run install:all` | install root + `server/` + `web/` dependencies |

## ✦ Live demo

👉 **Try it live on GitHub Pages** — no install needed:
https://jona1167.github.io/collet/

Collet is a **local-first** tool — it reads `lsof`/`ps` on your own Mac, so the hosted
demo runs in a built-in demo mode with realistic sample data (add `?demo` to any local
install to preview it too).

```bash
bun run dev          # then open http://localhost:5173
```

<p align="center">
  <img src="https://jona1167.github.io/collet/screenshots/ports.png" alt="Collet ports table" width="880">
</p>

## ✦ Dependencies

Collet runs on [Bun](https://bun.sh) end-to-end (runtime, server, and bundler). The frontend pulls in a small, focused set of libraries:

| Package | Why |
|---|---|
| [React 19](https://react.dev) + [Vite 8](https://vite.dev) | UI and build tooling |
| [Tailwind CSS v4](https://tailwindcss.com) | styling |
| [zustand](https://github.com/pmndrs/zustand) | tiny global state (store, SSE snapshot, pins) |
| [TanStack Table](https://tanstack.com/table) | sortable ports table |
| [cmdk](https://cmdk.paco.me) | `⌘K` command palette |
| [sonner](https://sonner.emilkowal.ski) | toast notifications |

The server has **zero runtime dependencies** — Bun's stdlib plus `lsof`/`ps` is all it needs.

## ✦ Keyboard

`↑` `↓` navigate rows · `↵` open drawer · `X` kill · `Esc` close overlays · `⌘K` command palette · `⌘F` focus search

## ✦ Architecture

```
server/   Bun + lsof/ps collector, SSE fan-out, kill, pins (port 5335)
web/      React + Vite + Tailwind v4 + zustand + TanStack Table (port 5173, proxies /api)
```

- **No broker needed.** One local process, one producer (2s poller), N browser tabs → in-memory Pub/Sub with SSE fan-out. Kafka would be overkill for localhost.
- `GET /api/events` streams a full `snapshot` every 2s; clients diff by `pid:port:protocol` for animations and tick uptime locally every second.
- API contract: [`server/api.md`](server/api.md).

## ✦ Notes

- macOS only (uses `lsof`, `ps`).
- Pins live at `~/.collet/pins.json` (atomic write).
- `kill` requires permission for the target process; non-owners get a 403.

## ✦ License

[MIT](LICENSE) © 2026 Jonathan
