# M2: Runs API and Practice Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A finished shift is posted to the API. The server replays it with the same engine, stores the authoritative score, and ranks the player's best shift on a practice leaderboard. The player sees the result in the postmortem, in a Browser tab and (below 1024 px) under the lock screen.

**Architecture:**
- **API (`apps/api`):** Hono with small modules:
  - `db/` (Drizzle schema, migrations, migrate script, test databases);
  - `players/` (handles, tokens, routes);
  - `runs/` (request schema, plausibility, replay route);
  - `leaderboard/` (query, route);
  - `http/` (errors, request ID, logging, metrics, rate limits).
  `createApp(deps)` stays the single composition point, so tests build an app over a throw-away database.
- **Web:**
  - `apps/web/src/net/` holds a typed client and the stored player.
  - A `SubmissionProvider` posts finished shifts.
  - The postmortem, a new Browser tab, Settings → Account and the lock screen read from it.

**Tech Stack:** TypeScript ~6, Hono 4, drizzle-orm 0.45 and drizzle-kit 0.31, postgres.js 3, zod 4, pino 10, prom-client 15, Vitest 5, React 19, Playwright.

**Spec:** `docs/specs/2026-09-28-runs-api-leaderboard-design.md` (L1–L9, §3–§7), narrowing `docs/specs/2026-09-27-pit-wall-on-call-design.md` §8–§12.

## Global Constraints

- **Engine:** `ENGINE_VERSION` stays `1.0.0`, and golden scores do not change. The API has no game logic of its own: scores come only from `replay()`.
- **Security:**
  - Only the SHA-256 of a token is stored.
  - Tokens and handles are never logged.
  - SQL uses Drizzle or parameterised `sql` templates only.
  - `/metrics`, `/healthz` and `/readyz` stay outside `/api/*`.
- **Errors:** always `{ error: { code, message, requestId } }`. Codes: `schema`, `handle_rejected`, `unauthorized`, `stale_version`, `impossible_actions`, `payload_too_large`, `rate_limited`, `internal`.
- **Copy:** English, sentence case, exactly as spec §6. No emoji and no decorative icons.
- **Storage:** `localStorage` is always wrapped in try/catch.
- **Budgets:** the web main chunk grows by no more than 2 KB gzip (85,498 B on `main`). The web app gets no new dependency.
- **Tests:** API integration tests use real Postgres (`TEST_DATABASE_URL`, default `postgres://pitwall:pitwall@localhost:54329/pitwall`) with one database per test file. If Postgres cannot be reached, they fail and say to run `pnpm db:up`.
- **Commits:** conventional messages with no AI attribution trailers.

## Decisions made in this plan

| # | Topic | Decision | Why |
|---|---|---|---|
| P1 | 413 | An oversized body gets `413 payload_too_large`, not the parent spec's 400 | It is the correct HTTP status, and it is distinguishable in metrics |
| P2 | Response shape | `POST /api/runs` returns `{ runId, mode, flagged, score, board }` instead of `{ runId, score, rank?, mode }` | The postmortem needs the total, the best flag and the review state |
| P3 | Ties | `row_number()` over the board order plus `created_at` and `id` | Distinct places, stable across reads; the earlier shift wins a tie |
| P4 | Metrics registry | One `prom-client` `Registry` per `createApp` | Tests build many apps; the global registry would throw on duplicate metrics |
| P5 | IP for rate limits | `CF-Connecting-IP`, then the first `X-Forwarded-For`, then `"local"` | Caddy overwrites `X-Forwarded-For` with the cloudflared container address |
| P6 | Leaderboard freshness | The Browser's leaderboard tab refetches whenever it is opened or reloaded, and after each post | A tab opened before posting would show a stale board |

## Review Focus

1. **Retrying a post that the server already stored** (a timeout after the server committed): it must not add a second row. This is covered by `runKey` idempotency, in the Task 5 test "a repeated runKey returns the first result".
2. **A stored token whose player no longer exists** (for example, after a database reset): the client must forget it and ask for a handle again, not loop on 401. Covered by Task 8 "a 401 forgets the player".
3. **A stale client after a deploy** whose actions no longer exist: it must get 409, not 400. Covered by Task 5 "stale version wins over an unknown action".
4. **Board order with DNF runs, ties and a player's worse later shift.** Covered by the Task 6 ordering tests.
5. **Leaderboard tab state after a post:** it must show the new rank. Covered by Task 10 "refetches after a post".

