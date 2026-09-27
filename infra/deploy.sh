#!/usr/bin/env bash
# Usage: deploy.sh <git-sha>
# Pulls the SHA-tagged images, restarts the stack, smoke-tests it,
# and rolls back to the previously running tag if the smoke test fails.
set -euo pipefail

cd "$(dirname "$0")"

NEW_TAG="${1:?usage: deploy.sh <git-sha>}"
PREV_TAG="$(grep -E '^TAG=' .env | cut -d= -f2- || true)"

set_tag() {
  sed -i '/^TAG=/d' .env
  echo "TAG=$1" >> .env
}

# Pull first, with the tag passed only as a process env var, so a missing image
# aborts (set -e) before .env or any running container changes.
pull() {
  TAG="$1" docker compose pull api web
}

start() {
  set_tag "$1"
  docker compose up -d --remove-orphans
}

smoke_test() {
  for _ in $(seq 1 30); do
    if docker compose exec -T api wget -qO- http://127.0.0.1:8787/readyz >/dev/null 2>&1 &&
      docker compose exec -T web wget -qO- http://127.0.0.1:80/api/version 2>/dev/null | grep -q "\"$1\""; then
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "deploying ${NEW_TAG} (previous: ${PREV_TAG:-none})"
pull "$NEW_TAG"
start "$NEW_TAG"

if smoke_test "$NEW_TAG"; then
  echo "deploy ok: ${NEW_TAG}"
  docker image prune -f >/dev/null
  exit 0
fi

echo "smoke test failed for ${NEW_TAG}" >&2
if [[ -z "$PREV_TAG" || "$PREV_TAG" == "$NEW_TAG" ]]; then
  echo "no previous tag to roll back to" >&2
  exit 1
fi

echo "rolling back to ${PREV_TAG}" >&2
start "$PREV_TAG"
if smoke_test "$PREV_TAG"; then
  echo "rollback ok: ${PREV_TAG}" >&2
else
  echo "ROLLBACK ALSO UNHEALTHY: manual intervention needed" >&2
fi
exit 1
