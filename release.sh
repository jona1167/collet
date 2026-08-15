#!/bin/bash
# collet release builder — standalone macOS binary + built frontend, zipped.
# Usage: ./release.sh [version]   (version defaults to the nearest git tag or 0.1.0)
set -euo pipefail
cd "$(dirname "$0")"

VER="${1:-$(git describe --tags --abbrev=0 2>/dev/null || echo 0.1.0)}"
ARCH="$(uname -m)"
OUT="dist/release"
ZIP="dist/collet-${VER}-darwin-${ARCH}.zip"

echo "▸ building frontend (web/dist) ..."
bun run build

echo "▸ compiling server → collet binary ..."
rm -rf "$OUT"
mkdir -p "$OUT"
bun build --compile server/index.ts --outfile "$OUT/collet"

echo "▸ staging web/dist ..."
mkdir -p "$OUT/web"
cp -R web/dist "$OUT/web/"

echo "▸ packaging ${ZIP} ..."
rm -f "$ZIP"
(cd "$OUT" && zip -qr "../collet-${VER}-darwin-${ARCH}.zip" collet web)

echo "✓ release artifact: ${ZIP}"
ls -lh "$ZIP" "$OUT/collet"
