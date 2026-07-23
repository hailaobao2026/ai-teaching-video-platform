#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/dev-env.sh"

PID_FILE="$LOG_DIR/worker.pid"
LOG_FILE="$LOG_DIR/worker.log"
SERVER_DIR="${ATV_SERVER_DIR:-$ROOT/server}"

is_alive() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

worker_ready() {
  local pid="$1"
  is_alive "$pid" || return 1
  # Prefer recent ready log line; fallback to process still alive after warm-up
  if [[ -f "$LOG_FILE" ]] && tail -n 80 "$LOG_FILE" | grep -q "teachingMediaWorker started"; then
    return 0
  fi
  return 1
}

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if is_alive "$old_pid"; then
    # Only treat as ready if log shows start or process cmdline matches worker
    if worker_ready "$old_pid" || tr '\0' ' ' <"/proc/$old_pid/cmdline" 2>/dev/null | grep -q teachingMediaWorker; then
      echo "[worker] already running pid=$old_pid dir=$SERVER_DIR"
      exit 0
    fi
  fi
  python3 -c "from pathlib import Path; Path(r'$PID_FILE').unlink(missing_ok=True)"
fi

# Rotate very large logs to keep "ready" detection useful
if [[ -f "$LOG_FILE" ]] && [[ $(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 5000000 ]]; then
  mv "$LOG_FILE" "${LOG_FILE}.$(date +%Y%m%d%H%M%S)" || true
fi

# Marker for this start
echo "---- worker start $(date -Is) ----" >>"$LOG_FILE"

cd "$SERVER_DIR"
nohup node workers/teachingMediaWorker.js >>"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"
new_pid="$(cat "$PID_FILE")"

for i in $(seq 1 60); do
  if worker_ready "$new_pid"; then
    echo "[worker] started pid=$new_pid dir=$SERVER_DIR log=$LOG_FILE mode=USE_MYSQL=${USE_MYSQL}"
    exit 0
  fi
  if ! is_alive "$new_pid"; then
    echo "[worker] process exited early; see $LOG_FILE" >&2
    tail -n 60 "$LOG_FILE" >&2 || true
    exit 1
  fi
  sleep 0.25
done

if is_alive "$new_pid"; then
  echo "[worker] started pid=$new_pid (ready log not seen yet) log=$LOG_FILE"
  exit 0
fi
echo "[worker] failed to stay up; see $LOG_FILE" >&2
tail -n 60 "$LOG_FILE" >&2 || true
exit 1
