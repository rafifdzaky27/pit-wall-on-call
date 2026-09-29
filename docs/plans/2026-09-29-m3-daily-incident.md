# M3: the daily incident, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One ranked incident a day for everyone, from the landing to the daily board and a share.

**Architecture:**
- A pure `dailyFor(date)` in `packages/scenarios`, shared by the API and the web.
- **API:** `GET /api/daily`, daily posts ranked by the existing unique index, and a date board.
- **Web:** a shift id and `startDaily` in the incident hub, a daily hook with a local fallback, a persistent post queue, the Daily and Practice board tabs, and the daily share text.

**Tech stack:** as M2 (Hono, Drizzle, Postgres 17, React 19, Vitest, Playwright).

**Spec:** `docs/specs/2026-09-29-m3-daily-incident-design.md` (Y1–Y14).

## Global constraints

- **Engine:** unchanged (1.1.0), so golden scores are unchanged.
- **Schema:** no migration needed. `mode` already allows `daily_ranked`, `daily_date` exists, and so do the unique and leaderboard indexes.
- **Budgets:** the main chunk grows by at most 3 KB gzip.
- **`localStorage`:** always wrapped in try/catch.
- **Copy:** English, sentence case, no emoji in chrome. The share squares are in-world content, as in M2.5.
- **Commits:** conventional, with no AI attribution.

## Review focus

The spec's §4, in full: midnight, two tabs, offline, API down, same daily twice.

---

### Task 1: `dailyFor` (packages/scenarios)

- **Create** `packages/scenarios/src/daily.ts`:
  - `DAILY_EPOCH = "2026-09-29"`;
  - `utcDate(ms: number): string` (YYYY-MM-DD);
  - `dailyNumber(date)`;
  - `dailyFor(date): Daily`, where `Daily = { date, number, scenarioId, seed }`. The seed comes from FNV-1a of `pitwall:daily:<date>`, as a uint32. The scenario is `PLAYABLE[hash % PLAYABLE.length]`, where `PLAYABLE` is the non-training scenarios;
  - `isDailyDate(s)`, a format check.
- **Tests (failing first):**
  - epoch = #1;
  - determinism;
  - different dates give different seeds;
  - never picks training;
  - `utcDate` at 23:59:59.999 and at 00:00 UTC;
  - `dailyNumber` across a month boundary.

### Task 2: API

- **`GET /api/daily`** (`apps/api/src/daily/routes.ts`): today by the injected clock `ctx.now()` (add `now` to `RouteContext`; tests pass a fixed clock). Returns `{ ...dailyFor(today), engineVersion }` with `Cache-Control: public, max-age=60`.
- **Run schema:** `mode: "practice" | "daily"`, and `dailyDate` required when the mode is daily.
- **Route:**
  - if daily, check the date is today or yesterday by `ctx.now()`, and that the scenario and seed equal `dailyFor(date)`; otherwise 400 `not_the_daily`;
  - insert with `mode: "daily_ranked"` and `dailyDate`. On a conflict of `one_ranked_daily_per_player`, insert as `practice` (with `dailyDate` kept for the record);
  - the response gains `ranked: boolean`, and `board` is the daily position for a ranked daily.
- **Leaderboard:**
  - `?date=` gives `dailyBoard(db, date, { playerId })`: the top 50 plus you, in the same shape as the practice board, plus `number`;
  - `boardPosition` for daily: rank among the ranked, unflagged runs of that date.
- **Tests on real Postgres (failing first):**
  - `/api/daily` today;
  - a daily post ranks;
  - a second daily is practice with `ranked: false`;
  - two concurrent first posts: exactly one ranks;
  - wrong seed → 400;
  - yesterday accepted, two days ago → 400;
  - the date board order and your row;
  - a flagged run is not on the board.

### Task 3: Web hub and daily data

- **`IncidentProvider`:**
  - a `shiftId` counter, used as the key for Session and ShiftScope and by SubmissionProvider;
  - `startDaily(daily)`: the scenario from `getScenario`, the seed from the daily, starting at once;
  - `daily` on the API.
- **`net/daily.ts`, `useDaily()`:**
  - fetches `/api/daily`; falls back to `dailyFor(utcDate(Date.now()))` on error;
  - rechecks each minute for rollover while idle or ended;
  - also exposes `playedToday` from `localStorage` (`pitwall.daily.<date>` = `{ runKey, rank?, total? }`).
- **Tests:**
  - two dailies in a row remount the session;
  - the fallback when fetch rejects;
  - the rollover notice.

### Task 4: Queued submission

- **`net/queue.ts`:** `enqueue(body)`, `pending()`, `drop(runKey)`, all in try/catch.
- **SubmissionProvider:**
  - build the body (`mode` and `dailyDate` from `incident.daily`); enqueue before posting; drop on success or on a 4xx that is final;
  - on mount and on `online`, resend each pending body (the same `runKey`);
  - record `pitwall.daily.<date>` when a daily posts.
- **Tests:**
  - offline → queued → the next mount posts once;
  - a double mount does not post twice at the same time;
  - 409 or 422 drop the entry.

### Task 5: Daily UI

- **Notice feed:** "Daily #N · <city>", with Start daily, Practice shift and Training (Training first until done). After today's daily: "Daily #N done · rank #R of T" and "Play again (practice)".
- **Monitoring calm view:** Start daily as the primary action, Practice shift as the secondary one.
- **ResultsCard:**
  - a daily shows "Daily #N" in the title;
  - "Ranked #R of T today", or "Practice: your ranked attempt today was earlier";
  - share per Y12.
- **Browser leaderboard:** Daily and Practice tabs; Daily is the default, with today's date and number.
- **Lock screen:** today's board.
- **Serve `/daily`:** the Vite preview and production serve the SPA for `/daily`. Check nginx or the Dockerfile config for the SPA fallback.
- **Tests:** per component, failing first.

### Task 6: e2e, docs and review

- **e2e `daily.spec.ts`:**
  - the landing shows Daily #N; play and resolve it; the report says ranked; the board has you;
  - play again → the report says practice.
- **Docs:** README, DESIGN.md (daily UI), roadmap row, parent spec changelog.
- **Walkthrough:** personas (a first visit, a regular's second attempt, a share link to `/daily`); record findings in `docs/research/2026-09-29-m3-walkthrough.md`.
- **Verify:** everything three times.
- **Review:** fresh reviewer, the fix pass, the PR, merge after green CI, then watch the deploy.
