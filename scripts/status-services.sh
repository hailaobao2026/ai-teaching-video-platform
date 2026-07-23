#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/dev-env.sh"
echo "[env] PORT=${PORT} USE_MYSQL=${USE_MYSQL} SERVER_DIR=${ATV_SERVER_DIR}"
echo "[env] LOG_DIR=${LOG_DIR} ARTIFACTS_ROOT=${ARTIFACTS_ROOT}"
for name in api worker; do
  pid_file="$LOG_DIR/${name}.pid"
  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    pid="$(cat "$pid_file")"
    cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || echo '?')"
    echo "[$name] running pid=$pid cwd=$cwd"
  else
    echo "[$name] stopped"
  fi
done
if curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/health" 2>/dev/null; then
  echo
else
  echo "[api] health unreachable on :${PORT}"
fi
