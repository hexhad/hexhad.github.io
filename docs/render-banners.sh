#!/usr/bin/env bash
# Renders docs/banner.html to docs/img/{dark,light}-banner.png with headless Chrome.
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
