# Pit Wall On-Call: Design Spec (v1)

- **Status:** Approved in design review, 2026-09-27
- **Author:** Rafif Dzaky Daniswara (tech lead / PM), with Claude (engineer)
- **Source:** Product Opportunity Report, idea #24 and section 12.5

---

## 1. Problem statement

Junior DevOps/SRE engineers and people preparing for on-call interviews have no safe, fun way to practice incident response. Teams run "Wheel of Misfortune" sessions by hand, and there are few polished simulators.

**Pit Wall On-Call** is a browser game in which the player is on call during a live production incident. Alerts fire, dashboards mislead, logs hint at the cause, and the player must diagnose and act under real-time pressure. Each incident opens with a short playable **cold open**: the player's product is working normally, it breaks, and the pager goes off wherever the player happens to be (see `2026-09-28-cold-open-design.md`). Afterward, a postmortem-style debrief shows where the error budget went.

## 2. Goals and non-goals

### Goals (v1)
- Be the **seed of a real product**. v1 is small, but its seams (scenarios as content, a deterministic engine, a run log) support daily mode, scenario packs and team features later.
- Build a **B2C habit loop** for individual engineers: a daily incident, a leaderboard and a shareable result.
- Deliver a realistic, teachable experience in which the loudest service is not always the cause.
- Run it as a real service: CI/CD, observability, an SLO, and backups with restore tests.

### Non-goals (v1)
Accounts and login, payments, scenario editor, multiplayer, team or facilitator mode, fake terminal (until hard mode, D18), mobile-optimized console, replay viewer UI.

## 3. Decision log

| # | Decision | Choice | Alternatives rejected |
|---|---|---|---|
| D1 | v1 goal | Seed of a real product | Portfolio-only, validation-only, learning-only |
| D2 | First customer | Individual engineers (B2C) | B2B teams; B2C with B2B upsell |
| D3 | Game clock | Real-time on a deterministic, seeded simulation | Turn-based; hybrid |
| D4 | Interaction | Point-and-click console | Fake terminal; console with a limited terminal |
| D5 | Scoring | Error-budget % burned as the headline, plus a cause-tagged debrief breakdown | Single number only; multi-axis grades |
| D6 | v1 scope | 3 scenarios + daily incident + leaderboard | 3 scenarios only; 3 scenarios + daily |
| D7 | Timeline | Weekend sprint with an explicit cut line | 6 to 8 week plans |
| D8 | Architecture | TS monorepo, Docker Compose, self-hosted | Cloudflare Workers + D1; Next.js + Vercel |
| D9 | Scenario format | Typed TS config via `defineScenario()` | YAML + expression DSL; JSON keyframes |
| D10 | Console layout | Everything-visible "pit wall" plus a clickable service map | Tool switcher; map-only |
| D11 | Ranking | First daily attempt only; later attempts are unranked practice | Best of unlimited; best of 3 |
| D12 | Hosting | Everything on the homelab via Cloudflare Tunnel | VPS; split with web on CF Pages |
| D13 | Device support | Desktop-first console (≥1024px); other screens responsive | Full mobile support |
| D14 | Visual direction (2026-09-28) | "Variant 1": neutral observability console (IBM Plex, Grafana-like slate, blue accent), dark default plus light theme, **no motorsport theming and no decorative icons**. The product name stays as a name only. | Night telemetry; F1 broadcast language; Dense, Calm, Mono and Command variants |
| D15 | Cold open (2026-09-28) | A playable cold open is part of gameplay: hotspot clues, acknowledge time and escalation feed the score | Pure atmosphere; cinematic only |
| D16 | Cold open delivery (2026-09-28) | Engine paging rules land in M1; scene, audio and transitions land in a new milestone M1.5 | Everything in M1; defer to M4 |
| D17 | Desktop OS (2026-09-28) | The game runs inside **PitOS**, a fictional GNOME-style Linux desktop, and the desktop is the landing page. The café scene (M1.6) zooms out of it. See `2026-09-28-pitos-desktop-design.md`. | A marketing landing page; macOS- or Windows-like shells |
| D18 | Hard mode (2026-09-28) | A second difficulty adds a Terminal app: typed commands (`kubectl rollout undo …`) map to the same engine actions, so replay and scoring are unchanged. Leaderboards are separate per mode. This reverses D4 for hard mode only and ships in its own milestone. | Terminal as the only mode; no terminal |
| D19 | Localization (2026-09-28) | The seed picks the city (Jakarta, Tokyo, Melbourne, Yogyakarta at launch), and everyone shares the daily's city. Local archetypes are recreated faithfully, but brand names and visuals are original. | Near-copies of real brands; per-player location |
| D20 | HTTP realism (2026-09-28) | Symptoms appear as real status codes: server-default error pages in the Browser and a DevTools-like Network panel that always shows the number. | Generic "something went wrong" |
| D21 | License (2026-09-28) | Code AGPL-3.0-only; game content, names and art all rights reserved (`NOTICE.md`). | MIT; no license |
| D22 | Accounts and pricing (2026-09-28) | v1 keeps anonymous tokens (M2). Accounts come when cross-device progress or a paid tier needs them. Pricing is decided after launch data (§13). Working hypotheses: the daily stays free; paid archive and scenario packs; a team or facilitator mode as the B2B offer. | Decide pricing before launch |

