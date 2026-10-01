# M5 Launch Readiness Implementation Plan

**Goal:** everything in the M5 spec that is code, config or runbook, merged in one PR; everything that needs Rafif's hands is a checklist in that PR.

**Spec:** `docs/specs/2026-10-01-m5-launch-readiness-design.md`

**Execution:** three parallel workstreams (subagents on Sonnet, one worktree each, branched from `feat/m5-launch`), then Claude merges them into `feat/m5-launch`, writes the runbook sections and the `homelab-infra` changes, and runs a fresh whole-branch review.

## Global constraints

- TDD: every behavior change starts with a failing test.
- No emoji or decorative icons in UI. Status is text, never color alone.
- `localStorage` access always in try/catch.
- No secret values anywhere in the repo; `.env` keys are documented with placeholders only.
- No new runtime dependencies in `apps/web` (the Umami script is loaded from our own origin).
- Commit messages: plain, no attribution lines. Never `--no-verify`.
- Full gate before handing back: `pnpm lint`, `pnpm typecheck`, `pnpm test`; e2e (`pnpm e2e`) for workstreams B and C.

## Workstream A: ops (API + infra)

Files: `apps/api/src/app.ts`, `apps/api/src/app.test.ts`, `apps/api/sql/*.sql`, `apps/api/src/sql.test.ts` (or next to the existing DB integration tests), `infra/docker-compose.yml`, `infra/Caddyfile`, `infra/deploy.sh`, `infra/backup/{backup.sh,restore-test.sh,README.md}`, `infra/observability/{prometheus-scrape.yml,grafana-dashboard.json}`, `.github/workflows/ci.yml`.

1. **`GET /api/healthz`** returns `{status:"ok"}` with 200 and never touches the database (test: a `pingDb` that throws still yields 200). Keep the internal `/healthz`.
2. **Retention SQL** in `apps/api/sql/`: `d1-d7-retention.sql`, `finish-rate-by-incident.sql`, `daily-players.sql`. Read the Drizzle schema first and use the real table and column names. Each file is a single read-only query. An integration test (same harness as the existing API DB tests) seeds a fixed set of players and runs, executes each file, and asserts exact numbers.
3. **Umami in compose:** service `umami` (`ghcr.io/umami-software/umami:postgresql-latest` pinned to a digest or a version tag), profile `analytics`, `mem_limit: 384m`, logging anchor, `DATABASE_URL` to database `umami` with role `umami` and `${UMAMI_DB_PASSWORD}`, `APP_SECRET: ${UMAMI_APP_SECRET}`, `BASE_PATH: /stats`, depends on healthy postgres.
4. **Caddy:** `handle /stats/*` → `reverse_proxy umami:3000` (no path strip; Umami runs with `BASE_PATH=/stats`). When the analytics profile is off, `/stats/*` must not fall through to the SPA: return 404. Add `robots.txt` handling only if the web workstream does not ship a static one (it will: leave it to C). Add a real 404 for unknown paths that look like files (have an extension) outside `/assets/`, instead of serving index.html.
5. **`deploy.sh`:** when `COMPOSE_PROFILES` in `.env` contains `analytics`, idempotently create role `umami` (password from `.env`) and database `umami` owned by it before `compose up`. Must be safe to run on every deploy, and must not print the password.
6. **Backups:** `infra/backup/backup.sh` (`docker compose exec -T postgres pg_dump -Fc -U pitwall pitwall | restic backup --stdin --stdin-filename pitwall.dump --tag pitwall`, then `restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6`, then, if `RESTIC_OFFSITE_REPOSITORY` is set, `restic copy` to it). `restore-test.sh`: restore the latest snapshot into a throwaway `postgres:17-alpine` container on a random name, `pg_restore`, compare `count(*)` of every table in `public` against production, exit non-zero on any mismatch or if the snapshot is older than 36 hours, always remove the container (trap). Both use `set -euo pipefail`, read `RESTIC_REPOSITORY`/`RESTIC_PASSWORD_FILE` from the environment, and never echo secrets. Do the same for the `umami` database when it exists.
7. **CI job `backup`** in `ci.yml`: start the dev compose Postgres (or a service container), seed a few rows, install restic from the Ubuntu apt repo, run `backup.sh` against a local repo in `$RUNNER_TEMP`, run `restore-test.sh` (passes), then insert a row in production and run it again (must fail). SHA-pin any new action.
8. **Observability (prepared, not deployed):** a Prometheus scrape job snippet targeting `srv-pitwall-01` over the tailnet (placeholder target, comment explains that `/metrics` needs a host port bound to the tailnet IP when the Observability project happens), and a Grafana dashboard JSON with: request rate by route, 5xx rate, p95 latency, `runs_submitted_total` by result, `run_rejections_total` by reason, and the SLO (99.5% of `POST /api/runs` non-5xx under 500 ms over 28d). Check metric names against `apps/api/src/http/metrics.ts`. Validate the JSON parses in a test or CI step.

