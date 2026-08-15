#!/bin/bash
# Collet dev launcher — backend (:5335) + frontend (:5173) together.
# Safe to re-run: frees the ports first, then starts both via root script.
set -e
cd "$(dirname "$0")"

echo "▸ freeing ports 5335 / 5173 ..."
lsof -tiTCP:5335 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
lsof -tiTCP:5173 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

echo "▸ collet dev — server (:5335) + web (:5173)"
bun run dev

# Ctrl+C here stops both (concurrently forwards SIGINT).