## 4. Architecture

```
Player browser ──▶ Cloudflare (DNS, TLS, edge cache, WAF rate limit)
                        │  outbound tunnel (no inbound ports at home)
                        ▼
               homelab box: docker compose
               ├── cloudflared
               ├── caddy      /  → static web build
               │              /api → api
               │              /umami → umami
               ├── api        Hono (Node), imports @pitwall/engine
               ├── postgres   game DB + umami DB
               ├── umami      cookieless funnel analytics
               └── backup     nightly pg_dump → restic → offsite, plus a restore test
```

The browser runs the engine live. On completion it POSTs `(scenarioId, seed, engineVersion, actions[])`. The API **replays** the action log with the same engine and stores the authoritative score. The client never submits a score.

### Repository layout (pnpm workspaces)

```
pit-wall-on-call/
├── packages/
│   ├── engine/        # pure TS: seeded PRNG, fixed-tick sim, scoring. No I/O, no DOM.
│   └── scenarios/     # defineScenario() configs + golden-player tests
├── apps/
│   ├── web/           # Vite + React SPA
│   └── api/           # Hono API, Drizzle ORM + migrations
├── infra/             # docker-compose.yml, Caddyfile, deploy.sh, backup scripts
├── docs/specs/        # design docs and ADRs
└── .github/workflows/ # ci.yml, deploy.yml
```

### Boundaries
- `engine` is a pure function family. `(scenario, seed, actionLog) → (timeline, score)`. It is identical in the browser and on the server.
- `web` never touches the database. Scenarios are bundled at build time, and it calls the API only to register a player, fetch the daily incident, submit runs and read the leaderboard.
- `api` contains no game logic of its own and trusts only `engine` output.
- `scenarios` is content. Adding a scenario is a PR containing a config file, with no engine change.

## 5. Engine

### Determinism rules
1. All randomness comes from a seeded PRNG (mulberry32). `Math.random()` is forbidden in `engine` and `scenarios` (enforced by a lint rule).
2. There is no wall-clock time. The sim advances in fixed ticks of **100 ms game time**. Player actions are snapped to tick numbers.
3. Integer or fixed-precision math is used where results feed scoring, so V8 in the browser and in Node agree.
4. The package declares an `ENGINE_VERSION` constant, and each run records it.

### Tick loop
Each tick:
1. Apply fault dynamics (for example, `pool_used += leak_rate`).
2. Derive metrics from state, plus seeded noise.
3. Emit log lines and fire or clear alerts when their conditions hold.
4. Apply player actions due this tick. Actions have durations, and effects land when the duration completes.
5. Account for the error budget: `bad_requests += traffic × error_rate`, **tagged with a cause**.
6. Check the resolution condition, or the time limit (DNF).

### Burn cause tags
- `undetected`: before the first alert (not produced in v1: the page fires at tick 0; see §17)
- `unacknowledged`: the pager is ringing and the player has not acknowledged yet (D15)
- `investigating`: after the alert, with no mitigation in place
- `side_effect:<actionId>`: burn directly caused by a player action (for example, restart 503s)
- `mitigated_unfixed`: symptoms reduced, but the root cause is still active

The debrief breakdown is the sum of burn per tag. There are no arbitrary point penalties: wrong actions burn budget through the simulation itself.

