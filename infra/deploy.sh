#!/usr/bin/env bash
# Usage: deploy.sh <git-sha>
# Pulls the SHA-tagged images, migrates the database, restarts the stack,
# smoke-tests it, and rolls back to the previously running tag if the smoke
# test fails. Migrations must be backward compatible (add, never drop or
# rename, in one release), because a rollback runs the old image on the new schema.
set -euo pipefail

cd "$(dirname "$0")"

NEW_TAG="${1:?usage: deploy.sh <git-sha>}"
PREV_TAG="$(grep -E '^TAG=' .env | cut -d= -f2- || true)"

set_tag() {
  sed -i '/^TAG=/d' .env
  echo "TAG=$1" >> .env
}

# Pull every service first, with the tag passed only as a process env var, so a
# missing image aborts (set -e) before .env or any running container changes.
pull() {
  TAG="$1" docker compose pull
}

# One-shot migration with the new image, before anything restarts: a failure
# exits here (set -e) with .env and the running containers untouched.
migrate() {
  TAG="$1" docker compose run --rm -T api node dist/migrate.js
}

start() {
  set_tag "$1"
  docker compose up -d --remove-orphans
}

smoke_test() {
  for _ in $(seq 1 30); do
    if docker compose exec -T api wget -qO- http://127.0.0.1:8787/readyz >/dev/null 2>&1 &&
      docker compose exec -T web wget -qO- http://127.0.0.1:80/api/version 2>/dev/null | grep -q "\"$1\"" &&
      # Replays a fixture run through Caddy as a dry run (nothing is stored). Images
      # from before M2 have no smoke.js, so a rollback to one skips this check.
      docker compose exec -T api sh -c 'test ! -f dist/smoke.js || node dist/smoke.js http://web:80' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "deploying ${NEW_TAG} (previous: ${PREV_TAG:-none})"
pull "$NEW_TAG"
migrate "$NEW_TAG"

# start is inside the condition so a failing "compose up" also triggers rollback
# (under set -e it would otherwise exit with .env on a never-healthy tag).
if start "$NEW_TAG" && smoke_test "$NEW_TAG"; then
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
if start "$PREV_TAG" && smoke_test "$PREV_TAG"; then
  echo "rollback ok: ${PREV_TAG}" >&2
else
  echo "ROLLBACK ALSO UNHEALTHY: manual intervention needed" >&2
fi
exit 1
