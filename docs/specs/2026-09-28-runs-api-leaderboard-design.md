# Runs API and practice leaderboard: design spec (M2)

- **Status:** written 2026-09-28 and implemented in M2 without a separate review gate (Rafif: "execute the spec and implementation now"). Decisions L1–L4 were answered by Rafif before writing.
- **Parent spec:** `2026-09-27-pit-wall-on-call-design.md` §4, §8–§12. This spec narrows those sections for M2 and records where it departs from them.
- **Roadmap row:** M2, "Runs API + leaderboard": server-validated scores.

## 1. What M2 delivers

A finished shift can be posted to the server. The server replays the action log with the same engine, stores the authoritative score, and ranks it on a **practice leaderboard**. The player sees their rank in the postmortem and the full board as a site in the PitOS Browser. Screens narrower than 1024 px see the board under the lock screen.

The daily incident, first-attempt ranking and the queued offline submission stay in M3.

## 2. Decisions

| # | Topic | Decision | Rejected |
|---|---|---|---|
| L1 | What the board ranks before the daily exists | A **practice board per scenario**: each player's best shift, all time, labelled "Practice · best shift per player". In M3 the daily board becomes the main tab and this one the second tab. Seeds are random, so luck plays a small part; the golden tests keep every seed from 1 to 50 under par for a perfect player. | A daily-only board that stays empty until M3; pulling the daily seed into M2 |
| L2 | Where the board lives | A **site in the PitOS Browser**: a second tab, "Leaderboard · Pit Wall On-Call", at the real address (`https://<host>/leaderboard`), reachable from a bookmarks bar and from the postmortem. Below 1024 px, the lock screen shows the same board. | A new dock app; postmortem only |
| L3 | Handle and submission | The **postmortem asks** the first time: "Pick a handle to post this shift". After that, every finished shift is posted automatically. Settings → Account shows and changes the handle. | A random handle; asking before Start shift |
| L4 | Dependencies | API: `drizzle-orm`, `drizzle-kit` (dev), `zod`, `pino`, `prom-client`. Postgres 17 in Docker for local tests, a service container in CI. Rate limiting and HTTP metrics are written in-house. The web app gains no dependency. | Hand-written logs and metrics |
| L5 | Ranking practice runs | D11 ("first daily attempt only") governs the daily board. The practice board ranks each player's best shift, so extra shifts cannot hurt a player. | Ranking every run; ranking the latest run |
| L6 | Idempotent posting | Each finished shift has a client-generated `runKey` (UUID). Posting the same key twice returns the first result (200) and stores nothing new. M3's queued submission relies on this. | Accepting duplicates |
| L7 | Deploy smoke test | `POST /api/runs` accepts `dryRun: true` without a token: it validates and replays, returns the score, and stores nothing. The deploy smoke test replays a fixture through Caddy this way, so production data stays clean. | Registering a smoke player on every deploy |
| L8 | Migrations | Drizzle Kit generates SQL migrations into `apps/api/drizzle/`. `deploy.sh` runs a one-shot `node dist/migrate.js` before `compose up`. Migrations must be backward compatible (add, never drop or rename, in the same release), because a failed smoke test rolls back to the previous image on the new schema. | Migrating on API start-up |
| L9 | `/metrics` exposure | Served by the API next to `/healthz` and `/readyz`. Caddy proxies `/api/*` only, so it is not public. Scraping it from the homelab Prometheus and the Grafana dashboard are M5. | Publishing a port now |

## 3. API

Every error has the body `{ "error": { "code", "message", "requestId" } }`, and every response has an `X-Request-Id` header.

| Method | Path | Auth | Request | Success |
|---|---|---|---|---|
| POST | `/api/players` | none | `{ handle }` | `201 { playerId, handle, tag, token }` |
| GET | `/api/players/me` | Bearer | | `200 { playerId, handle, tag }` |
| PATCH | `/api/players/me` | Bearer | `{ handle }` | `200 { playerId, handle, tag }` |
| POST | `/api/runs` | Bearer (not for `dryRun`) | `{ scenarioId, seed, mode: "practice", engineVersion, runKey, actions, dryRun? }` | `201 { runId, mode, flagged, score, board }`, or `200` with the same body for a repeated `runKey`, or `200 { score }` for a dry run |
| GET | `/api/leaderboard?scenario=<id>` | optional Bearer | | `200 { board: "practice", scenarioId, total, entries, you }` |
| GET | `/healthz`, `/readyz`, `/metrics` | none; not proxied by Caddy | | `/readyz` is 503 unless the DB answers **and** every bundled migration has been applied |

