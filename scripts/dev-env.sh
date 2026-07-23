#!/usr/bin/env bash
# Shared env for API / Worker local processes.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Preserve caller/export overrides so .env cannot clobber explicit stack settings
# (e.g. start-mysql-stack.sh sets USE_MYSQL=true PORT=3013).
_OVERRIDE_KEYS=(
  PORT USE_MYSQL USE_LOCAL_RUNTIME RUNTIME_ROOT
  MYSQL_HOST MYSQL_PORT MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE
  LOG_DIR ARTIFACTS_ROOT MEMORY_DB_FILE ATV_SERVER_DIR
  ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NICKNAME
  TEACHING_MEDIA_ROOT HYPERFRAMES_BROWSER_PATH HYPERFRAMES_QUALITY
  DEFAULT_TTS_PROVIDER DEFAULT_EDGE_VOICE DEFAULT_IMAGE_PROVIDER
  WORKER_POLL_MS WORKER_CONCURRENCY PYTHONPATH PYTHONUNBUFFERED
  AGNES_API_KEY MULERUN_API_KEY APIMART_API_KEY ATLASCLOUD_API_KEY MINIMAX_API_KEY
  AGNES_HTTP_TIMEOUT AGNES_HTTP_RETRIES IMAGE_HTTP_TIMEOUT IMAGE_HTTP_RETRIES IMAGE_GEN_TIMEOUT_MS
  MEDIA_SIGNING_SECRET
)
for _k in "${_OVERRIDE_KEYS[@]}"; do
  if printenv "$_k" >/dev/null 2>&1; then
    printf -v "_SAVE_${_k}" '%s' "$(printenv "$_k")"
    printf -v "_HAS_${_k}" '%s' '1'
  else
    printf -v "_HAS_${_k}" '%s' '0'
  fi
done

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

for _k in "${_OVERRIDE_KEYS[@]}"; do
  _has_var="_HAS_${_k}"
  if [[ "${!_has_var}" == "1" ]]; then
    _save_var="_SAVE_${_k}"
    export "${_k}=${!_save_var}"
  fi
done

export PORT="${PORT:-3002}"
export USE_MYSQL="${USE_MYSQL:-false}"
export TEACHING_MEDIA_ROOT="${TEACHING_MEDIA_ROOT:-/mnt/f/work/code/github/wwwzhouhui/skills_collection/ai-teaching-media}"
export DEFAULT_TTS_PROVIDER="${DEFAULT_TTS_PROVIDER:-edge}"
export DEFAULT_EDGE_VOICE="${DEFAULT_EDGE_VOICE:-zh-CN-XiaoxiaoNeural}"
export DEFAULT_IMAGE_PROVIDER="${DEFAULT_IMAGE_PROVIDER:-agnes}"
export HYPERFRAMES_QUALITY="${HYPERFRAMES_QUALITY:-draft}"
export WORKER_POLL_MS="${WORKER_POLL_MS:-2000}"
export WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-1}"
export PYTHONUNBUFFERED="${PYTHONUNBUFFERED:-1}"
export AGNES_HTTP_TIMEOUT="${AGNES_HTTP_TIMEOUT:-90}"
export AGNES_HTTP_RETRIES="${AGNES_HTTP_RETRIES:-1}"
export IMAGE_HTTP_TIMEOUT="${IMAGE_HTTP_TIMEOUT:-$AGNES_HTTP_TIMEOUT}"
export IMAGE_HTTP_RETRIES="${IMAGE_HTTP_RETRIES:-$AGNES_HTTP_RETRIES}"
export IMAGE_GEN_TIMEOUT_MS="${IMAGE_GEN_TIMEOUT_MS:-$(( (AGNES_HTTP_TIMEOUT * (AGNES_HTTP_RETRIES + 1) + 45) * 1000 ))}"

# Prefer local-disk server tree when present (avoids /mnt/f hangs).
export ATV_SERVER_DIR="${ATV_SERVER_DIR:-}"
if [[ -z "$ATV_SERVER_DIR" ]]; then
  if [[ -f /tmp/atv-server-run/index.js ]]; then
    ATV_SERVER_DIR=/tmp/atv-server-run
  else
    ATV_SERVER_DIR="$ROOT/server"
  fi
fi
export ATV_SERVER_DIR

# Prefer local disk runtime for memory mode to avoid F:/ slow IO hangs.
if [[ "${USE_LOCAL_RUNTIME:-1}" == "1" && "${USE_MYSQL}" != "true" ]]; then
  RUNTIME_ROOT="${RUNTIME_ROOT:-/tmp/atv-run}"
  mkdir -p "$RUNTIME_ROOT"/{data,jobs,logs}
  export MEMORY_DB_FILE="${MEMORY_DB_FILE:-$RUNTIME_ROOT/data/memory-db.json}"
  export ARTIFACTS_ROOT="${ARTIFACTS_ROOT:-$RUNTIME_ROOT/jobs}"
  export LOG_DIR="${LOG_DIR:-$RUNTIME_ROOT/logs}"
  if [[ ! -f "$MEMORY_DB_FILE" && -f "$ROOT/server/data/memory-db.json" ]]; then
    cp "$ROOT/server/data/memory-db.json" "$MEMORY_DB_FILE" || true
  fi
else
  # MySQL mode: still prefer local logs/artifacts unless overridden
  if [[ "${USE_LOCAL_RUNTIME:-1}" == "1" ]]; then
    RUNTIME_ROOT="${RUNTIME_ROOT:-/tmp/atv-run}"
    mkdir -p "$RUNTIME_ROOT"/{jobs,logs,mysql-run}
    export ARTIFACTS_ROOT="${ARTIFACTS_ROOT:-$RUNTIME_ROOT/jobs}"
    if [[ -z "${LOG_DIR:-}" || "${LOG_DIR}" == "$ROOT/logs" ]]; then
      export LOG_DIR="${RUNTIME_ROOT}/mysql-run"
    fi
    mkdir -p "$LOG_DIR"
  else
    export ARTIFACTS_ROOT="${ARTIFACTS_ROOT:-$ROOT/server/data/jobs}"
    export LOG_DIR="${LOG_DIR:-$ROOT/logs}"
  fi
fi

# edge-tts user install path
if [[ -z "${PYTHONPATH:-}" ]]; then
  export PYTHONPATH="$HOME/.local/lib/python3.10/site-packages:$HOME/.local/lib/python3.12/site-packages:$HOME/.local/lib/python3.11/site-packages"
fi

# Prefer chrome-headless-shell if not set
if [[ -z "${HYPERFRAMES_BROWSER_PATH:-}" ]]; then
  if compgen -G "$HOME/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell" > /dev/null; then
    export HYPERFRAMES_BROWSER_PATH="$(ls -1 $HOME/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | head -1)"
  fi
fi

mkdir -p "$LOG_DIR" "$ARTIFACTS_ROOT" \
  "$ROOT/server/uploads/videos" \
  "$ROOT/server/uploads/artifacts" \
  "$ROOT/server/uploads/covers"
