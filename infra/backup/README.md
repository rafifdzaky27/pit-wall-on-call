# Backups

Nightly `pg_dump` of production Postgres into a local restic repository on `srv-pitwall-01`, copied offsite (GDrive via rclone), plus a weekly restore test. Retention: 7 daily, 4 weekly, 6 monthly. Design: `docs/specs/2026-10-01-m5-launch-readiness-design.md` (L5-1).

| Script | What it does |
|---|---|
| `backup.sh` | Dumps `pitwall` (snapshot tag `pitwall`) and, if it exists, `umami` (tag `umami`); prunes; copies to `RESTIC_OFFSITE_REPOSITORY` when set. |
| `restore-test.sh` | Restores the newest snapshot of each database into a throwaway `postgres:17-alpine` container and compares `count(*)` of every table in schema `public` with production. Exit 0 ok, 1 mismatch or restore failure, 2 snapshot older than `MAX_AGE_HOURS` (36). The scratch container is always removed. |

Both read `RESTIC_REPOSITORY` and `RESTIC_PASSWORD_FILE` from the environment (the password lives in a root-only file, never on a command line) and never print them. They run from the directory that holds `docker-compose.yml` and `.env` (`COMPOSE_DIR`, default `infra/`).

## Environment

| Variable | Meaning |
|---|---|
| `RESTIC_REPOSITORY` | required, local repo, e.g. `/var/backups/pitwall-restic` |
| `RESTIC_PASSWORD_FILE` | required, file with that repo's password |
| `RESTIC_OFFSITE_REPOSITORY` | optional, e.g. `rclone:gdrive:pitwall-backups` |
| `RESTIC_OFFSITE_PASSWORD_FILE` | optional, defaults to `RESTIC_PASSWORD_FILE` |
| `MAX_AGE_HOURS` | restore test: oldest acceptable snapshot, default 36 |
| `TOLERANCE_PCT` | restore test: default 0 (counts must be equal). Production keeps taking writes after the snapshot, so a weekly test that does not run right after `backup.sh` needs a small positive value. A restore can never have more rows than production. |
| `PW_DB`, `PW_DB_USER`, `UMAMI_DB` | default `pitwall`, `pitwall`, `umami` |

## One-time setup

```sh
restic init                                   # local repo
restic -r "$RESTIC_OFFSITE_REPOSITORY" init \
  --from-repo "$RESTIC_REPOSITORY" --from-password-file "$RESTIC_PASSWORD_FILE" \
  --copy-chunker-params                       # offsite repo, so `restic copy` deduplicates
```

When `srv-backup-01` exists only `RESTIC_REPOSITORY` changes.

## Why a temp file and not a pipe

A plain `pg_dump | restic backup --stdin` stores a snapshot even when `pg_dump` fails halfway. `backup.sh` writes each dump to a private temp file (umask 077, removed on exit) and hands it to restic only when `pg_dump` exited 0, so the newest snapshot is always a complete dump. restic's `--stdin-from-command` would do the same in one step, but it needs restic 0.17 and Ubuntu 24.04 ships 0.16. `infra/test/backup_test.sh` checks that a failing dump stores nothing.

Both scripts take the same `flock` (`BACKUP_LOCK`), so the nightly backup and the weekly restore test never overlap.

## Tests

`infra/test/backup_test.sh` runs both scripts against a throwaway database in the dev compose Postgres (`pnpm db:up`) and local restic repositories. It covers the passing path, a production row the backup does not have (must fail), a stale snapshot, the tolerance rules, the offsite copy, a failing dump, and scratch-container cleanup. CI runs it in the `backup` job; locally it needs `docker`, `restic` and GNU `date`.
