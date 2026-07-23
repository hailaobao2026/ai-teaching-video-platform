#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/dev-env.sh" || true
LOG_DIR="${LOG_DIR:-$ROOT/logs}"

stop_pidfile() {
  local name="$1"
  local pid_file="$LOG_DIR/${name}.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      # Soft safety: only kill if cwd looks like our server tree or cmdline has our markers
      local cmd
      cmd="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
      if [[ "$cmd" == *index.js* || "$cmd" == *teachingMediaWorker* || "$cmd" == *atv-server-run* ]]; then
        echo "[stop] $name pid=$pid"
        kill "$pid" 2>/dev/null || true
        for _ in $(seq 1 10); do
          kill -0 "$pid" 2>/dev/null || break
          sleep 0.2
        done
        kill -9 "$pid" 2>/dev/null || true
      else
        echo "[stop] $name pid=$pid cmdline mismatch, skip hard kill: $cmd"
      fi
    fi
    python3 -c "from pathlib import Path; Path(r'$pid_file').unlink(missing_ok=True)" 2>/dev/null || true
  else
    echo "[stop] $name not tracked in $pid_file"
  fi
}

stop_pidfile api
stop_pidfile worker
echo "[stop] done (log_dir=$LOG_DIR)"
