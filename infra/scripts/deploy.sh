#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${IMAGE_TAG:?Deploy an immutable commit SHA}"
export IMAGE_TAG
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d postgres redis ai
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d --remove-orphans
for attempt in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T api node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    printf '%s\n' "$IMAGE_TAG" > .deployed-image
    exit 0
  fi
  sleep 5
done
echo 'Deployment failed its health check. Redeploy the previous SHA after reviewing logs.' >&2
exit 1
