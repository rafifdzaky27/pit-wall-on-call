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

# Value of KEY in .env (last one wins), without surrounding spaces or quotes.
env_value() {
  grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d ' "' || true
}

analytics_enabled() {
  [[ ",$(env_value COMPOSE_PROFILES)," == *,analytics,* ]]
}

# With the analytics profile on, UMAMI_DB_PASSWORD and UMAMI_APP_SECRET must be set,
# and the password must be plain characters (it is written into a psql \set line).
# Checked before anything changes, so a bad .env aborts the deploy cleanly.
check_analytics_env() {
  analytics_enabled || return 0
  local pw
  pw="$(env_value UMAMI_DB_PASSWORD)"
  if [[ -z "$pw" || -z "$(env_value UMAMI_APP_SECRET)" ]]; then
    echo "COMPOSE_PROFILES has analytics: set UMAMI_DB_PASSWORD and UMAMI_APP_SECRET in .env" >&2
    return 1
  fi
  if [[ ! "$pw" =~ ^[A-Za-z0-9._~-]+$ ]]; then
    echo "UMAMI_DB_PASSWORD may only contain letters, digits and . _ ~ -" >&2
    return 1
  fi
}

# Idempotent: creates role and database "umami" if missing and keeps the password in
# sync with .env. The password travels on stdin only, never as an argument or in output.
provision_umami() {
  analytics_enabled || return 0
  {
    printf "\\\\set pw '%s'\n" "$(env_value UMAMI_DB_PASSWORD)"
    cat <<'SQL'
select format('create role umami login password %L', :'pw') where not exists (select from pg_roles where rolname = 'umami') \gexec
select format('alter role umami login password %L', :'pw') \gexec
select 'create database umami owner umami' where not exists (select from pg_database where datname = 'umami') \gexec
SQL
  } | docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U pitwall -d pitwall >/dev/null
}

check_analytics_env

echo "deploying ${NEW_TAG} (previous: ${PREV_TAG:-none})"
pull "$NEW_TAG"
migrate "$NEW_TAG"
# Postgres is running after the migration (it is the api's dependency).
provision_umami

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