### Scoring
- **Headline:** `budget_burned_bp`, the budget burned in basis points (1800 = 18%). Lower is better.
- **Tiebreak:** `mitigated_at_tick`. Lower is better.
- **DNF:** not resolved when the scenario time limit is reached. The score is the burn accumulated up to the limit. A DNF always ranks below every resolved run.

### Clock and pause
- 1 real second = 1 game second. Scenarios last 3 to 8 minutes.
- When the tab is hidden (`visibilitychange`), the incident auto-pauses and the console is hidden until the player resumes.

## 6. Scenarios

### Format
Typed TS config:

```ts
export default defineScenario({
  id: "db-pool-exhaustion",
  title: "The Slow Leak",
  difficulty: "normal",
  timeLimitS: 480,
  slo: { availability: 99.9, budgetRequests: 5_000 },
  services: [/* nodes + edges for the service map */],
  initial: { pool_used: 40, leak_rate: 0.8, deploy: "v142" },
  dynamics: (s, rng) => ({ ...s, pool_used: s.pool_used + s.leak_rate }),
  metrics: { db_pool_pct: s => s.pool_used /* ... */ },
  logs: [/* templates with conditions and per-service tags */],
  alerts: [/* threshold rules */],
  actions: [/* id, label, serviceId | global, category, durationS, effect, sideEffect */],
  resolvedWhen: s => s.leak_rate === 0 && s.pool_used < 60,
  variations: (rng) => ({ /* seed-driven timing/noise/red-herring choices */ }),
});
```

Action categories are `investigate`, `mitigate`, `fix` and `communicate`, shown as text labels (D14). Investigation is explicit per-service actions (for example "Check connection pool"): free in budget terms, but each costs clock time. Selecting a node on the map is UI only and is not recorded (§17).

### v1 lineup
1. **The Slow Leak.** Bad deploy v142 leaks DB connections, and the pool is exhausted. *Red herring:* postgres is loudest. *Fix:* roll back the api. *Trap:* restarting api pods gives temporary relief, 15 s of 503s, and the leak returns.
2. **Disk Full at 3AM.** Debug logging was left enabled, the DB volume fills, and writes fail. *Red herring:* a CPU spike from log rotation. *Fix:* disable debug logging and free space.
3. **Cache Stampede.** A Redis restart plus a cold cache creates a thundering herd on the DB. *Red herring:* scaling the DB helps briefly, then fails. *Fix:* enable request coalescing or rate limiting and warm the cache.

### Golden-player tests (CI gate)
Each scenario is played by three scripted players:
- 🟢 **Perfect:** must resolve, with a burn at or below the scenario's `par`.
- 🔴 **Do-nothing:** must DNF.
- 🟡 **Red herring:** must score strictly worse than perfect.

## 7. UI

### Flow
Landing (Daily Incident + 3 scenarios + leaderboard) → Briefing (about 10 s) → Console → Debrief → Share / Leaderboard.

### Console: "pit wall" layout
- **Top bar:** severity, incident title, game clock, error budget burned (live).
- **Left:** alert feed.
- **Center:** a clickable **service map** (nodes colored by health) above **two focused metric panels**. Clicking a node focuses the panels on that service, filters the log stream to it, and shows its actions.
- **Right:** actions for the selected service, plus always-visible global actions (post status update, ask the secondary on-call). A run resolves by itself once the fix holds for 10 s (§17).
- **Bottom:** log stream, filtered to the selected service with a "clear filter" control.
- Clues are spread across nodes on purpose. The loudest node is often not the root cause.

### Debrief
- Headline tiles: budget burned, mitigated-at time, root cause found, today's rank.
- A burn breakdown bar by cause tag.
- A timeline of key actions (useful, wasted or harmful).
- One debrief lesson (scenario-authored, selected by what the player did).
- Acknowledge time, whether escalation happened, and clues found in the cold open (for example "Clues found 1/2").

### Share card
Plain text copied to the clipboard, with no spoilers:
```
Pit Wall On-Call · Daily #42
Budget burned: 18%   Mitigated: 4:12
🟩🟩🟨🟥🟨🟩  root cause ✔
<url>/daily
```
Squares represent the action sequence: 🟩 useful, 🟨 wasted time, 🟥 harmful.

### Devices
The console needs ≥1024px. Smaller screens get landing, leaderboard and debrief pages, and the console shows "best played on a bigger screen."

