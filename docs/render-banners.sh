#!/usr/bin/env bash
# Renders docs/banner.html to docs/img/{dark,light}-banner.png, the 1200x630 docs/img/og.png
# and the PNG icons (src/favicon.png, src/apple-touch-icon.png, src/brand/icon-512.png).
# Usage: ./docs/render-banners.sh   (needs Google Chrome; serves the repo on a local port)
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PORT="${PORT:-8799}"
mkdir -p docs/img
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1
for theme in dark light; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1600,520 \
    --virtual-time-budget=4000 --screenshot="docs/img/${theme}-banner.png" \
    "http://localhost:${PORT}/docs/banner.html?theme=${theme}" >/dev/null 2>&1
  echo "docs/img/${theme}-banner.png"
done
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1200,630 \
  --virtual-time-budget=4000 --screenshot="docs/img/og.png" \
  "http://localhost:${PORT}/docs/banner.html?og" >/dev/null 2>&1
echo "docs/img/og.png"
for spec in "64:src/favicon.png" "180:src/apple-touch-icon.png" "512:src/brand/icon-512.png"; do
  size="${spec%%:*}"; out="${spec#*:}"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size="${size},${size}" \
    --virtual-time-budget=2000 --screenshot="$out" \
    "http://localhost:${PORT}/docs/banner.html?icon=${size}" >/dev/null 2>&1
  echo "$out"
done
