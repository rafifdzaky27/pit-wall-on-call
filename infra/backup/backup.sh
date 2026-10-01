#!/usr/bin/env bash
# Nightly backup of the production Postgres into a restic repository.
#
#   pg_dump -Fc (inside the postgres container) -> restic snapshot tagged "pitwall"
#   the same for the Umami database, tagged "umami", when that database exists
#   restic forget --prune: keep 7 daily, 4 weekly, 6 monthly
#   restic copy to RESTIC_OFFSITE_REPOSITORY (the GDrive repo), when it is set
#
# Environment (never printed by this script):
#   RESTIC_REPOSITORY            required, the local repo
#   RESTIC_PASSWORD_FILE         required, file holding that repo's password
#   RESTIC_OFFSITE_REPOSITORY    optional, e.g. rclone:gdrive:pitwall-backups
#   RESTIC_OFFSITE_PASSWORD_FILE optional, defaults to RESTIC_PASSWORD_FILE
#   COMPOSE_DIR                  directory holding docker-compose.yml and .env (default: infra/)
#   PW_DB, PW_DB_USER, UMAMI_DB  default pitwall, pitwall, umami
#
# restic's --stdin-from-command aborts the snapshot when pg_dump fails, so a broken
# dump can never become a "good" snapshot (a plain pipe would still store it).
set -euo pipefail
umask 077

: "${RESTIC_REPOSITORY:?set RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD_FILE:?set RESTIC_PASSWORD_FILE}"
PW_DB="${PW_DB:-pitwall}"
PW_DB_USER="${PW_DB_USER:-pitwall}"
UMAMI_DB="${UMAMI_DB:-umami}"

cd "${COMPOSE_DIR:-$(dirname "$0")/..}"

pg() {
  docker compose exec -T postgres "$@"
}

# dump_database <database> <tag>
dump_database() {
  restic backup --quiet --stdin-from-command --stdin-filename "$2.dump" --tag "$2" -- \
    docker compose exec -T postgres pg_dump -Fc -U "$PW_DB_USER" "$1"
  echo "backed up $1 (tag $2)"
}

database_exists() {
  [[ "$(pg psql -U "$PW_DB_USER" -d postgres -Atc "select 1 from pg_database where datname = '$1'" | tr -d '\r')" == "1" ]]
}

dump_database "$PW_DB" pitwall
if database_exists "$UMAMI_DB"; then
  dump_database "$UMAMI_DB" umami
fi

restic forget --prune --quiet --keep-daily 7 --keep-weekly 4 --keep-monthly 6

if [[ -n "${RESTIC_OFFSITE_REPOSITORY:-}" ]]; then
  # Command-line flags beat the RESTIC_REPOSITORY / RESTIC_PASSWORD_FILE environment (the local repo).
  offsite_password_file="${RESTIC_OFFSITE_PASSWORD_FILE:-$RESTIC_PASSWORD_FILE}"
  restic -r "$RESTIC_OFFSITE_REPOSITORY" --password-file "$offsite_password_file" \
    copy --from-repo "$RESTIC_REPOSITORY" --from-password-file "$RESTIC_PASSWORD_FILE"
  restic -r "$RESTIC_OFFSITE_REPOSITORY" --password-file "$offsite_password_file" \
    forget --prune --quiet --keep-daily 7 --keep-weekly 4 --keep-monthly 6
  echo "copied to the offsite repository"
fi