---

### Task 1: Database, migrations and test databases

**Files:**
- Create:
  - `infra/docker-compose.dev.yml`
  - `apps/api/drizzle.config.ts`
  - `apps/api/src/db/schema.ts`
  - `apps/api/src/db/migrate.ts`
  - `apps/api/src/db/testing.ts`
  - `apps/api/src/db/migrations.test.ts`
  - `apps/api/drizzle/*` (generated)
- Modify:
  - `apps/api/src/db.ts` → `apps/api/src/db/client.ts`
  - `apps/api/src/app.ts` (readyz)
  - `apps/api/src/app.test.ts`
  - `package.json` (`db:up`)
  - `apps/api/package.json` (`db:generate`, `migrate`)

**Interfaces:**
- Produces:
  - `players` and `runs` Drizzle tables;
  - `createDb(url) → { sql, db, ping, pendingMigrations(): Promise<number>, close() }`;
  - `migrateDb(db)`;
  - `testDatabase() → Promise<{ url, db, sql, drop() }>`.

- [ ] **Step 1:** `infra/docker-compose.dev.yml`: `postgres:17-alpine`, user, password and database `pitwall`, port `54329:5432`, with a health check. Root script: `"db:up": "docker compose -f infra/docker-compose.dev.yml up -d --wait"`.
- [ ] **Step 2: Write the failing test** (`migrations.test.ts`):
  - A fresh test database has 1 pending migration before `migrateDb` and 0 after.
  - `players` and `runs` exist.
  - Inserting a second `daily_ranked` run for the same player and date violates `one_ranked_daily_per_player`.
  - Inserting a second run with the same `(player_id, client_run_id)` violates `runs_player_client_run_key`.
- [ ] **Step 3:** Run `pnpm --filter @pitwall/api test migrations`. Expected: FAIL, because the modules do not exist.
- [ ] **Step 4:** Write `schema.ts` from spec §4, with the columns of parent spec §9 plus `client_run_id`, and these indexes and constraints:
  - `one_ranked_daily_per_player` (unique, partial);
  - `leaderboard_idx` (partial);
  - `practice_board_idx` (partial);
  - `runs_player_client_run_key` (unique);
  - the `mode` check.
  Then run `pnpm --filter @pitwall/api db:generate` (`drizzle-kit generate`). Write `migrate.ts`: `migrateDb` uses `drizzle-orm/postgres-js/migrator` with `migrationsFolder` resolved as `../../drizzle` from `import.meta.url` in source and `../drizzle` from `dist`, and it is also a CLI entry when run directly. `pendingMigrations` compares the bundled `_journal.json` entry count with `drizzle.__drizzle_migrations` (a missing table counts as all pending). `testing.ts` creates `t_<random hex>` from the admin URL, migrates it, and drops it in `drop()`. If the connection is refused, it throws "Postgres is not reachable at … Run pnpm db:up".
- [ ] **Step 5:** Run the test again. Expected: PASS.
- [ ] **Step 6:** In `/readyz`, add the failing unit test "returns 503 migrations_pending when migrations are pending", with `pendingMigrations` injected as `async () => 1`. Implement it with the body `{ status: "not_ready", reason: "migrations_pending" }`. The existing readyz tests pass `pendingMigrations: async () => 0`.
- [ ] **Step 7:** Commit `feat(api): Drizzle schema, migrations and readiness check`.

### Task 2: Handles and tokens

**Files:**
- Create:
  - `apps/api/src/players/handle.ts`
  - `apps/api/src/players/profanity.ts`
  - `apps/api/src/players/token.ts`
  - `apps/api/src/players/handle.test.ts`
  - `apps/api/src/players/token.test.ts`

**Interfaces:**
- Produces:
  - `checkHandle(raw: string): { ok: true; handle: string } | { ok: false; code: "schema" | "handle_rejected" }`;
  - `newToken(): string`;
  - `hashToken(token): string`;
  - `tagOf(playerId): string`.