- **Token:** `pw_` followed by 32 random bytes in base64url. Only its SHA-256 (hex) is stored.
- **Tag:** the last 4 characters of the player ID; handles show as `handle#tag`.
- **Handle:** trimmed, then 3–20 characters of `[A-Za-z0-9_-]`, and not on the profanity list. Profanity is matched after lower-casing, removing `-` and `_`, and undoing common digit swaps (`0→o 1→i 3→e 4→a 5→s 7→t`). Long words match anywhere in the handle; short ones only match the whole handle. A rejected handle gets `400 handle_rejected`.
- **`score`:** `{ outcome, budgetBurnedBp, mitigatedAtTick, endTick }`.
- **`board`:** `{ rank, total, best }`. `rank` is the player's place on the practice board (null while flagged), `total` the number of ranked players, and `best` whether this shift is now the player's best.
- **Leaderboard entry:** `{ rank, handle, tag, budgetBurnedBp, mitigatedAtTick, outcome, runId, you }`. `entries` is the top 50. `you` is the caller's entry when a valid token is sent and they are ranked, otherwise null.

### Validation pipeline for `POST /api/runs`, in order

1. **Rate limit** (`429`, with `Retry-After`).
2. **Body size:** at most 64 KB (`413 payload_too_large`).
3. **JSON**, then **`engineVersion`**: it must equal the server's `ENGINE_VERSION`, otherwise `409 stale_version`. This runs before the full schema, so a stale client whose actions no longer exist still gets 409, not 400.
4. **Schema** (zod, `400 schema`):
   - `scenarioId` is a known scenario;
   - `seed` is an integer from 0 to 2³²−1;
   - `mode` is `"practice"` (M3 adds `"daily"`);
   - `runKey` is a UUID;
   - `actions` has 1 to 200 items of `{ tick, actionId }`, ticks are non-negative integers and non-decreasing;
   - every `actionId` is `ack`, one of the scenario's action IDs, or `inspect:<hotspot>` for one of its cold-open hotspots.
5. **Token** (`401 unauthorized`), skipped for `dryRun`.
6. **Idempotency:** a known `(player, runKey)` returns the stored result with 200.
7. **Replay.** `ActionRejected` gives `422 impossible_actions` with its reason. Any other exception gives `500`; the run is not stored, and the payload is logged.
8. **Plausibility:** a run is stored with `flagged = true` when a root-cause action starts less than 2 s (20 ticks) after the page. Flagged runs are not ranked.
9. **Store and rank.**

### Rate limits (in memory, per API process)

| Route | Per token | Per IP |
|---|---|---|
| `POST /api/runs` | 20 a minute | 60 a minute |
| `POST /api/players` | | 10 an hour |
| `PATCH /api/players/me` | 10 an hour | |
| `GET /api/leaderboard` | | 120 a minute |

The client IP is `CF-Connecting-IP` (Cloudflare sets it at the edge, and the API is reachable only through the tunnel and Caddy), then the first `X-Forwarded-For` entry, then `"local"`.

## 4. Data model

Spec §9's `players` and `runs`, with two additions:
- `runs.client_run_id uuid not null`, unique per player (L6);
- a partial index for the practice board: `(scenario_id, player_id, resolved desc, budget_burned_bp, mitigated_at_tick, created_at) where mode = 'practice' and flagged = false`.

**Practice board order:** resolved runs first, then lower `budget_burned_bp`, then earlier `mitigated_at_tick` (DNF has none and sorts last), then the earlier `created_at`. Each player appears once, with their best run under that order. Ranks are 1, 2, 3… with no shared places, because `created_at` breaks every tie.

## 5. Observability

