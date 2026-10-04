#!/data/data/com.termux/files/usr/bin/bash
# Usage: ./render.sh create | wait | status | logs | redeploy | env KEY VALUE
set -euo pipefail
source ~/.render_env
API=https://api.render.com/v1
auth=(-H "Authorization: Bearer $RENDER_API_KEY")
REPO=https://github.com/olekariamunyororo-crypto/Claude-of-Duty-Multiplayer
NAME=cod2-server

st() { curl -s "${auth[@]}" "$API/services/$MP_SRV/deploys?limit=1" | jq -r '.[0].deploy.status'; }

create() {
  if [ -n "${MP_SRV:-}" ]; then echo "already created: $MP_SRV"; exit 1; fi
  if [ -z "${MONGO_URL:-}" ]; then
    MONGO_URL=$(curl -s "${auth[@]}" "$API/services/$SRV/env-vars" \
      | jq -r '.[].envVar | select(.key=="MONGO_URL") | .value')
  fi
  [ ${#MONGO_URL} -gt 20 ] || { echo "MONGO_URL missing: export it first"; exit 1; }
  SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  body=$(jq -n --arg owner "$OWNER_ID" --arg repo "$REPO" --arg name "$NAME" \
    --arg mongo "$MONGO_URL" --arg secret "$SECRET" '{
    type: "web_service", name: $name, ownerId: $owner, repo: $repo,
    branch: "main", autoDeploy: "yes",
    envVars: [
      {key:"MONGO_URL", value:$mongo}, {key:"MONGO_DB", value:"cod2"},
      {key:"GUEST_SECRET", value:$secret}, {key:"NODE_VERSION", value:"20"}],
    serviceDetails: {
      runtime: "node", plan: "free", region: "frankfurt", healthCheckPath: "/",
      envSpecificDetails: {
        buildCommand: "npm install --omit=dev && cd server && npm install",
        startCommand: "node server/index.mjs"}}}')
  resp=$(curl -s -X POST "$API/services" "${auth[@]}" -H "Content-Type: application/json" -d "$body")
  id=$(echo "$resp" | jq -r '.service.id // empty')
  [ -n "$id" ] || { echo "FAILED:"; echo "$resp" | jq -r '.message // .'; exit 1; }
  url=$(echo "$resp" | jq -r '.service.serviceDetails.url')
  echo "export MP_SRV=$id MP_URL=$url" >> ~/.render_env
  echo "created $id -> $url"
}

await_live() {
  while case "$(st)" in build_in_progress|update_in_progress|created|pre_deploy_in_progress) true;; *) false;; esac; do
    sleep 20
  done
  st
}

case "${1:-}" in
  create)   create ;;
  wait)     await_live ;;
  status)   curl -s "${auth[@]}" "$API/services/$MP_SRV/deploys?limit=1" \
              | jq -r '.[0].deploy | "\(.status)  \(.commit.message)"' ;;
  logs)     curl -s "${auth[@]}" "$API/logs?ownerId=$OWNER_ID&resource=$MP_SRV&limit=100&direction=backward" \
              | jq -r '.logs[].message' | cut -c1-140 | uniq | tail -25 ;;
  redeploy) curl -s -X POST "${auth[@]}" "$API/services/$MP_SRV/deploys" | jq -r '.id,.status' ;;
  env)      jq -n --arg v "$3" '{value:$v}' | curl -s -X PUT "${auth[@]}" \
              -H "Content-Type: application/json" -d @- "$API/services/$MP_SRV/env-vars/$2" | head -c 80; echo ;;
  *)        echo "usage: $0 create|wait|status|logs|redeploy|env KEY VALUE" ;;
esac
