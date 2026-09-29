# M3 persona walkthrough: the daily incident

- **Date:** 2026-09-29
- **Build:** branch `feat/m3-daily`, production web build with the e2e API (Postgres in Docker).
- **Method:** Claude ran a scripted Playwright walkthrough (not a usability test with people), on the fake clock with reduced motion. There is a screenshot per step, and console errors are logged.

## Personas

| Persona | Viewport | Path |
|---|---|---|
| A first visit from a share link | 1440×900 | `/daily` → the landing notice "Daily #1 · Yogyakarta" → Start daily → ack (stays on the desktop) → Open Monitoring → Open in Deploys → roll back → report → pick a handle → Full leaderboard → New shift |
| A regular, second attempt | 1440×900 | Landing says "Daily #1 done · #1 of 1" → Daily again (practice) → the report says the attempt counted as practice (e2e `daily.spec.ts`) |

## Findings

| # | Grade | What happened | Fix |
|---|---|---|---|
| W1 | Minor | After today's daily, the notice had two primary buttons (Practice shift and Training, both blue), and the labels wrapped inside the buttons ("Practice / shift"). | Only one primary action on that notice (`dailyNotice.test.tsx`). Notice buttons keep their labels on one line and wrap to a new row instead. |

## What worked

- **No console errors.**
- **The share link:** `/daily` lands on the desktop, and the notice leads with today's daily in the daily's own city.
- **After the ack,** the desktop stays as it was, with the "You're on it" notice.
- **The report** reads "Daily #1 · Shift report" and "Ranked #1 of 1 on today's daily board.", with today's board under it.
- **After New shift,** the landing remembers today's result and offers practice.
