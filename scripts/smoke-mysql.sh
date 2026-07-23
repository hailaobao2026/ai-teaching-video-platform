#!/usr/bin/env bash
# Smoke host-side MySQL API stack (default :3013).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="${API_BASE:-http://127.0.0.1:${PORT:-3013}}"
EMAIL="${ADMIN_EMAIL:-teacher@demo.local}"
PASS="${ADMIN_PASSWORD:-demo123}"
PROFILE="${SMOKE_PROFILE:-image_generation}"
TIMEOUT_SEC="${SMOKE_TIMEOUT_SEC:-180}"

echo "[smoke] API=$API profile=$PROFILE"

LOGIN=$(curl -fsS -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOKEN=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["token"])' "$LOGIN")
echo "[smoke] login ok"

JOB=$(curl -fsS -X POST "$API/api/jobs" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{
  \"outputProfile\": \"$PROFILE\",
  \"subject\": \"物理\",
  \"grade\": \"高中\",
  \"chapter\": \"力学\",
  \"topic\": \"烟雾测试-${PROFILE}\",
  \"title\": \"smoke-${PROFILE}\",
  \"prompt\": \"画一张简洁教学示意图：烟雾测试用，标注惯性\",
  \"article\": \"# 烟雾\\n\\n第一段说明系统冒烟测试要点，需要足够长度以便识别。\\n\\n第二段补充因果和步骤，继续填充字数保证通过校验。\\n\\n第三段给一个生活例子，便于插图生成管线拆分。\"
}")
JOB_ID=$(python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print(d.get("jobId") or d.get("id") or (d.get("job") or {}).get("id"))' "$JOB")
echo "[smoke] job=$JOB_ID"

deadline=$((SECONDS + TIMEOUT_SEC))
while (( SECONDS < deadline )); do
  ST=$(curl -fsS "$API/api/jobs/$JOB_ID" -H "Authorization: Bearer $TOKEN")
  python3 -c 'import json,sys; d=json.loads(sys.argv[1]); j=d.get("job") if isinstance(d,dict) and "job" in d else d; j=j[0] if isinstance(j,list) else j; print(j.get("status"), j.get("progress"), j.get("currentStage") or "", (j.get("errorMessage") or "")[:100])' "$ST"
  STATE=$(python3 -c 'import json,sys; d=json.loads(sys.argv[1]); j=d.get("job") if isinstance(d,dict) and "job" in d else d; j=j[0] if isinstance(j,list) else j; print(j.get("status"))' "$ST")
  if [[ "$STATE" == "succeeded" || "$STATE" == "failed" ]]; then
    echo "$ST" | python3 -m json.tool | head -60
    ASSETS=$(curl -fsS "$API/api/jobs/$JOB_ID/assets" -H "Authorization: Bearer $TOKEN" || echo '[]')
    echo "[smoke] assets=$(python3 -c 'import json,sys; a=json.loads(sys.argv[1]); print(len(a) if isinstance(a,list) else len(a.get("items") or []))' "$ASSETS")"
    if [[ "$STATE" == "succeeded" ]]; then
      exit 0
    fi
    # failed is still a valid smoke of fail-path when FORCE_FAIL/timeouts set
    if [[ "${SMOKE_ALLOW_FAILED:-0}" == "1" ]]; then
      exit 0
    fi
    exit 2
  fi
  sleep 3
done
echo "[smoke] timeout waiting for job terminal state" >&2
exit 1
