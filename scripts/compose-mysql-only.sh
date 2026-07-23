#!/usr/bin/env bash
# Start only MySQL container for host-side API/Worker (npm run start:mysql-stack).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.0}"
export MYSQL_HOST_PORT="${MYSQL_HOST_PORT:-3307}"

if ! docker image inspect "$MYSQL_IMAGE" >/dev/null 2>&1; then
  if ! docker pull "$MYSQL_IMAGE"; then
    if docker pull docker.m.daocloud.io/library/mysql:8.0; then
      docker tag docker.m.daocloud.io/library/mysql:8.0 mysql:8.0
      export MYSQL_IMAGE=mysql:8.0
    else
      echo "unable to pull mysql image" >&2
      exit 1
    fi
  fi
fi

docker compose -f docker-compose.mysql-only.yml up -d
echo "[mysql-only] waiting..."
for i in $(seq 1 40); do
  if docker exec atv-mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
    echo "[mysql-only] ready on host port ${MYSQL_HOST_PORT}"
    exit 0
  fi
  sleep 2
done
echo "[mysql-only] not ready" >&2
docker logs atv-mysql 2>&1 | tail -40 >&2 || true
exit 1