## 8. API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/daily` | `{ date, dailyNumber, scenarioId, seed, engineVersion }`. Rolls over at 00:00 UTC. |
| POST | `/api/players` | `{ handle }` → `{ playerId, token }`. Only a hash of the token is stored. |
| POST | `/api/runs` | Bearer token. Body `{ scenarioId, seed, mode, engineVersion, actions[] }`. The server replays it and returns `{ runId, score, rank?, mode }`. |
| GET | `/api/leaderboard?date=YYYY-MM-DD` | Top 50 ranked runs, plus the caller's rank if a token is present |
| GET | `/healthz` | Liveness |
| GET | `/readyz` | DB reachable and migrations current |
| GET | `/metrics` | Prometheus |

### Validation pipeline for `POST /api/runs`
1. Zod schema: known `scenarioId`, known action IDs, non-decreasing integer ticks (several actions may share a tick), ≤200 actions, body ≤64 KB.
2. `engineVersion` must equal the server's version, otherwise `409` ("a new version shipped, refresh").
3. For daily mode, `seed` and `scenarioId` must match `/api/daily` for that date.
4. Replay. An action that isn't available at its tick gives `422`.
5. Ranking policy: the player's first daily submission is `daily_ranked`, and later ones are stored as `practice`.
6. Rate limits: per token and per IP (app level), plus a Cloudflare WAF rule on `/api/runs`.
7. Plausibility: humanly implausible runs (for example, a correct fix within 2 s of the first alert) are stored with `flagged = true` and excluded from the leaderboard until reviewed.

### Handles
3 to 20 characters, `[A-Za-z0-9_-]`, checked against a profanity list, and not unique (displayed as `handle#1234`, using the last 4 characters of the player ID).

## 9. Data model (Postgres, Drizzle migrations)

```sql
players(
  id uuid pk,
  token_hash text unique not null,
  handle text not null,
  created_at timestamptz not null default now()
)

runs(
  id uuid pk,
  player_id uuid not null references players(id),
  scenario_id text not null,
  mode text not null check (mode in ('daily_ranked','practice')),
  daily_date date null,
  seed bigint not null,
  engine_version text not null,
  actions jsonb not null,
  budget_burned_bp int not null,
  mitigated_at_tick int null,
  resolved boolean not null,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
)

CREATE UNIQUE INDEX one_ranked_daily_per_player
  ON runs (player_id, daily_date) WHERE mode = 'daily_ranked';
CREATE INDEX leaderboard_idx
  ON runs (daily_date, resolved DESC, budget_burned_bp, mitigated_at_tick)
  WHERE mode = 'daily_ranked' AND flagged = false;
```

The leaderboard is computed by a query, with no separate table. Stored action logs make a future replay viewer cheap to build.

## 10. Operations

### CI (every PR)
Lint (including the no-`Math.random` rule in engine and scenarios) → typecheck → engine unit tests → golden scenario tests → API integration tests against a Postgres service container → build → Playwright contract test. Branch protection on `main` requires all of these to be green.

### CD (merge to `main`)
1. Build `web` (Caddy + static build) and `api` images, tagged with the git SHA, and push to GHCR.
2. GitHub Actions joins the tailnet (`tailscale/github-action`, ephemeral tagged key) and SSHes to the homelab box.
3. Run `deploy.sh <sha>`: `compose pull`, a one-shot migration container, then `compose up -d`.
4. Smoke test: `/readyz`, plus replaying a known fixture run through `POST /api/runs` and checking its expected score.
5. If the smoke test fails, automatically roll back to the previous SHA. Manual rollback is `deploy.sh <previous-sha>`.
- **Never** use a self-hosted GitHub runner on the homelab for this public repo.

### Observability
- JSON logs (pino) with a request ID on every line.
- `/metrics`: `runs_submitted_total{mode,result}`, `replay_duration_seconds`, `run_rejections_total{reason}`, `version_mismatch_total`, HTTP latency histograms. Scraped by the homelab Prometheus over Tailscale, with a Grafana dashboard.
- Uptime Kuma external check on the public URL, alerting to phone.
- **Service SLO:** 99.5% of `POST /api/runs` succeed (non-5xx) in under 500 ms over 28 days.

