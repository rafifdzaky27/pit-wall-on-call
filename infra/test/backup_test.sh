#!/usr/bin/env bash
# End-to-end test of infra/backup/{backup,restore-test}.sh against a throwaway
# database in the dev compose Postgres (pnpm db:up) and local restic repositories.
# Needs docker, the compose plugin, restic and GNU date. CI runs it in the "backup" job.
#
# It proves: backup stores both databases, the restore test passes on a clean backup,
# it FAILS when production differs from the backup, it fails on a stale snapshot,
# the optional tolerance never lets a restore exceed production, the offsite copy works,
# and no scratch container is left behind.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$here/../.." && pwd)"
work="$(mktemp -d)"
suffix="$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"

export COMPOSE_FILE="$repo_root/infra/docker-compose.dev.yml"
export COMPOSE_DIR="$repo_root/infra"
export PW_DB="bk_main_$suffix"
export UMAMI_DB="bk_umami_$suffix"
export PW_DB_USER=pitwall
export RESTIC_REPOSITORY="$work/repo"
export RESTIC_PASSWORD_FILE="$work/password"
export RESTIC_OFFSITE_REPOSITORY="$work/offsite"
printf 'local-test-password\n' > "$RESTIC_PASSWORD_FILE"

pg() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U pitwall -v ON_ERROR_STOP=1 -q "$@" > /dev/null
}

cleanup() {
  pg -d postgres -c "drop database if exists \"$PW_DB\" with (force)" || true
  pg -d postgres -c "drop database if exists \"$UMAMI_DB\" with (force)" || true
  rm -rf "$work"
}
trap cleanup EXIT

failures=0
expect() { # expect <name> <want exit code> <command...>
  local name="$1" want="$2" code=0
  shift 2
  "$@" > "$work/out.log" 2>&1 || code=$?
  if [[ "$code" == "$want" ]]; then
    echo "ok   - $name"
  else
    echo "FAIL - $name: exit=$code (want $want)"
    sed 's/^/       /' "$work/out.log"
    failures=$((failures + 1))
  fi
}

pg -d postgres -c "create database \"$PW_DB\""
pg -d postgres -c "create database \"$UMAMI_DB\""
pg -d "$PW_DB" -c "create table players (id int primary key, handle text); insert into players select g, 'p' || g from generate_series(1, 5) g; create table runs (id int primary key, burn int); insert into runs select g, g * 10 from generate_series(1, 8) g;"
pg -d "$UMAMI_DB" -c "create table website_event (id int primary key); insert into website_event select g from generate_series(1, 12) g;"

restic init --quiet
restic -r "$RESTIC_OFFSITE_REPOSITORY" init --quiet --password-file "$RESTIC_PASSWORD_FILE" --from-repo "$RESTIC_REPOSITORY" --from-password-file "$RESTIC_PASSWORD_FILE" --copy-chunker-params

expect "backup runs" 0 bash "$repo_root/infra/backup/backup.sh"
if [[ "$(restic snapshots --tag pitwall --json | grep -o '"short_id"' | wc -l)" == 1 && "$(restic snapshots --tag umami --json | grep -o '"short_id"' | wc -l)" == 1 ]]; then
  echo "ok   - one snapshot per database, tagged pitwall and umami"
else
  echo "FAIL - expected one pitwall and one umami snapshot"; failures=$((failures + 1))
fi
if [[ "$(RESTIC_REPOSITORY="$RESTIC_OFFSITE_REPOSITORY" restic snapshots --json | grep -o '"short_id"' | wc -l)" == 2 ]]; then
  echo "ok   - the snapshots were copied to the offsite repository"
else
  echo "FAIL - offsite repository should hold both snapshots"; failures=$((failures + 1))
fi

expect "restore test passes on a clean backup" 0 bash "$repo_root/infra/backup/restore-test.sh"
if grep -q "ok $PW_DB: 2 tables" "$work/out.log" && grep -q "ok $UMAMI_DB: 1 tables" "$work/out.log"; then
  echo "ok   - the restore test checked both databases"
else
  echo "FAIL - restore test output did not cover both databases"; sed 's/^/       /' "$work/out.log"; failures=$((failures + 1))
fi
if [[ -z "$(docker ps -aq --filter name=pitwall-restore-)" ]]; then
  echo "ok   - no scratch container left behind"
else
  echo "FAIL - a pitwall-restore-* container was left behind"; failures=$((failures + 1))
fi

# Production gains a row after the backup: strict mode must fail, naming the table.
pg -d "$PW_DB" -c "insert into runs values (9, 90)"
expect "restore test fails when production differs from the backup" 1 bash "$repo_root/infra/backup/restore-test.sh"
if grep -q "MISMATCH $PW_DB.runs: production 9, restored 8" "$work/out.log"; then
  echo "ok   - the mismatch names the table and both counts"
else
  echo "FAIL - mismatch message missing"; sed 's/^/       /' "$work/out.log"; failures=$((failures + 1))
fi
expect "a tolerance lets production be ahead" 0 env TOLERANCE_PCT=20 bash "$repo_root/infra/backup/restore-test.sh"
expect "a tolerance that is too small still fails" 1 env TOLERANCE_PCT=5 bash "$repo_root/infra/backup/restore-test.sh"

# The backup holds more rows than production (rows were lost): always a failure.
pg -d "$PW_DB" -c "delete from runs where id >= 7"
expect "a restore with more rows than production fails even with a tolerance" 1 env TOLERANCE_PCT=50 bash "$repo_root/infra/backup/restore-test.sh"
pg -d "$PW_DB" -c "insert into runs values (7, 70), (8, 80)"

# Stale snapshot: wait past the limit, then ask for a 0 hour maximum.
sleep 2
expect "a snapshot older than the limit exits 2" 2 env MAX_AGE_HOURS=0 bash "$repo_root/infra/backup/restore-test.sh"

# A failing pg_dump must not leave a new snapshot behind.
before="$(restic snapshots --json | grep -o '"short_id"' | wc -l)"
expect "backup fails when the database cannot be dumped" 1 env PW_DB="missing_$suffix" bash "$repo_root/infra/backup/backup.sh"
after="$(restic snapshots --json | grep -o '"short_id"' | wc -l)"
if [[ "$before" == "$after" ]]; then
  echo "ok   - a failed dump leaves no snapshot"
else
  echo "FAIL - a failed dump created a snapshot ($before -> $after)"; failures=$((failures + 1))
fi

if [[ "$failures" -gt 0 ]]; then
  echo "$failures test(s) failed"
  exit 1
fi
echo "all backup tests passed"
