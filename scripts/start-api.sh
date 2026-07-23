#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/dev-env.sh"

PID_FILE="$LOG_DIR/api.pid"
LOG_FILE="$LOG_DIR/api.log"
PORT="${PORT:-3002}"
SERVER_DIR="${ATV_SERVER_DIR:-$ROOT/server}"

is_alive() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

health_ok() {
  curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1
}

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if is_alive "$old_pid" && health_ok; then
    echo "[api] already running pid=$old_pid port=${PORT} dir=$SERVER_DIR"
    exit 0
  fi
  if is_alive "$old_pid"; then
    echo "[api] stale/unhealthy pid=$old_pid, restarting"
    kill "$old_pid" 2>/dev/null || true
    sleep 1
    kill -9 "$old_pid" 2>/dev/null || true
  fi
  python3 -c "from pathlib import Path; Path(r'$PID_FILE').unlink(missing_ok=True)"
fi

# Guard against foreign process already owning the port
if health_ok; then
  echo "[api] port ${PORT} already healthy (foreign process); not starting another" >&2
  exit 0
fi

cd "$SERVER_DIR"
nohup node index.js >>"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

for i in $(seq 1 60); do
  if health_ok; then
    echo "[api] started pid=$(cat "$PID_FILE") port=${PORT} dir=$SERVER_DIR log=$LOG_FILE mode=USE_MYSQL=${USE_MYSQL}"
    exit 0
  fi
  if ! is_alive "$(cat "$PID_FILE" 2>/dev/null || true)"; then
    echo "[api] process exited early; see $LOG_FILE" >&2
    tail -n 60 "$LOG_FILE" >&2 || true
    exit 1
  fi
  sleep 0.25
done

echo "[api] started but health check timed out; see $LOG_FILE" >&2
tail -n 60 "$LOG_FILE" >&2 || true
exit 1