## Workstream B: analytics in the web app

Files: `apps/web/src/analytics/{analytics.ts,analytics.test.ts}`, call sites, `apps/web/vite-env.d.ts` (or the env typing file), `e2e/analytics.spec.ts`, `playwright.config.ts` only if needed.

1. `analytics.ts` exports `initAnalytics()` and `track(event, props?)`. Event names are a closed union: `shift_start`, `ack`, `shift_finish`, `share_click`, `hint_shown`. Props are a closed per-event type (`incident`, `mode`, `result` only; string values from known sets).
2. `initAnalytics()` injects `<script defer src="/stats/script.js" data-website-id=... data-auto-track="true">` only when `import.meta.env.VITE_UMAMI_WEBSITE_ID` is a non-empty string and `navigator.doNotTrack !== "1"`. Called once from the app entry.
3. `track()` calls `window.umami?.track(name, props)` inside try/catch; no-op when not initialized. Never throws, never queues.
4. Call sites: run start (daily and practice), first ack, run finish (resolved, DNF, abandoned if that exists), the share button(s), the guide hint becoming visible (once per run). Find each in the code; do not duplicate events on re-render (fire from the state transition, not from render).
5. Tests: unit tests for the gating (no ID, DNT on, normal), for `track` being safe when `window.umami` is missing or throws, and for each call site firing exactly once per transition (component tests with a stubbed `window.umami`).
6. e2e: a build with `VITE_UMAMI_WEBSITE_ID=e2e-test` is not wanted for the whole suite. Instead, in `e2e/analytics.spec.ts`, intercept `/stats/script.js` with a stub that defines `window.umami.track` recording calls, and assert the events of one scripted shift. If that requires the env var at build time, add it to the e2e build only (as with `VITE_PIN_INCIDENT`) and make sure the existing specs do not depend on it.

## Workstream C: before-launch pass and deferred minors

Files: `apps/web/index.html`, `apps/web/public/robots.txt`, landing/cafe copy files, `apps/web/src/os/apps/tools/DeploysApp.tsx`, the "Open in" component, `apps/web/src/os/guide/*`, the glossary `Term` usage on severity tags, their tests.

1. **Launch check (UI quality bar):** read `docs/DESIGN.md` and the M5 launch-check notes in `docs/plans/2026-09-27-roadmap.md`. Verify and fix: a one-line pitch visible on the first screen; exactly one primary call to action per page or view; document title per view if the app changes it; meta and OG description match the pitch; favicon and `og.png` exist and are referenced; no placeholder text (`grep -ri "lorem\|todo\|placeholder\|tbd"` over user-facing strings); `robots.txt` allowing all with no sitemap claim. Write a short checklist with each item's result into the PR description draft at `docs/plans/2026-10-01-m5-launch-check.md`.
2. **DeploysApp empty service cards:** a service with no deploys or config changes shows a single muted line ("No changes in the last 24 hours") instead of an empty card. Test first.
3. **"Open in" for hidden-only tools:** an "Open in" link must never point at a tool that is not offered for the current incident. Test first.
4. **Veteran hints:** a player who has completed at least 3 shifts (any result) stops getting next-step hints even if they never resolved one. Use the existing prefs storage (try/catch). Test first.
5. **Term tab stops:** the Crit/Warn severity tags in the service map must not add one tab stop per tag; the glossary for them is reachable once (for example from the legend). Keyboard test first.

## Claude (after merging A, B, C into `feat/m5-launch`)

1. Runbook `docs/runbooks/srv-pitwall-01.md`: M5 sections in the P05 contract: backups (rclone GDrive remote, restic init, Vault entries, Ansible role apply, first backup, first restore test, rollback), Umami (`.env` keys, generating secrets on the box without printing them, profile on, first login, password change, website ID into the GitHub variable), external uptime monitor, Cloudflare WAF rules, Prometheus/Grafana "later" section, move-to-VPS runbook.
2. `homelab-infra`: Ansible role `pitwall_backup` (restic + rclone packages, scripts, systemd service + timers for nightly backup 03:15 and weekly restore test Sun 04:00, `OnFailure` journald logging) on a branch for Rafif to review. No Terraform change (RAM unchanged).
3. `deploy.yml`: pass `VITE_UMAMI_WEBSITE_ID` from a repo variable into the web build.
4. Fresh whole-branch review, fix Critical and Important, PR, merge after green CI, watch `public-smoke`.
5. Roadmap row M5 → "Shipped (code); ops checklist with Rafif". Playbook lessons.
