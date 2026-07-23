#!/usr/bin/env bash
# Sync repo server/ into /tmp/atv-server-run for fast local execution.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="${ATV_SERVER_DIR:-/tmp/atv-server-run}"
mkdir -p "$DST"
rsync -a --delete \
  --exclude node_modules \
  --exclude uploads \
  --exclude 'data/memory-db.json' \
  "$ROOT/server/" "$DST/"
ln -sfn "$ROOT/server/node_modules" "$DST/node_modules"
mkdir -p "$ROOT/server/uploads/videos" "$ROOT/server/uploads/artifacts" "$ROOT/server/uploads/covers"
# Prefer linking uploads to repo so products land in expected place
if [[ ! -L "$DST/uploads" && ! -d "$DST/uploads" ]]; then
  ln -sfn "$ROOT/server/uploads" "$DST/uploads"
elif [[ -d "$DST/uploads" && ! -L "$DST/uploads" ]]; then
  # keep directory if already material; ensure subdirs
  mkdir -p "$DST/uploads"/{videos,artifacts,covers}
fi
# If uploads is missing as link, force link when empty
if [[ ! -e "$DST/uploads" ]]; then
  ln -sfn "$ROOT/server/uploads" "$DST/uploads"
fi
echo "[sync] $ROOT/server -> $DST"
