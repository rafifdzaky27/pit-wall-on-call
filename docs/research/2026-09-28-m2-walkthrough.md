# M2 persona walkthrough: posting a shift and the leaderboard

- **Date:** 2026-09-28
- **Build:** branch `feat/m2-runs-api`, production web build served by `vite preview`, with the API on a fresh `pitwall_e2e` database (Postgres 17 in Docker).
- **Method:** Claude ran a scripted Playwright walkthrough (not a usability test with people). Every persona plays **to the end of the run** and on through the postmortem, posting and the board. The incident clock is fast-forwarded with Playwright's clock. There is a screenshot per step, and console errors are logged.

## Personas

| Persona | Viewport | Path |
|---|---|---|
| Dina, first shift | 1366×657 | Plays → postmortem asks for a handle → posts → "New best: #1 of 1" → View leaderboard → Browser tab → back to the store tab |
| Arif, second shift | 1440×900 | Posts a first shift → New shift → a slower second shift posts by itself → "Posted. Your best is still #1 of 2." → the board |
| Oscar, offline | 1440×900 | `/api/runs` unreachable → "Posting your score…" through three retries → "Couldn't reach the leaderboard." → the network comes back → Try again → posted |
| Maya, phone | 390×844 | The lock screen with the practice leaderboard under its card |
| Rafif, account | 1440×900 | Posts → Settings → Account → renames to `rafif_dz` → "Saved." and "Shown as rafif_dz#…" |

## Findings

| # | Grade | What happened | Fix |
|---|---|---|---|
| W1 | Important | On a phone the board's table was wider than its frame, so the Result column sat behind a sideways scroll with nothing to show it was there (Maya). For phones this page is the landing page. | Below 560 px the Mitigated column is hidden, headers may wrap, and a long handle breaks before its tag. An e2e test at 390 px checks that the table fits its frame and that Result is visible. |
| W2 | Minor | The leaderboard tab showed `https://` in front of the address even where the page is served over `http` (local). | The address uses `location.origin`. |

## What worked

- **No console errors** on any path, apart from Oscar's deliberately blocked requests: one failure per attempt, four in all.
- **The board next to the score:** the Leaderboard panel sits under the score tiles, so the rank reads with the burn.
- **Tabs:** switching back to the store keeps its page (checkout stayed on checkout), and the leaderboard tab loads again each time it is opened.
- **Settings → Account** renames in place, and the next board load shows the new handle.

## Notes

- **A flaky e2e check found on the way:** `layout.spec.ts` waited for every finite animation to finish before measuring. The budget meter's `width` transition restarts on every burn tick, so under load the wait could time out (6 failures in 180 repeats). The wait now ignores CSS transitions; after that, 180 repeats passed.
- **Plausibility and scripted runs:** a rollback within 2 s of the page is held for review. The contract test and the walkthrough wait 3 s of game time before fixing, as a person would.
