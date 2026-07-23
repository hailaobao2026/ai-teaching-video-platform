#!/usr/bin/env bash
# Simple restart loop for API + Worker. Ctrl+C to stop.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTERVAL="${WATCHDOG_INTERVAL_SEC:-5}"
echo "[watchdog] interval=${INTERVAL}s root=$ROOT"
while true; do
  # shellcheck disable=SC1091
  source "$ROOT/scripts/dev-env.sh"
  api_ok=0
  if curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    api_ok=1
  fi
  if [[ "$api_ok" -ne 1 ]]; then
    echo "[watchdog] $(date -Is) api unhealthy on :${PORT}, restarting"
    bash "$ROOT/scripts/start-api.sh" || true
  fi
  pid_file="$LOG_DIR/worker.pid"
  worker_ok=0
  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    worker_ok=1
  fi
  if [[ "$worker_ok" -ne 1 ]]; then
    echo "[watchdog] $(date -Is) worker down, restarting"
    bash "$ROOT/scripts/start-worker.sh" || true
  fi
  sleep "$INTERVAL"
done
