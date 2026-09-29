# M3: the daily incident, design

- **Date:** 2026-09-29
- **Status:** decided by Claude under the autonomy rule (Rafif: "if I don't respond, decide yourself").
- **Parent:** `2026-09-27-pit-wall-on-call-design.md` §7 (share card), §8 (API, validation steps 3 and 5), §9 (data model), D11 (first daily attempt ranks), D19 (everyone shares the daily's city).
- **Builds on:** M2, whose runs API and practice board are live, and M2.5, whose report, tools and training are live.

## 1. Goal

One incident a day, the same for everyone: the same scenario, seed, city, time of day and weather. Your first attempt counts on the daily board; later attempts are practice. The loop to build is to play today's, see your rank, share a spoiler-free result, and come back tomorrow.

## 2. Decisions

| # | Topic | Decision | Why |
|---|---|---|---|
| Y1 | What the daily is | `dailyFor(date)`: a pure function in `packages/scenarios` returning `{ date, number, scenarioId, seed }`. The scenario is picked from the non-training scenarios by the date, and the seed is a hash of the date. Both the API and the web import it. | One definition, no table. The web can still show today's daily if the API is down, and the server validates against the same function. |
| Y2 | The day | UTC. Daily #1 is 2026-09-29, and `number` counts days since then. | Parent §8: "rolls over at 00:00 UTC". |
| Y3 | Seeded variations | The seed already varies the city, time of day, weather, log noise and names (M1.5, M1.6). With one real scenario today, variety comes from the seed. M4's scenarios join the rotation automatically. | No new content needed to ship the habit loop. |
| Y4 | `GET /api/daily` | `{ date, number, scenarioId, seed, engineVersion }` for the server's UTC today. `Cache-Control: public, max-age=60`. | Parent §8. |
| Y5 | Posting a daily | The body has `mode: "daily"` and `dailyDate`. The server accepts only its UTC today or yesterday (a shift started before midnight and finished after), and the scenario and seed must equal `dailyFor(dailyDate)`, otherwise 400 `not_the_daily`. | Parent §8 step 3, with a grace day. |
| Y6 | Ranking | The first accepted daily post per player and date is stored as `daily_ranked`. The unique index `one_ranked_daily_per_player` enforces it: on conflict, the run is stored as `practice`, and the response says `mode: "practice"` with `ranked: false`. A repeated `runKey` returns the stored run, as in M2. | D11. The database decides, so two tabs cannot both rank. |
| Y7 | The daily board | `GET /api/leaderboard?date=YYYY-MM-DD`: the day's ranked, unflagged runs, ordered by resolved first, then budget burned, time to mitigate and time posted. It returns the top 50 plus your row. `?scenario=` keeps the practice board. | Parent §8, the M2 board shape. |
| Y8 | Where the daily starts | The desktop's shift notice leads with "Daily #N · <city>" and **Start daily**, then Practice shift, then Training (Training first until done, as in M2.5). Monitoring's calm view offers the same two buttons. Once today's daily is posted, the notice says "Daily #N done · rank #R", and Start daily becomes "Play again (practice)". | The habit loop starts from the landing, as in the parent spec's flow. |
| Y9 | A daily shift in the app | The incident hub gains `startDaily(daily)` and `daily: DailyInfo \| null`. Shifts get a `shiftId` that increments, so playing the same daily twice still starts fresh (a new shift was keyed by seed, and a daily repeats its seed). | A real bug otherwise. |
| Y10 | Queued submission | A daily post that fails on the network (after the M2 retries), or cannot be sent because the tab closes, is stored in `localStorage` as `pitwall.pending` (the body plus `runKey`). It is resent on the next load and when the browser comes back online. The same `runKey` makes the resend idempotent. Practice posts are queued too. | Roadmap M3. Losing a first attempt to a flaky network would lose the ranking. |
| Y11 | Leaderboard UI | The Browser leaderboard site gets two tabs, **Daily** (today, main) and **Practice**. The shift report shows the daily rank ("#12 of 340 today") for a daily, and the lock screen shows today's board. | Roadmap M3. |
| Y12 | Share | A daily shares "Pit Wall On-Call · Daily #N", then the budget and time to mitigate, the squares, and `<url>/daily`. A practice shift keeps today's text. | Parent §7. |
| Y13 | Rollover | While the desktop is idle or a shift has ended, a new UTC day brings a System notice: "Daily #N+1 is out". A shift in progress keeps its daily and posts it under its own date (Y5's grace day). | Nobody loses a run to midnight. |
| Y14 | `/daily` | The SPA serves `/daily` as `/`: the share link lands on the desktop with the daily notice. | Parent §7 URL. |

## 3. Out of scope

- Past dailies and an archive (after launch, D22).
- Streaks and notifications (M5 retention work, after data).
- Anti-cheat beyond M2's replay, plausibility flag and rate limits. Clearing storage gives another ranked attempt; the parent spec's risk table accepts this until accounts exist.

## 4. Review focus

1. **Midnight:** a shift started at 23:59 UTC and posted at 00:03 ranks on yesterday's board, and today's daily is still fresh.
2. **Two tabs:** two tabs post their first daily at once. Exactly one ranks; the other is stored as practice and says so.
3. **Offline:** a daily finished offline is posted on the next load. A reload while it is queued never posts it twice (same `runKey`).
4. **API down:** the web shows today's daily from `dailyFor` and plays it. The post queues.
5. **Same daily twice:** the second attempt starts a fresh session (Y9) and posts as practice.
