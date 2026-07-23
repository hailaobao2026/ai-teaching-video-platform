#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$ROOT/scripts/stop-services.sh"
sleep 0.5
bash "$ROOT/scripts/start-api.sh"
bash "$ROOT/scripts/start-worker.sh"
bash "$ROOT/scripts/status-services.sh"