- [ ] **Step 1: Failing tests:**
  - `" rafif_27 "` becomes `rafif_27`;
  - `"ab"`, 21 characters, `"a b"` and `"é_abc"` give `schema`;
  - a listed long word inside a handle (`"xxFUCKxx"`, `"sh1thead"`) gives `handle_rejected`;
  - a short listed word only as the whole handle (`"ass"` is rejected, `"classic"` is accepted);
  - `newToken()` matches `^pw_[A-Za-z0-9_-]{43}$`, and two calls differ;
  - `hashToken` is 64 hex characters and deterministic;
  - `tagOf("…-0000abcd1234")` is `"1234"`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `profanity.ts` exports `LONG` (substring matches) and `SHORT` (whole-handle matches): a small English and Indonesian list.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): handle rules and bearer tokens`.

### Task 3: HTTP plumbing

**Files:**
- Create:
  - `apps/api/src/http/errors.ts`
  - `apps/api/src/http/rateLimit.ts`
  - `apps/api/src/http/metrics.ts`
  - `apps/api/src/http/clientIp.ts`
  - `apps/api/src/http/rateLimit.test.ts`
  - `apps/api/src/http/plumbing.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces:
  - `ApiError(status, code, message, headers?)`;
  - `createRateLimiter(now = Date.now) → { hit(bucket, key, max, windowMs): { ok: true } | { ok: false; retryAfterS } }`;
  - `createMetrics() → { registry, runsSubmitted, rejections, versionMismatch, replaySeconds, httpSeconds }`;
  - `clientIp(c)`;
  - `AppDeps` gains `logger` (a pino instance), `limiter`, `limits` (overridable per test) and `db`.

- [ ] **Step 1: Failing tests:**
  - the limiter allows `max` hits, then refuses with `retryAfterS` rounded up, and allows again after the window;
  - an unknown route returns 404 `{ error: { code: "not_found", … } }` with an `X-Request-Id` that matches the body's `requestId`;
  - a thrown `Error` in a route returns 500 `internal` with the request ID, and logs `err` with that `reqId` (captured by a pino destination stream);
  - `/metrics` returns `text/plain` containing `http_request_duration_seconds_bucket` after a request.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - the `requestId` middleware (`crypto.randomUUID()`);
  - a request log line (`reqId, method, path, status, ms`);
  - `app.onError` mapping `ApiError` to its status and everything else to 500;
  - `app.notFound`;
  - the `/metrics` route;
  - the timing middleware, using `c.req.routePath` as the route label.
- [ ] **Step 4:** Run the tests. Expected: PASS (and the existing app tests still pass).
- [ ] **Step 5:** Commit `feat(api): request IDs, JSON logs, metrics and rate limiter`.

### Task 4: Players routes

**Files:**
- Create:
  - `apps/api/src/players/routes.ts`
  - `apps/api/src/players/auth.ts`
  - `apps/api/src/players/players.test.ts`

**Interfaces:**
- Consumes: Task 1 `db`; Task 2 handle and token; Task 3 errors and limiter.
- Produces:
  - `playerFromToken(db, header): Promise<Player | null>`;
  - `requirePlayer(c)`, which throws 401.

- [ ] **Step 1: Failing integration tests:**
  - `POST /api/players {handle:"rafif"}` gives 201 with a token, a 4-character `tag` and a `playerId`, and the stored `token_hash` is not equal to the token;
  - `GET /api/players/me` with that token gives 200 with the same handle;
  - a bad or missing token gives 401 `unauthorized`;
  - `PATCH /api/players/me {handle:"rafif2"}` gives 200 and changes it;
  - a rejected handle gives 400 `handle_rejected`;
  - the 11th `POST /api/players` from one IP in an hour gives 429 with `Retry-After`.
