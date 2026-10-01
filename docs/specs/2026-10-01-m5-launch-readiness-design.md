# M5: Launch readiness (design)

**Date:** 2026-10-01
**Goal:** safe to post on r/devops and Hacker News: a stranger's score survives a disk failure, we learn whether people come back, we hear about an outage before players do, and the first page explains itself.

## Context and constraints

- Rafif's homelab is at playbook P05. `srv-mon-01` (Observability) and `srv-backup-01` (Backup 3-2-1) do not exist yet and are **not** prerequisites for launch.
- `srv-pitwall-01` has 1.5 GiB RAM. Proxmox showed 101.76% memory usage on 2026-10-01, but that is the host-side view including guest page cache. Measured inside the guest the same day: 572 MB used, **890 MB available**, no swap; containers total ~86 MB (web 10, api 31, postgres 27, cloudflared 17). Umami fits without a RAM change; it gets `mem_limit: 384m` so it can never starve Postgres.
- Homelab, Cloudflare, accounts and secrets are Rafif's hands. Claude writes code, scripts, config and runbook steps in the P05 execution contract (RUN IN / WORKING DIRECTORY / FILE / ACTION / VERIFY / EXPECTED / ERROR / STOP, rollback, idempotency, no printed secrets).

## Decisions

| ID | Decision | Rejected |
|---|---|---|
| L5-1 | **Backups run on `srv-pitwall-01` now.** Nightly `pg_dump -Fc` via `docker compose exec` → `restic backup --stdin` into a local repo on the VM, then `restic copy` to an offsite repo on GDrive via rclone. Retention: 7 daily, 4 weekly, 6 monthly. A weekly restore test restores the latest snapshot into a throwaway `postgres:17-alpine` container and compares row counts per table with production. Both run from systemd timers installed by an Ansible role in `homelab-infra`. When `srv-backup-01` exists, only the repo URL changes. | Waiting for `srv-backup-01`; a backup sidecar container (harder to reach rclone auth and the host timer) |
| L5-2 | **External uptime monitor** (UptimeRobot or Better Stack free tier, Rafif's account) on a new public `GET /api/healthz`, alerting to phone. An in-homelab Uptime Kuma cannot alert when the homelab itself is down; it becomes an optional second check later. | Uptime Kuma as the only check |
| L5-3 | **Umami, self-hosted, same-origin.** Umami runs in the compose stack against its own database in the existing Postgres. Caddy serves it under `/stats/*` (script and collect endpoint), so there is no third-party request and ad blockers matter less. The web app loads the script only when `VITE_UMAMI_WEBSITE_ID` is set at build time and the browser does not send Do Not Track; otherwise every `track()` call is a no-op. The service sits behind the compose profile `analytics`, so it starts only once Rafif has put `COMPOSE_PROFILES=tunnel,analytics` and the Umami secrets into the server's `.env`; `deploy.sh` creates the `umami` database and role idempotently when the profile is on. | Umami Cloud (third party, contradicts the spec); Plausible (heavier) |
| L5-4 | **Funnel events:** `landing_view` (pageview), `shift_start {incident, mode}`, `ack`, `shift_finish {result, incident, mode}`, `share_click`, `hint_shown`. No player identifiers, no free text. | Per-action events (noise, and they reveal the solution path) |
| L5-5 | **Retention SQL** lives in `apps/api/sql/` (D1, D7, finish and DNF rate per incident, daily players). Each query is exercised by an API integration test against seeded Postgres so it cannot rot. Run by hand with `docker compose exec -T postgres psql`. | A dashboard UI (not needed for 200 plays) |
| L5-6 | **Prometheus and Grafana are prepared, not deployed.** `infra/observability/` gets a scrape-config snippet and a dashboard JSON (request rate, 5xx rate, p95 latency, runs submitted by result, rejections by reason, SLO burn). The runbook section says "plug in at the Observability project". `/metrics` stays private. | Deploying Prometheus on the 1.5 GiB VM |
| L5-7 | **Cloudflare WAF rate-limit rule** on `POST /api/runs` (and a looser one on `/api/*`), written as exact dashboard steps. The API's own 429 stays as the second layer. | Relying on the API limit alone |
| L5-8 | **Move-to-VPS runbook**: provision a VPS, install Docker, restore the latest restic snapshot, start the compose stack, point the `pitwall-prod` tunnel at it. Target RTO 1 hour, RPO 24 hours. | — |
| L5-9 | **Before-launch pass** (UI quality bar launch check): one-line pitch, one primary call to action per page, titles, meta and OG descriptions, favicon and OG image checked, no placeholder text, a real 404 for unknown non-SPA paths, `robots.txt`. | — |
| L5-10 | **Deferred minors from M4/M4.5** ship here: DeploysApp empty service cards, "Open in" for hidden-only tools, hints for veteran players who never resolved, Crit/Warn term tab stops. | — |

## Work split

**Code (Claude, this PR):**
1. `GET /api/healthz` public alias.
2. `apps/web/src/analytics/` (`track`, script loader, DNT, no-op default) and the event call sites.
3. Umami service in compose, Caddy `/stats/*`, `deploy.sh` and `.env` keys (no secret values).
4. `apps/api/sql/*.sql` and their tests.
5. `infra/backup/` scripts (`backup.sh`, `restore-test.sh`) with a CI job that runs both against a throwaway Postgres and a local restic repo.
6. `infra/observability/` scrape snippet and dashboard JSON.
7. Before-launch pass and the deferred minors.
8. Runbook M5 sections; Ansible role and Terraform diff prepared for `homelab-infra` (Rafif reviews and applies).

**Rafif's hands (checklist in the PR):**
1. ~~Measure RAM on `srv-pitwall-01`~~ done 2026-10-01: 890 MB available, no change needed.
2. rclone GDrive auth (browser) and the restic password into Ansible Vault.
3. Apply the backup role; run the first backup and restore test.
4. Create the Umami admin password and website; put the website ID into the GitHub variable.
5. External uptime monitor account and check.
6. Cloudflare WAF rules.
7. Outsider re-test.

## Testing

- Unit: `track` no-ops without an ID and under DNT; event payloads contain only the allowed keys.
- API: `/api/healthz` 200 without touching the database; every SQL file runs and returns the expected numbers on a fixed seed.
- CI: backup then restore-test against a throwaway Postgres; the restore test fails when a table's row count differs.
- e2e: the existing suite still passes with analytics off; one test with a fake website ID asserts that events are sent to `/stats/` only.

## Out of scope

Prometheus/Grafana deployment, Uptime Kuma, `srv-backup-01`, hard mode (M6).
