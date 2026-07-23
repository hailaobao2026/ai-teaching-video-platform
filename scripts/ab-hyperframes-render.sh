#!/usr/bin/env bash
# A/B HyperFrames render options against an existing job workspace.
# Usage:
#   bash scripts/ab-hyperframes-render.sh [job_workdir]
# Example:
#   bash scripts/ab-hyperframes-render.sh /data/jobs/job_mru66hvn_n2p4v6
#   # or host path:
#   bash scripts/ab-hyperframes-render.sh server/data/jobs/job_xxx
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
JOB_DIR_INPUT="${1:-}"
CONTAINER="${ATV_WORKER_CONTAINER:-atv-worker}"
OUT_ROOT="${AB_OUT_ROOT:-/tmp/atv-hf-ab}"
mkdir -p "$OUT_ROOT"

if [[ -z "$JOB_DIR_INPUT" ]]; then
  # pick newest job with index.html inside worker
  JOB_DIR_INPUT="$(docker exec "$CONTAINER" bash -lc 'ls -1dt /data/jobs/job_* 2>/dev/null | head -1')"
fi
if [[ -z "$JOB_DIR_INPUT" ]]; then
  echo "No job workspace found. Pass a job dir." >&2
  exit 1
fi

# Normalize to container path if host path given
JOB_DIR="$JOB_DIR_INPUT"
if [[ "$JOB_DIR" == server/data/jobs/* || "$JOB_DIR" == */server/data/jobs/* ]]; then
  base="$(basename "$JOB_DIR")"
  JOB_DIR="/data/jobs/$base"
fi
if [[ "$JOB_DIR" != /data/jobs/* ]]; then
  # if relative host path under repo data
  if [[ -d "$ROOT_DIR/$JOB_DIR_INPUT" ]]; then
    base="$(basename "$JOB_DIR_INPUT")"
    JOB_DIR="/data/jobs/$base"
  fi
fi

echo "== A/B HyperFrames render =="
echo "container: $CONTAINER"
echo "job: $JOB_DIR"

docker exec "$CONTAINER" bash -lc "test -f '$JOB_DIR/index.html'" || {
  echo "Missing $JOB_DIR/index.html in container" >&2
  exit 1
}

run_case() {
  local name="$1"; shift
  local args=("$@")
  local out="/tmp/hf-ab-${name}.mp4"
  echo
  echo "---- case: $name ----"
  echo "args: ${args[*]}"
  docker exec "$CONTAINER" bash -lc "rm -f '$out'"
  local start end elapsed
  start=$(date +%s)
  set +e
  docker exec "$CONTAINER" bash -lc "
    cd '$JOB_DIR' && \
    node /app/server/node_modules/hyperframes/bin/hyperframes.mjs render \
      ${args[*]} \
      --output '$out'
  "
  local code=$?
  set -e
  end=$(date +%s)
  elapsed=$((end - start))
  local size=0
  if docker exec "$CONTAINER" bash -lc "test -f '$out'"; then
    size=$(docker exec "$CONTAINER" bash -lc "stat -c%s '$out' 2>/dev/null || echo 0")
  fi
  printf '%s\n' "$name|$elapsed|$code|$size|${args[*]}" | tee -a "$OUT_ROOT/results.tsv"
  echo "elapsed_sec=$elapsed exit=$code size=$size"
}

# fresh results
echo -e "case|elapsed_sec|exit_code|size_bytes|args" > "$OUT_ROOT/results.tsv"

# A: legacy baseline (quality only)
run_case "A_legacy_draft_only" --quality draft

# B: mapped draft defaults (fps24 workers6 fast-capture)
run_case "B_draft_fps24_w6_fast" --quality draft --fps 24 --workers 6 --experimental-fast-capture --no-low-memory-mode

# C: more workers
run_case "C_draft_fps24_w8_fast" --quality draft --fps 24 --workers 8 --experimental-fast-capture --no-low-memory-mode

# D: lower fps
run_case "D_draft_fps20_w6_fast" --quality draft --fps 20 --workers 6 --experimental-fast-capture --no-low-memory-mode

echo
echo "== summary =="
column -t -s'|' "$OUT_ROOT/results.tsv" 2>/dev/null || cat "$OUT_ROOT/results.tsv"
echo
echo "results: $OUT_ROOT/results.tsv"
echo "Tip: pick fastest green case and set HYPERFRAMES_FPS / HYPERFRAMES_WORKERS / HYPERFRAMES_FAST_CAPTURE in .env.compose"
