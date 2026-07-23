#!/usr/bin/env bash
# One-click MySQL stack via Docker Compose (mysql + api + worker).
# Optional web profile: COMPOSE_PROFILES=web bash scripts/compose-up.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-}"
if [[ -z "$COMPOSE_ENV_FILE" ]]; then
  if [[ -f "$ROOT/.env.compose" ]]; then COMPOSE_ENV_FILE="$ROOT/.env.compose"; fi
fi
COMPOSE_ENV_ARGS=()
if [[ -n "${COMPOSE_ENV_FILE:-}" && -f "$COMPOSE_ENV_FILE" ]]; then
  COMPOSE_ENV_ARGS=(--env-file "$COMPOSE_ENV_FILE")
  echo "[compose] using env file $COMPOSE_ENV_FILE"
fi

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.0}"
export MYSQL_HOST_PORT="${MYSQL_HOST_PORT:-3307}"
export API_HOST_PORT="${API_HOST_PORT:-3002}"
export ATV_APP_IMAGE="${ATV_APP_IMAGE:-atv-app:local}"
export TEACHING_MEDIA_ROOT="${TEACHING_MEDIA_ROOT:-/mnt/f/work/code/github/wwwzhouhui/skills_collection/ai-teaching-media}"
export AGNES_HTTP_TIMEOUT="${AGNES_HTTP_TIMEOUT:-90}"
export AGNES_HTTP_RETRIES="${AGNES_HTTP_RETRIES:-1}"
export IMAGE_GEN_TIMEOUT_MS="${IMAGE_GEN_TIMEOUT_MS:-225000}"


ensure_node_image() {
  local img="${NODE_IMAGE:-node:22-bookworm}"
  if docker image inspect "$img" >/dev/null 2>&1; then
    export NODE_IMAGE="$img"
    echo "[compose] node image ready: $NODE_IMAGE"
    return 0
  fi
  echo "[compose] pulling node base $img ..."
  if docker pull "$img"; then
    export NODE_IMAGE="$img"
    return 0
  fi
  local mirrors=(
    "docker.m.daocloud.io/library/node:22-bookworm"
    "docker.1ms.run/library/node:22-bookworm"
  )
  for m in "${mirrors[@]}"; do
    echo "[compose] trying node mirror $m"
    if docker pull "$m"; then
      docker tag "$m" node:22-bookworm || true
      export NODE_IMAGE=node:22-bookworm
      echo "[compose] tagged $m -> node:22-bookworm"
      return 0
    fi
  done
  # last resort: keep requested name and let build try
  export NODE_IMAGE="$img"
  echo "[compose] WARN: could not pre-pull node image; build may fail if registry is blocked" >&2
  return 0
}

ensure_mysql_image() {
  if docker image inspect "$MYSQL_IMAGE" >/dev/null 2>&1; then
    echo "[compose] mysql image ready: $MYSQL_IMAGE"
    return 0
  fi
  echo "[compose] pulling $MYSQL_IMAGE ..."
  if docker pull "$MYSQL_IMAGE"; then
    return 0
  fi
  # Fallback mirrors when Docker Hub is blocked/timeout.
  local mirrors=(
    "docker.m.daocloud.io/library/mysql:8.0"
    "docker.1ms.run/library/mysql:8.0"
  )
  for m in "${mirrors[@]}"; do
    echo "[compose] trying mirror $m"
    if docker pull "$m"; then
      docker tag "$m" mysql:8.0
      export MYSQL_IMAGE=mysql:8.0
      echo "[compose] tagged $m -> mysql:8.0"
      return 0
    fi
  done
  echo "[compose] failed to pull mysql image; set MYSQL_IMAGE to a reachable mirror" >&2
  return 1
}

if [[ ! -d "$TEACHING_MEDIA_ROOT" ]]; then
  echo "[compose] WARN: TEACHING_MEDIA_ROOT not found: $TEACHING_MEDIA_ROOT" >&2
  echo "[compose] image/video generation inside containers will fail until the skill is mounted" >&2
fi

mkdir -p "$ROOT/server/uploads/videos" "$ROOT/server/uploads/artifacts" "$ROOT/server/uploads/covers"

ensure_mysql_image
ensure_node_image

SERVICES=(mysql api worker)
if [[ "${COMPOSE_PROFILES:-}" == *web* ]] || [[ "${WITH_WEB:-0}" == "1" ]]; then
  export COMPOSE_PROFILES="${COMPOSE_PROFILES:-web}"
  if [[ ! -d "$ROOT/dist" ]]; then
    echo "[compose] building frontend dist for web profile..."
    npm run build || echo "[compose] WARN: frontend build failed; web may serve empty"
  fi
  SERVICES+=(web)
fi

echo "[compose] building app image $ATV_APP_IMAGE (if needed)"
docker compose "${COMPOSE_ENV_ARGS[@]}" build api worker

echo "[compose] up: ${SERVICES[*]}"
docker compose "${COMPOSE_ENV_ARGS[@]}" up -d "${SERVICES[@]}"

echo "[compose] waiting for API health on :${API_HOST_PORT} ..."
for i in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://127.0.0.1:${API_HOST_PORT}/health" >/dev/null 2>&1; then
    echo "[compose] API healthy"
    docker compose "${COMPOSE_ENV_ARGS[@]}" ps
    echo
    echo "Login demo: ${ADMIN_EMAIL:-teacher@demo.local} / ${ADMIN_PASSWORD:-demo123}"
    echo "API:  http://127.0.0.1:${API_HOST_PORT}"
    echo "MySQL host port: ${MYSQL_HOST_PORT}"
    exit 0
  fi
  sleep 2
done

echo "[compose] API health timeout; recent logs:" >&2
docker compose "${COMPOSE_ENV_ARGS[@]}" logs --tail=80 api worker mysql >&2 || true
exit 1
