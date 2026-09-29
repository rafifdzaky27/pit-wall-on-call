# M4: many incidents, design

- **Date:** 2026-09-29
- **Status:** decided by Claude under the autonomy rule. Rafif asked for "many scenarios, not just 3", researched from real DevOps/SRE failures, "so the daily is hard and not repetitive".
- **Research:** `docs/research/2026-09-29-m4-incident-catalogue.md` (37 candidates in 11 families, grounded in public postmortems).
- **Builds on:** the engine (1.1.0), the tools of M2.5 PR B, and the daily of M3.

## 1. Goal

A daily that stays hard for months. There are many incidents across the families real on-call engineers meet, and within each incident the cause changes with the seed, so memory teaches the pattern, not the answer.

## 2. Decisions

| # | Topic | Decision | Why |
|---|---|---|---|
| N1 | Variation | **A scenario is a family of variants.** A factory `defineIncident(kit, variants)` returns one `ScenarioDef` per variant, with id `<incident>:<variant>` (for example `disk-full:logs-volume`). A variant changes the nouns and numbers: which service, cert, queue or deploy is at fault, the magnitudes and timings, and which red herring is loud. | The engine, replay, API validation and golden tests keep working unchanged: a variant is just a scenario. No engine version bump. |
| N2 | The daily's pick | `dailyFor(date)` picks from every variant of every playable incident. Families are not repeated on consecutive days. Difficulty follows a weekly curve: 2 on Monday, rising to 4–5 on Friday and the weekend. | The research's rotation principles (§ design principles 6 and 9). |
| N3 | The shared kit | `packages/scenarios/src/kit/` holds the service catalogue as reusable pieces: edge, checkout-api, cart-api, search-api, postgres primary and replica, redis, a queue with workers, payments and shipping providers, auth. Each piece brings its service node, metrics, healthy log lines and standard actions. An incident adds only its fault. | Many scenarios without copy-paste, and a consistent world. |
| N4 | Fair but hard | Every incident has: an honest but incomplete first signal; two or three plausible causes, one of them a recent innocent deploy; one masking action that relieves the symptom for a while and then recurs; one harmful action; and a root-cause path of 6 actions or fewer through at least two tools other than Monitoring. A test checks each rule per variant. | The research's principles 1–5, plus Rafif's rule that Monitoring alone can't solve it. |
| N5 | Tools grow where incidents need them | Deploys lists config, feature-flag, migration and cron entries (a `kind` on deploy cards). The DB console gains replication lag and locks. The Incident app shows third-party status pages. | Several incidents depend on each. |
| N6 | Golden tests per variant | The generic harness runs, for every variant on 20 seeds: the perfect player resolves under par; doing nothing ends in a DNF; the masking path scores worse than the fix; the red herring path scores worse still. Per-scenario golden files hold only the action lists. | Scales to dozens of variants. |
| N7 | Batches | **PR A:** the kit, variants, the harness and rotation, with the Slow Leak recast as variants. **PR B:** the research's first batch of eight (B1 Disk Full at 3AM, C4 The Expired Cert, C1 The Payment Provider Blinks, A2 The Regex That Ate the CPU, F1 Cache Stampede After Restart, G1 Poison Pill, C2 Retry Storm, D1 Replica Lag Shows Old Carts), built in parallel by subagents in worktrees, each owning its incident's files. **PR C:** a second batch (security, observability, human error: I1, K1, K2, J1, J3, A3, B2, E1). | Big enough to feel like many; small enough to review. |
| N8 | Training stays apart | Training is never a daily and never a variant pool member. | Unchanged from M2.5. |

## 3. Out of scope

- The deferred hard ones from the research (A4 Flag Flip, D3 Vacuum, D5 Wrong Database, E3 Slow Network, H1 Leap Second): they need new tooling. They come in M4.5.
- A terminal (M6).

## 4. Review focus

1. A variant whose perfect path uses an action the tools don't render (the every-action test must cover every variant).
2. Two variants of one incident that are the same puzzle with different numbers only (variety must change what the player looks at).
3. The daily rotation on a date range: no family twice in a row, and the weekly difficulty curve holds.
4. An incident solvable from Monitoring alone.
5. Copy that names the fix in the symptom (a spoiler in an alert or log line).