- [ ] **Step 2:** Run the tests. Expected: FAIL (404).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): anonymous players with handles`.

### Task 5: `POST /api/runs`

**Files:**
- Create:
  - `apps/api/src/runs/schema.ts`
  - `apps/api/src/runs/plausibility.ts`
  - `apps/api/src/runs/routes.ts`
  - `apps/api/src/runs/schema.test.ts`
  - `apps/api/src/runs/plausibility.test.ts`
  - `apps/api/src/runs/runs.test.ts`
  - `apps/api/src/fixtures.ts`

**Interfaces:**
- Consumes: Task 4 `requirePlayer`; the engine's `replay` and `ActionRejected`; the scenarios' `getScenario`.
- Produces:
  - `parseRunBody(json): RunBody`, which throws `ApiError`;
  - `isImplausible(scenario, result): boolean`;
  - `boardPosition(db, scenarioId, playerId): Promise<{ rank, total } | null>`, which Task 6 implements, with a stub returning null in this task;
  - `PERFECT_RUN` and `PERFECT_EXPECTED` in `fixtures.ts` (seed 1, the golden perfect actions, and the replayed score as a literal).

- [ ] **Step 1: Failing unit tests** (`schema.test.ts`):
  - a valid body parses;
  - unknown scenario, negative or float seed, a seed of 2³², `mode:"daily"`, a bad `runKey`, 0 or 201 actions, a negative or float tick, decreasing ticks, `"inspect:nope"` and `"drop_tables"` each give 400 `schema`;
  - a wrong `engineVersion` with an unknown action gives 409 `stale_version`.

  **Failing unit tests** (`plausibility.test.ts`):
  - the golden perfect run is plausible;
  - the same run with the rollback at tick 10 (ack at 0) is implausible;
  - a DNF is never implausible.
- [ ] **Step 2: Failing integration tests** (`runs.test.ts`):
  - the valid perfect run gives 201, the `score` equals `PERFECT_EXPECTED`, `flagged` is false, and one row is stored with the replayed `budget_burned_bp`;
  - a tampered log gets the server's score: the same actions plus an extra `checkout.restart` return a higher burn than the untampered run, since the client never sends a score;
  - an impossible log (`checkout.rollback` before `ack`) gives 422 `impossible_actions` with the reason `not_acknowledged` in the message, and stores nothing;
  - a repeated `runKey` gives 200 with the same `runId`, and there is still one row;
  - a dry run without a token gives 200 `{ score }` and stores nothing;
  - no token gives 401;
  - a 70 KB body gives 413;
  - the 21st run in a minute from one token gives 429;
  - a stale version gives 409 and increments `version_mismatch_total`;
  - an implausible run gives 201 with `flagged: true` and `board.rank` null.
- [ ] **Step 3:** Run the tests. Expected: FAIL.
- [ ] **Step 4:** Implement the pipeline in spec §3 order, recording `replaySeconds`, `runsSubmitted` and `rejections`. On a non-`ActionRejected` replay exception, log `{ scenarioId, seed, engineVersion, actions }` and return 500.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Commit `feat(api): POST /api/runs replays and stores runs`.

### Task 6: The practice leaderboard

**Files:**
- Create:
  - `apps/api/src/leaderboard/query.ts`
  - `apps/api/src/leaderboard/routes.ts`
  - `apps/api/src/leaderboard/leaderboard.test.ts`
- Modify: `apps/api/src/runs/routes.ts` (the real `boardPosition`)

**Interfaces:**
- Produces:
  - `practiceBoard(db, scenarioId, { limit, playerId? }) → { total, entries, you }`;
  - `boardPosition`.

- [ ] **Step 1: Failing integration tests.** Seed rows directly with a helper `insertRun(db, player, fields)`, then check:
  - resolved runs rank above DNF runs;
  - a lower burn ranks higher, and an equal burn is broken by the earlier `mitigated_at_tick`, then the earlier `created_at`;
  - one row per player, with their best run, even when their later run is worse;
  - flagged runs and `daily_ranked` runs are excluded;
  - another scenario's runs are excluded;
  - `total` counts ranked players;
  - with 55 players, `entries` has 50, and a caller ranked 53 gets `you.rank` 53 with `you.you` true;
  - a request without a token gets `you: null`;
  - an unknown scenario gives 400 `schema`;
  - `POST /api/runs` now returns `board.rank` and `total`, and `best` is true on the first run and false on a worse second run.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement with a CTE (`DISTINCT ON (player_id)` in board order, then `row_number()`), joined to `players` for the handle.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): practice leaderboard`.

### Task 7: Server wiring, smoke test, CI and CD

**Files:**
- Create:
  - `apps/api/src/smoke.ts`
  - `apps/api/src/e2eServe.ts`
  - `apps/api/src/smoke.test.ts`
- Modify:
  - `apps/api/src/server.ts`
  - `apps/api/tsup.config.ts` (entries: server, migrate, smoke)
  - `apps/api/Dockerfile` (copy `apps/api/drizzle` to `/app/drizzle`)
  - `infra/deploy.sh`
  - `infra/test/deploy_test.sh`
  - `.github/workflows/ci.yml` (Postgres service, `TEST_DATABASE_URL`, `E2E_DATABASE_URL`)
  - `docs/runbooks/srv-pitwall-01.md`

