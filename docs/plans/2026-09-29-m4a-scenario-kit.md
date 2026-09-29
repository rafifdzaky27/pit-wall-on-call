# M4 PR A: the scenario kit, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make many incidents cheap to add, and make the daily rotate across them. An incident is a family of variants; the daily picks by family and difficulty; every variant is held to the same fairness rules by one generic test harness.

**Spec:** `docs/specs/2026-09-29-m4-many-incidents-design.md` (N1–N8).

## Global constraints

- **Engine:** unchanged (1.1.0). A variant is an ordinary `ScenarioDef`.
- **The base Slow Leak variant** keeps the id `db-pool-exhaustion` and its action ids, so stored runs, the smoke fixture and the practice board stay valid.
- **The daily for any date before `ROTATION_FROM` (2026-10-01)** is exactly M3's; Daily #1 and #2 are live.
- **No `Date` in `packages/scenarios`** (the lint rule).
- **Copy:** English, sentence case.

## Review focus

The spec's §4: every variant's actions are rendered; variants differ in what the player looks at; rotation rules; nothing is solvable from Monitoring alone; no spoilers in alerts or logs.

---

### Task 1: The incident model and registry

- **Create** `packages/scenarios/src/kit/incident.ts`:
  - `Family`: deploys, capacity, dependencies, data, network, caching, queues, time, abuse, human, observability;
  - `Golden`: the `perfect`, `masking` and `herring` action lists;
  - `IncidentVariant<S>`: `{ key, scenario, desktop, golden }`;
  - `Incident`: `{ id, title, family, difficulty: 1–5, variants }`;
  - `defineIncident()`, which checks that variant ids are `<id>` for the first variant and `<id>:<key>` for the rest.
- **Create** `packages/scenarios/src/registry.ts`:
  - `INCIDENTS`;
  - `SCENARIOS` (every variant, plus training);
  - `getScenario`;
  - `desktopFor(id)`, built from the variants.

  `index.ts` and `desktop.ts` re-export from it.
- **Tests:** the registry has unique ids; `desktopFor` covers every scenario; `getScenario` returns every variant.

### Task 2: Fairness harness (spec N4, N6)

- **Create** `packages/scenarios/src/fairness.test.ts`, which for every variant of every incident checks:
  - the perfect path resolves under par on seeds 1–20;
  - doing nothing ends in a DNF;
  - the masking path and the red herring path both resolve worse than perfect, or not at all;
  - at least one action has a mask note, and at least one is harmful;
  - the perfect path has 6 or fewer non-ack actions and uses at least two tools other than dashboards;
  - every root-cause action lives outside dashboards;
  - no alert title or description, and no log template, names a root-cause action's label (no spoilers).

  It replaces the Slow Leak-only parts of `golden.test.ts`; the Slow Leak's specific lessons stay there.

### Task 3: The Slow Leak as variants

- **Parametrise** `slow-leak.ts` and `slow-leak.desktop.ts` by a variant:
  - `{ key, svc, label, bad, good, change, deployer }`, where `bad` and `good` are versions and `change` is the commit message;
  - **`checkout`:** the base, M1's content exactly;
  - **`cart`:** cart-api v88 leaks after "move cart persistence to the new ORM". The customer symptom is "Add to cart" failing, and the red herring is search being slow.
- **Tests:** the base variant's golden values are unchanged (`golden.test.ts` passes untouched). The cart variant passes the fairness harness.

### Task 4: Daily rotation (spec N2)

- **`dailyFor(date, catalogue = INCIDENTS)`:**
  - for a date before `ROTATION_FROM`, the M3 result;
  - from `ROTATION_FROM` on, iterate day by day, memoised: the target difficulty follows the weekday (Mon 2, Tue 2, Wed 3, Thu 3, Fri 4, Sat 4, Sun 5);
  - the candidates are variants whose incident family differs from the previous day's (all of them when that leaves none);
  - pick the smallest |difficulty − target|, then a variant by hash;
  - the seed stays the hash of the date.
- **Tests (failing first), with a fake catalogue:** no family twice in a row over 120 days; the difficulty follows the curve when the catalogue allows; dates before `ROTATION_FROM` are unchanged; determinism.

### Task 5: Web and API follow the registry

- The web and the API already use `getScenario` and `desktopFor`. Check that the Browser symptom, Chat, the tools and the café hotspots work for a non-base variant: an App-level test that plays the cart variant by `startDaily` with a daily of that id.
- **Docs:** README ("incidents and variants"), DESIGN.md (none), and the roadmap's M4 row.

### Task 6: Review and ship

Fresh reviewer, the fix pass, the PR, CI, merge, and watching the deploy.