- **Logs:** pino JSON on stdout. One line per request: `reqId`, `method`, `path`, `status`, `ms`. Replay failures log `scenarioId`, `seed`, `engineVersion` and `actions`. Tokens and handles are never logged.
- **Metrics:** `runs_submitted_total{mode,outcome}` (mode `practice` or `dry_run`), `run_rejections_total{reason}`, `version_mismatch_total`, `replay_duration_seconds`, `http_request_duration_seconds{method,route,status}`, plus Node process defaults.

## 6. Web

### Player and posting
- The player (`{ playerId, handle, tag, token }`) is stored in `localStorage` under `pitwall.player`.
- When a shift ends and a player exists, it is posted at once. Network errors and 5xx retry after 1, 2 and 4 s, then stop and offer "Try again". M3 persists the pending post across reloads.
- A `401` forgets the stored player and asks for a handle again.

### Postmortem: the "Leaderboard" section

| State | Copy | Controls |
|---|---|---|
| No handle yet | "Pick a handle to post this shift to the practice leaderboard." Field "Handle", hint "3 to 20 letters, numbers, - or _." | **Post score**, Not now |
| Not now | "This shift was not posted." | Post score |
| Posting | "Posting your score…" | |
| New best | "New best: #12 of 340 on the practice leaderboard." | View leaderboard |
| Not a new best | "Posted. Your best is still #8 of 340." | View leaderboard |
| Flagged | "Posted and held for review. Fixes this fast are checked by hand." | View leaderboard |
| Handle rejected | "Pick a different handle." | the form again |
| 409 | "A new version of Pit Wall On-Call is out, so this shift can't be posted. Refresh to play the new version." | Refresh |
| 422 | "The server replayed this shift and could not accept it, so it wasn't posted." | |
| 429 | "Too many shifts posted in a short time. Try again in a minute." | Try again |
| Network or 5xx | "Couldn't reach the leaderboard (request <id>)." The ID is left out when there is none. | Try again |

### Browser: the leaderboard site
- A bookmarks bar under the toolbar holds two bookmarks: the store and "Pit Wall leaderboard".
- The leaderboard opens as a second tab (from the bookmark or from "View leaderboard"). Tabs switch with a click, and each has its own close button. Closing the last tab closes the window, as before.
- The tab's address is `https://<location.host>/leaderboard`, and its page has its own Back, Forward (disabled) and Reload. It has no Network panel.
- **Page:** heading "Practice leaderboard", subtitle "<scenario title> · best shift per player · all time", and a table with Rank, Player, Budget burned, Mitigated and Result ("Resolved" or "DNF"). The caller's row is marked "(you)". If the caller is outside the top 50, their row follows a gap.
- **States:** loading ("Loading the leaderboard…"), empty ("No shifts posted yet. Finish a shift and post it from its postmortem."), and error ("Couldn't load the leaderboard." with Try again).

### Settings → Account
- **With a player:** "Handle" with an editable field and Save, the tag, and **Remove from this device**, which forgets the token (posted shifts stay on the board).
- **Without one:** "You have no leaderboard handle yet. Finish a shift and post it from its postmortem."

### Below 1024 px
The lock screen shows the leaderboard page under its card, loaded lazily.

## 7. Delivery

- **CI:** the `check` job gets a Postgres 17 service on port 54329. API integration tests and the e2e API run against it.
- **Local:** `pnpm db:up` starts the same Postgres (`infra/docker-compose.dev.yml`). API tests create a throw-away database per test file.
- **e2e:** Playwright starts two servers: the API (a fresh `pitwall_e2e` database, migrated) on 8787, and `vite preview`, which proxies `/api`. The contract test plays a scripted shift, posts it, and checks that the score in the debrief equals the score the server stored.
- **CD:** `deploy.sh` runs the migration after the pull and before `up`, and the smoke test adds the dry-run replay through Caddy (`node dist/smoke.js http://web:80`).

## 8. Out of scope (M3 and later)
- `/api/daily`, daily mode, first-attempt ranking and the date board.
- Persisting a pending post across reloads.
- Reviewing flagged runs (a SQL query for now).
- Prometheus scraping and Grafana (M5).