- [ ] **Step 1:** Failing test `smoke.test.ts`: `runSmoke(baseUrl, fetchImpl)` resolves when the dry run returns `PERFECT_EXPECTED`, and rejects with "smoke replay scored X, expected Y" otherwise.
- [ ] **Step 2:** Implement `smoke.ts` (a CLI that exits 1 on failure), `server.ts` (pino, a real limiter, `createDb`) and `e2eServe.ts` (drop and create `pitwall_e2e`, migrate, serve on 8787).
- [ ] **Step 3:** `deploy.sh`:
  - after `pull`: `TAG="$NEW_TAG" docker compose run --rm api node dist/migrate.js` (a failure aborts before anything restarts);
  - `smoke_test` also requires `docker compose exec -T api node dist/smoke.js http://web:80`.
  `deploy_test.sh`: the fake docker records `run --rm api node dist/migrate.js`. Add cases for "a migration failure leaves .env on the old tag and starts nothing" and "the smoke replay failing rolls back".
- [ ] **Step 4:** Run `bash infra/test/deploy_test.sh`, `shellcheck` (if available locally; CI runs it), `pnpm --filter @pitwall/api build`, and `docker build -f apps/api/Dockerfile .`. Then run `node dist/migrate.js` from the image against the dev Postgres. Expected: all pass, and migrate prints that it applied the migrations.
- [ ] **Step 5:** Commit `feat(api): migrate step, smoke replay and Postgres in CI`.

### Task 8: Web client, stored player and submission

**Files:**
- Create:
  - `apps/web/src/net/client.ts`
  - `apps/web/src/net/player.ts`
  - `apps/web/src/net/SubmissionProvider.tsx`
  - `apps/web/src/net/client.test.ts`
  - `apps/web/src/net/submission.test.tsx`
- Modify:
  - `apps/web/src/App.tsx` (the provider inside `IncidentProvider`)
  - `apps/web/src/os/testing.tsx`

**Interfaces:**
- Produces:
  - `ApiError { status, code, requestId, retryAfterS }`;
  - `registerPlayer(handle)`, `me(token)`, `renamePlayer(token, handle)`, `postRun(token, body)` and `fetchLeaderboard(scenarioId, token?)`;
  - `loadPlayer()`, `savePlayer(p)` and `forgetPlayer()`;
  - `useSubmission() → { state: SubmitState, post(handle?: string), notNow(), retry() }`, where `SubmitState` is one of:
    - `{ kind: "idle" | "ask" | "declined" | "posting" }`
    - `{ kind: "posted"; board; flagged }`
    - `{ kind: "error"; error: ApiError | "network" }`
    - `{ kind: "rejected-handle" }`
  - `usePlayer()`;
  - `leaderboardVersion`, a number that increments after each post.

- [ ] **Step 1: Failing tests,** with a fake `fetch`:
  - finishing a shift with no player gives `ask`;
  - `post("rafif")` registers, saves the player and posts the run with `runKey`, `ENGINE_VERSION`, the seed and the result's actions, giving `posted`;
  - with a stored player, a finished shift posts automatically;
  - a network failure retries after 1, 2 and 4 s (fake timers) and then gives `error`;
  - a 401 forgets the player and gives `ask`;
  - 409, 422 and 429 give `error` without retrying;
  - a `handle_rejected` gives `rejected-handle`;
  - `notNow()` gives `declined`, and nothing is posted;
  - a new shift resets the state to `idle`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): post finished shifts to the API`.

### Task 9: The postmortem's Leaderboard section

**Files:**
- Create:
  - `apps/web/src/os/apps/postmortem/LeaderboardCard.tsx`
  - `apps/web/src/os/apps/postmortem/LeaderboardCard.test.tsx`
  - `apps/web/src/os/apps/postmortem/postmortem.css` (if needed)
- Modify: `apps/web/src/os/apps/postmortem/PostmortemApp.tsx`

- [ ] **Step 1: Failing tests:** one for each row of spec §6's postmortem table. Check the exact copy, the buttons shown, and that "View leaderboard" calls `openBrowserTab("leaderboard")`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement, with `aria-live="polite"` on the status line and the handle field validated before posting (same regex as the API).
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): leaderboard section in the postmortem`.

### Task 10: The leaderboard site in the Browser

**Files:**
- Create:
  - `apps/web/src/os/leaderboard/LeaderboardPage.tsx`
  - `apps/web/src/os/leaderboard/leaderboard.css`
  - `apps/web/src/os/leaderboard/LeaderboardPage.test.tsx`
  - `apps/web/src/os/apps/browser/StoreTab.tsx` (the current BrowserApp body)
  - `apps/web/src/os/apps/browser/LeaderboardTab.tsx`
