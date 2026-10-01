#!/usr/bin/env bash
# Proves the latest backup restores: loads the newest snapshot of each database into a
# throwaway postgres:17-alpine container and compares count(*) of every table in
# schema public with production.
#
# Exit 0: every table matches (within TOLERANCE_PCT, see below).
# Exit 1: a table differs, a restore failed, or a database has no snapshot.
# Exit 2: the newest snapshot is older than MAX_AGE_HOURS (default 36).
#
# Environment (never printed by this script):
#   RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE  required, as for backup.sh
#   COMPOSE_DIR       directory holding docker-compose.yml and .env (default: infra/)
#   PW_DB, PW_DB_USER, UMAMI_DB  default pitwall, pitwall, umami (Umami is checked only if that database exists)
#   MAX_AGE_HOURS     default 36
#   TOLERANCE_PCT     default 0 = counts must be equal. Production keeps taking writes after
#                     the snapshot; a positive value lets production be ahead of the restore
#                     by that percentage of its rows per table. The restore is never allowed
#                     to have MORE rows than production.
set -euo pipefail
umask 077

: "${RESTIC_REPOSITORY:?set RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD_FILE:?set RESTIC_PASSWORD_FILE}"
PW_DB="${PW_DB:-pitwall}"
PW_DB_USER="${PW_DB_USER:-pitwall}"
UMAMI_DB="${UMAMI_DB:-umami}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-36}"
TOLERANCE_PCT="${TOLERANCE_PCT:-0}"

cd "${COMPOSE_DIR:-$(dirname "$0")/..}"

prod() {
  # </dev/null: docker would otherwise swallow the stdin of the table loop below.
  docker compose exec -T postgres psql -U "$PW_DB_USER" -v ON_ERROR_STOP=1 -Atq "$@" </dev/null | tr -d '\r'
}

scratch="pitwall-restore-$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
# shellcheck disable=SC2329 # invoked by the EXIT trap
cleanup() {
  docker rm -f "$scratch" >/dev/null 2>&1 || true
}
trap cleanup EXIT

scratch_psql() {
  docker exec "$scratch" psql -U postgres -v ON_ERROR_STOP=1 -Atq "$@" | tr -d '\r'
}

start_scratch() {
  docker run -d --name "$scratch" -e POSTGRES_PASSWORD=restore-test postgres:17-alpine >/dev/null
  # TCP on 127.0.0.1 only answers once the real server is up (the init-time server listens on the socket only).
  for _ in $(seq 1 60); do
    if docker exec "$scratch" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "scratch postgres did not become ready" >&2
  return 1
}

# snapshot_time <tag>: ISO time of the newest snapshot with that tag, empty if none.
snapshot_time() {
  restic snapshots --tag "$1" --latest 1 --json | grep -o '"time":"[^"]*"' | head -1 | cut -d'"' -f4 || true
}

# check_database <database> <tag>
check_database() {
  local db="$1" tag="$2" when age_s max_s
  when="$(snapshot_time "$tag")"
  if [[ -z "$when" ]]; then
    echo "FAIL $db: no snapshot with tag $tag" >&2
    return 1
  fi
  age_s=$(($(date +%s) - $(date -d "$when" +%s)))
  max_s=$((MAX_AGE_HOURS * 3600))
  if ((age_s > max_s)); then
    echo "STALE $db: newest snapshot is $((age_s / 3600))h old (limit ${MAX_AGE_HOURS}h)" >&2
    return 2
  fi

  # set -e is off inside a function that is called from "||", so every step checks itself.
  scratch_psql -d postgres -c "create database \"$db\"" >/dev/null || return 1
  restic dump --tag "$tag" latest "/$tag.dump" |
    docker exec -i "$scratch" pg_restore -U postgres --no-owner --no-privileges --exit-on-error -d "$db" || {
    echo "FAIL $db: the snapshot did not restore" >&2
    return 1
  }

  local table want got bad=0 tables=0 table_list
  table_list="$(prod -d "$db" -c "select tablename from pg_tables where schemaname = 'public' order by 1")" || return 1
  while IFS= read -r table; do
    [[ -n "$table" ]] || continue
    tables=$((tables + 1))
    want="$(prod -d "$db" -c "select count(*) from public.\"$table\"")" || return 1
    got="$(scratch_psql -d "$db" -c "select count(*) from public.\"$table\"")" || return 1
    # restored must not exceed production, and production may lead by at most TOLERANCE_PCT of its rows
    if (((got > want) || ((want - got) * 100 > want * TOLERANCE_PCT))); then
      echo "MISMATCH $db.$table: production $want, restored $got" >&2
      bad=1
    fi
  done <<<"$table_list"
  if ((tables == 0)); then
    echo "FAIL $db: production has no tables in schema public" >&2
    return 1
  fi
  if ((bad)); then
    return 1
  fi
  echo "ok $db: $tables tables restored, counts match (snapshot $when)"
}

start_scratch

status=0
check_database "$PW_DB" pitwall || status=$?
if [[ "$(prod -d postgres -c "select 1 from pg_database where datname = '$UMAMI_DB'")" == "1" ]]; then
  rc=0
  check_database "$UMAMI_DB" umami || rc=$?
  # a mismatch (1) outranks a stale snapshot (2) outranks success
  if ((rc == 1 || status == 0)); then status=$rc; fi
fi
exit "$status"
