#!/usr/bin/env bash
# Start API+Worker against local MySQL (host port 3307 by default) without disturbing memory stack on 3012.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export USE_MYSQL=true
export USE_LOCAL_RUNTIME=1
export PORT="${PORT:-3013}"
export MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
export MYSQL_PORT="${MYSQL_PORT:-3307}"
export MYSQL_USER="${MYSQL_USER:-atv}"
export MYSQL_PASSWORD="${MYSQL_PASSWORD:-atv123456}"
export MYSQL_DATABASE="${MYSQL_DATABASE:-ai_teaching_video}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-teacher@demo.local}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-demo123}"
export RUNTIME_ROOT="${RUNTIME_ROOT:-/tmp/atv-run}"
export LOG_DIR="${LOG_DIR:-$RUNTIME_ROOT/mysql-run}"
export ARTIFACTS_ROOT="${ARTIFACTS_ROOT:-$RUNTIME_ROOT/jobs}"
export ATV_SERVER_DIR="${ATV_SERVER_DIR:-/tmp/atv-server-run}"

mkdir -p "$LOG_DIR" "$ARTIFACTS_ROOT"
bash "$ROOT/scripts/sync-server-run.sh"
bash "$ROOT/scripts/start-api.sh"
bash "$ROOT/scripts/start-worker.sh"
bash "$ROOT/scripts/status-services.sh"