- Modify:
  - `apps/web/src/os/apps/browser/BrowserApp.tsx`
  - `apps/web/src/os/apps/browser/browser.css`
  - `apps/web/src/os/apps/browser/browser.test.tsx`
  - `apps/web/src/os/shell/OsContext.tsx` (`browserTab`, `openBrowserTab`)

- [ ] **Step 1: Failing tests:**
  - `LeaderboardPage` shows loading, then the rows (rank, `handle#tag`, burn as a percentage, mitigated as `mm:ss` or "—", Resolved or DNF), the caller's row marked "(you)", and a gap row when `you.rank > 50`;
  - it shows the empty and error copy, and Try again refetches;
  - it refetches when `leaderboardVersion` changes.
  Browser:
  - a bookmarks bar with the store and "Pit Wall leaderboard";
  - the bookmark adds and selects a "Leaderboard · Pit Wall On-Call" tab whose address is `https://<host>/leaderboard`;
  - the store tab keeps its state (the route) when switching back;
  - closing the leaderboard tab returns to the store; closing the store tab when it is alone closes the window;
  - `openBrowserTab("leaderboard")` from outside opens the Browser on that tab.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Move the store logic unchanged into `StoreTab` (hidden, not unmounted, when inactive).
- [ ] **Step 4:** Run the tests, then the whole web suite. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): leaderboard site in the Browser`.

### Task 11: Settings → Account and the lock-screen board

**Files:**
- Create: `apps/web/src/os/apps/settings/AccountPage.tsx`
- Modify:
  - `apps/web/src/os/apps/settings/SettingsApp.tsx`
  - `apps/web/src/os/apps/settings/settings.test.tsx`
  - `apps/web/src/os/shell/OsContext.tsx` (`SettingsPageId` adds `account`)
  - `apps/web/src/os/shell/Lockscreen.tsx`
  - `apps/web/src/os/shell/Lockscreen.test.tsx`
  - `apps/web/src/styles/shell.css`

- [ ] **Step 1: Failing tests:**
  - Account with a player shows `handle#tag`, and Save renames (the PATCH is sent and the stored player updated);
  - a rejected rename shows "Pick a different handle.";
  - "Remove from this device" forgets the player;
  - without a player, it shows the no-handle copy;
  - the settings search finds "account", "handle" and "leaderboard";
  - below 1024 px the lock screen shows a "Practice leaderboard" region.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. The lock screen loads `LeaderboardPage` with `lazy()`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): account settings and the board under the lock screen`.

### Task 12: Contract e2e, docs and walkthrough

**Files:**
- Create: `e2e/leaderboard.spec.ts`, `docs/research/2026-09-28-m2-walkthrough.md`
- Modify:
  - `playwright.config.ts` (two web servers)
  - `docs/DESIGN.md` (§11 Leaderboard)
  - `README.md`
  - `docs/plans/2026-09-27-roadmap.md`
  - `docs/specs/2026-09-27-pit-wall-on-call-design.md` (§17 revisions)

- [ ] **Step 1: Contract test:** play the scripted whole run from `cafe.spec.ts` with `page.clock`, then:
  - the postmortem asks for a handle; enter `e2e_<random>` and press Post score;
  - it shows "New best: #"… on the practice leaderboard;
  - `GET /api/leaderboard?scenario=slow-leak` (through the page's `request`) holds an entry with that handle, whose `budgetBurnedBp` formatted by the debrief's rule equals the debrief's "Budget burned" tile;
  - View leaderboard opens the Browser tab, and the row "(you)" is visible.
- [ ] **Step 2:** Run `pnpm build && pnpm e2e`. Expected: every spec passes, three runs in a row.
- [ ] **Step 3:** Docs:
  - `DESIGN.md` §11 (the board, its states and the tab);
  - `README.md` (`pnpm db:up`, the API endpoints, running tests);
  - the roadmap (M2 ✅ with the plan, and the M3 row noting that the practice board becomes the second tab);
  - the parent spec §17 rows for P1, P2, L6, L7 and L9.
- [ ] **Step 4:** Persona walkthrough to the end: post a score, view the board, rename in Settings, check the lock screen at 390 px. Record the findings and fix them.
- [ ] **Step 5:** Commit `docs: M2 walkthrough, design and roadmap`.