### Product analytics
- **SQL over players and runs:** D1 and D7 retention, finish rate and DNF rate per scenario.
- **Umami (self-hosted, cookieless):** funnel events `landing_view`, `run_start`, `run_finish`, `share_click`. No consent banner is needed.

### Backups
Nightly `pg_dump` → restic → offsite object storage, with a weekly automated restore test into a temporary Postgres container that verifies row counts.

## 11. Error handling
- **Client submit:** a finished run is persisted to localStorage until the server acknowledges it, with retries and exponential backoff.
- **API responses:** `400` schema · `401` bad token · `409` stale engine version · `422` impossible action log · `429` rate limited · `500` with a request ID shown to the player.
- **Replay failures** log `(scenarioId, seed, engineVersion, actions)`, which is a fully reproducible bug report that can be pasted into a test.
- **Engine exceptions** during replay produce a `500`. The run is not stored, and the payload is logged for reproduction.

## 12. Testing strategy
- TDD for `engine` and `api`.
- **engine:** PRNG determinism; tick ordering; scoring and cause tagging; replaying twice gives an identical result.
- **scenarios:** golden players (section 6).
- **api:** integration tests against real Postgres covering a valid run, a tampered action log, a second daily becoming practice, a `409` version mismatch, a `422` impossible action, `429` rate limiting, and leaderboard ordering including DNF and tiebreaks.
- **End to end (Playwright):** play a scripted run in a real browser and assert that the score shown in the debrief equals the score the server stored.

## 13. Success metrics
From the opportunity report:
- **Validation:** 200 plays, with 20% of them finishing and clicking share.
- **Kill criterion:** day-7 return rate below 10% after the daily mode has been live for 4 weeks.
- **Service:** the SLO above.

## 14. Risks and known gaps

| Risk / gap | Impact | Mitigation / acceptance |
|---|---|---|
| Homelab outage (power or ISP) | The whole game is down | Uptime Kuma alert; a documented move-to-VPS runbook (restore dump, repoint tunnel). Accepted for v1. |
| Clearing localStorage gives another ranked daily attempt | Leaderboard gaming | IP rate limits. Accounts close this later. Accepted. |
| A scripted perfect-play bot passes replay validation | Fake top scores | Plausibility flagging. Accepted (the same tradeoff as Wordle). |
| Content treadmill (the scenario library is the moat) | Retention stalls | TS scenario format, golden tests, and seed-driven daily variations stretch 3 scenarios further. |
| Weekend scope is aggressive | Slip | The cut line in section 15. |
| Stale client engine after a deploy | Rejected runs | `409` with a refresh prompt. The rejected run is not stored, so the player's ranked daily attempt is not consumed and they can replay the daily as ranked after refreshing. |

## 15. Sprint order and cut line
0. **Walking skeleton:** a "hello" page and `/healthz` deployed end to end (CI → GHCR → Tailscale → compose → Cloudflare Tunnel).
1. Engine + scenario 1 + console + debrief, playable locally.
2. Runs API + replay validation + leaderboard.
3. Daily mode + ranking policy.
4. ✂️ **Cut line.** Items 0 to 3 ship this weekend.
5. Scenarios 2 and 3, share card, Umami, polish.

## 16. Open questions (to resolve during planning)
- Domain name and public URL.
- Which homelab host or VM runs the stack, and its resources.
- The offsite backup target (for example, Backblaze B2).
- Pricing and packaging, after launch data (D22).

## 17. Revisions

| Date | Change | Source |
|---|---|---|
| 2026-09-28 | `undetected` is not produced in v1: the page fires at tick 0, so there is no pre-alert window. | M1 plan P1 |
| 2026-09-28 | No "declare resolved" action: a run resolves once its resolve condition holds for 10 s; `mitigated_at_tick` is the start of that stretch. | M1 plan P2 |
| 2026-09-28 | Selecting a node is UI only. Investigation is explicit per-service actions that cost clock time. | M1 plan P3 |
| 2026-09-28 | Action ticks must be non-decreasing (several actions may share a tick), replacing "strictly increasing" in §8. | M1 plan P4 |
| 2026-09-28 | The player runs one timed action at a time; `ack` and `inspect` are instant and never blocked. | M1 plan P6 |
| 2026-09-28 | Action categories are shown as text labels; the category emoji in §6 are dropped (D14). | M1 plan P7 |
