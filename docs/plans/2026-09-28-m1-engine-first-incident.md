# M1: Engine + First Incident Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scenario 1 ("The Slow Leak") is playable locally: a minimal cold open with the page and the ack, the incident console, and a debrief. Everything runs on a deterministic, replayable engine.

**Architecture:** `packages/engine` is a pure TypeScript simulation (seeded PRNG, fixed 100 ms ticks, integer scoring, a paging phase) exposing a `Run` class for live play and `replay()` for the server in M2. `packages/scenarios` holds content as `defineScenario()` configs with golden-player tests. `apps/web` drives a `Run` in real time: landing → cold open (pre-page, page, ack) → console → debrief, styled from `docs/DESIGN.md` (variant 1).

**Tech Stack:** TypeScript ~6.0, pnpm 10.12.2 workspaces, Vitest 5, React 19, Vite 8, Testing Library, @fontsource IBM Plex Sans/Mono.

**Spec:** `docs/specs/2026-09-27-pit-wall-on-call-design.md` (sections 5–7) and `docs/specs/2026-09-28-cold-open-design.md` (sections 3–5, 10).

## Global Constraints

- No `Math.random`, `Date`, `performance` or `crypto` in `packages/engine` or `packages/scenarios` (spec §5, rule 1–2). Enforced by ESLint.
- Scenario state values are integers. The engine throws if dynamics or an effect produce a non-integer (spec §5, rule 3).
- 1 tick = 100 ms game time; 10 ticks per second; `ENGINE_VERSION = "1.0.0"`.
- `ack` is the first scoring action. Console actions before it are rejected (`not_acknowledged`). `inspect:<hotspotId>` is allowed at any tick, including tick 0 before the ack (cold-open §4).
- Escalation fires at tick 600 if there is no ack. Burn before the ack is tagged `unacknowledged` (cold-open §3–4).
- Headline score is `budgetBurnedBp`; lower is better. A DNF is a run not resolved at the time limit (spec §5).
- Visual direction D14: IBM Plex, Grafana-like slate, blue accent, dark default plus light theme. **No motorsport theming, no emoji, no decorative icons.** Status is shown as text tags (Crit, Warn, Healthy…), never color alone.
- Console needs ≥1024 px. Landing and debrief work at 375 px with no horizontal scroll (spec §7, D13).
- Copy is English, sentence case, no placeholder text.
- Commits: conventional messages, **no AI attribution trailers**.

## Decisions made in this plan

These resolve gaps or conflicts in the specs. Task 11 writes them back into the specs.

| # | Topic | Decision | Why |
|---|---|---|---|
| P1 | `undetected` burn tag | Not produced in v1. The page fires at tick 0, so there is no "before the first alert" window. | The cold open made the page the start of the clock. |
| P2 | "Declare resolved" global action | Dropped. A run resolves automatically once `resolvedWhen` holds for 10 consecutive seconds; `mitigatedAtTick` is the first tick of that stretch. | A button that can only be pressed at the right moment adds nothing but a trap. |
| P3 | Node clicks as actions | Selecting a node is UI only and is not recorded. Investigation is explicit per-service actions with durations. | Recording every click bloats logs and replay; explicit investigate actions carry the same "costs clock time" meaning. |
| P4 | Action tick order | Non-decreasing, not strictly increasing: pre-page inspects and the ack can share tick 0 (cold-open §4). | The newer spec requires it. M2 validation uses non-decreasing. |
| P5 | Clue count rule | 1–3 clues and 1–2 herrings. The approved scenario 1 content has 3 clues. | The approved example contradicted the 1–2 rule. |
| P6 | One action at a time | The player has one pair of hands: a timed action blocks other timed actions until it finishes. `ack` and `inspect` take no time and are never blocked. | Makes clock cost real and keeps the UI legible. |
| P7 | Action categories | Shown as text group labels (Investigate, Mitigate, Fix, Communicate); the spec's category emoji are dropped. | D14: no decorative icons. |
| P8 | RNG streams | Separate seeded streams for dynamics, metric noise and logs. | Adding a log line or metric never changes a score. |
| P9 | Pre-page length | 18 s in the UI, not in the engine. The engine clock starts at the page. | Cold-open §3: pre-page is free. |
| P10 | Brand name | Picked in the web app from the seed (3 brands) until M1.5 moves it into `resolveScene`. | M1 has no scenes package. |

## Review Focus

1. **Prototype keys as hotspot ids** (`inspect:constructor`, `inspect:__proto__`): must be rejected as `unknown_action`, never counted as a clue. Test in Task 2.
2. **Replay of a live log gives the identical result**, including pre-page inspects at tick 0 and actions dispatched on the same tick. Test in Task 3.
3. **Tab hidden mid-incident**: the clock pauses, the console is hidden, and no ticks are lost or gained on resume. Test in Task 6.
4. **Actions at or past the end** (after resolve or DNF): rejected, and `step()` after the end throws rather than silently continuing. Tests in Tasks 2–3.
5. **Every seed is winnable**: the perfect player resolves under par for seeds 1–50, so a daily seed can never produce an unwinnable incident. Test in Task 4.

---

## File structure

```
packages/engine/                  pure simulation, no DOM, no I/O
  package.json, tsconfig.json
  src/constants.ts                tick rate, reserved action ids, engine version
  src/rng.ts                      mulberry32 + named stream seeds
  src/types.ts                    scenario, snapshot, result types
  src/define.ts                   defineScenario()
  src/validate.ts                 validateScenario() + ScenarioError
  src/run.ts                      Run class: tick loop, paging, burn, resolution
  src/replay.ts                   replay(scenario, seed, actions)
  src/lessons.ts                  pickLesson()
  src/index.ts                    public API
  src/testing/fixture.ts          tiny scenario used by engine tests only
  src/*.test.ts
packages/scenarios/
  package.json, tsconfig.json
  src/slow-leak.ts                scenario 1 content
  src/index.ts                    registry
  src/golden.test.ts              perfect / do-nothing / red-herring players
  src/content.test.ts             cold-open content rules
apps/web/src/
  styles/tokens.css, base.css, console.css, screens.css
  theme.ts, ThemeToggle.tsx, useMediaQuery.ts
  game/format.ts, clock.ts, history.ts, useRunLoop.ts, brand.ts
  screens/Landing.tsx, Incident.tsx, ColdOpen.tsx, Debrief.tsx, ErrorBoundary.tsx
  console/Console.tsx, TopBar.tsx, AlertFeed.tsx, SceneNotes.tsx, ServiceMap.tsx,
          MetricPanel.tsx, ActionsPanel.tsx, LogStream.tsx
  App.tsx, main.tsx
docs/DESIGN.md
```

---

### Task 1: Engine package, seeded RNG, determinism lint rule

**Files:**
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/constants.ts`, `packages/engine/src/rng.ts`, `packages/engine/src/rng.test.ts`
- Modify: `eslint.config.js`, `.gitignore`

**Interfaces:**
- Produces: `mulberry32(seed: number): Rng`, `streamSeed(seed: number, stream: string): number`, `interface Rng { next(): number; int(maxExclusive: number): number }`, constants `ENGINE_VERSION`, `TICKS_PER_SECOND`, `TICK_MS`, `ESCALATION_TICK`, `STABLE_TICKS_TO_RESOLVE`, `LOG_CAP`, `ACK`, `INSPECT_PREFIX`, `inspectAction(id)`.

- [ ] **Step 1: Scaffold the package**

`packages/engine/package.json`:
```json
{
  "name": "@pitwall/engine",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "^5.0.2"
  }
}
```

`packages/engine/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2022"], "types": [] },
  "include": ["src"]
}
```

`packages/engine/src/constants.ts`:
```ts
export const ENGINE_VERSION = "1.0.0";
export const TICK_MS = 100;
export const TICKS_PER_SECOND = 10;
/** 60 s without an ack pages the secondary (cold-open spec §3). */
export const ESCALATION_TICK = 60 * TICKS_PER_SECOND;
/** A run resolves after its resolve condition holds for 10 s straight. */
export const STABLE_TICKS_TO_RESOLVE = 10 * TICKS_PER_SECOND;
export const LOG_CAP = 2000;
export const ACK = "ack";
export const INSPECT_PREFIX = "inspect:";
export const inspectAction = (hotspotId: string): string => `${INSPECT_PREFIX}${hotspotId}`;
```

Append `.superpowers/` to `.gitignore`. Run `pnpm install` so the workspace links the package.

- [ ] **Step 2: Write the failing RNG tests**

`packages/engine/src/rng.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { mulberry32, streamSeed } from "./rng";

const take = (seed: number, n: number) => {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe("mulberry32", () => {
  it("repeats the same sequence for the same seed", () => {
    expect(take(42, 20)).toEqual(take(42, 20));
  });

  it("gives different sequences for different seeds", () => {
    expect(take(1, 5)).not.toEqual(take(2, 5));
  });

  it("keeps next() in [0, 1)", () => {
    for (const v of take(7, 5000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("keeps int(n) in [0, n) and hits every value", () => {
    const rng = mulberry32(9);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(6);
      expect(Number.isInteger(v) && v >= 0 && v < 6).toBe(true);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it("rejects a non-positive or fractional bound", () => {
    const rng = mulberry32(1);
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(2.5)).toThrow(RangeError);
  });

  it("is pinned: changing the algorithm changes every stored score", () => {
    expect(take(1, 3)).toMatchInlineSnapshot();
  });
});

describe("streamSeed", () => {
  it("is stable per (seed, stream) and differs across streams and seeds", () => {
    expect(streamSeed(5, "dynamics")).toBe(streamSeed(5, "dynamics"));
    expect(streamSeed(5, "dynamics")).not.toBe(streamSeed(5, "logs"));
    expect(streamSeed(5, "dynamics")).not.toBe(streamSeed(6, "dynamics"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const v = streamSeed(123456789, "metrics");
    expect(Number.isInteger(v) && v >= 0 && v <= 0xffffffff).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @pitwall/engine test`
Expected: FAIL, `Failed to resolve import "./rng"`.

- [ ] **Step 4: Implement `rng.ts`**

```ts
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/** mulberry32: small, fast, and identical in every JS engine (32-bit integer math only). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const nextU32 = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    next: () => nextU32() / 4294967296,
    int: (maxExclusive) => {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(`int() needs a positive integer bound, got ${maxExclusive}`);
      }
      return nextU32() % maxExclusive;
    },
  };
}

/**
 * Seed for a named stream (FNV-1a over the seed bytes and the name). Separate streams mean
 * adding a log line or a metric never shifts the dynamics, so it never changes a score.
 */
export function streamSeed(seed: number, stream: string): number {
  let h = 0x811c9dc5;
  const s = seed >>> 0;
  for (let shift = 0; shift < 32; shift += 8) {
    h ^= (s >>> shift) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  for (let i = 0; i < stream.length; i++) {
    h ^= stream.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @pitwall/engine test`
Expected: PASS (8 tests). Vitest writes the inline snapshot on this first run; check that the file now contains three numbers in the snapshot.

- [ ] **Step 6: Add the determinism lint rule**

In `eslint.config.js`, add a block after `...tseslint.configs.recommended,`:
```js
  {
    files: ["packages/engine/src/**/*.ts", "packages/scenarios/src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded Rng: the engine must be deterministic (spec §5)." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "No wall-clock time in the engine (spec §5)." },
        { name: "performance", message: "No wall-clock time in the engine (spec §5)." },
        { name: "crypto", message: "Use the seeded Rng: the engine must be deterministic (spec §5)." },
      ],
    },
  },
```

Verify it bites: write `export const x = Math.random() + Date.now();` to `packages/engine/src/lint-probe.ts`, run `pnpm lint`.
Expected: 2 errors naming `Math.random` and `Date`. Delete the probe file, run `pnpm lint` again. Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add .gitignore eslint.config.js packages/engine pnpm-lock.yaml
git commit -m "feat(engine): seeded PRNG with named streams and a determinism lint rule"
```

---

### Task 2: Engine core: scenario types, validation and the `Run` tick loop

**Files:**
- Create: `packages/engine/src/types.ts`, `define.ts`, `validate.ts`, `run.ts`, `index.ts`, `testing/fixture.ts`, `validate.test.ts`, `run.test.ts`

**Interfaces:**
- Consumes: Task 1 `mulberry32`, `streamSeed`, constants.
- Produces:
  - `defineScenario<S extends State>(def: ScenarioDef<S>): ScenarioDef<S>`
  - `validateScenario(sc): void` throwing `ScenarioError`
  - `class Run<S extends State>`: `constructor(scenario, seed)`, `tick: number`, `outcome: Outcome`, `actions: ActionRecord[]`, `timeline: TimelineEntry[]`, `logs: LogEntry[]`, `check(actionId): RejectReason | null`, `dispatch(actionId): void` (throws `ActionRejected`), `step(): void`, `snapshot(): Snapshot`, `result(): RunResult`
  - `class ActionRejected extends Error { actionId; tick; reason: RejectReason }`
  - `type RejectReason = "finished" | "unknown_action" | "not_acknowledged" | "already_acknowledged" | "busy" | "unavailable" | "out_of_order"`
  - types `State, Health, ActionCategory, Verdict, LogLevel, Outcome, ScenarioDef, ServiceDef, EdgeDef, MetricDef, LogTemplate, AlertRule, ActionDef, HotspotDef, ColdOpenDef, LessonDef, ActionRecord, TimelineEntry, LogEntry, AlertState, BusyState, Snapshot, RunResult`

**Tick order** (documented in `run.ts`): dynamics → complete the running action if it ends this tick → metrics → alerts → logs → escalation → burn → resolution → time limit.

- [ ] **Step 1: Write the types (no behavior, so no test of its own)**

`packages/engine/src/types.ts`:
```ts
import type { Rng } from "./rng";

/** Scenario state. Every value must be an integer, because the score depends on it (spec §5, rule 3). */
export type State = Record<string, number>;
export type Health = "ok" | "warn" | "crit";
export type ActionCategory = "investigate" | "mitigate" | "fix" | "communicate";
export type Verdict = "useful" | "wasted" | "harmful";
export type LogLevel = "INFO" | "WARN" | "ERROR";
export type Outcome = "running" | "resolved" | "dnf";

// Function members use method syntax on purpose: it lets a ScenarioDef<SlowLeak> be stored
// as a ScenarioDef<State> in the registry.

export interface ServiceDef<S extends State> {
  id: string;
  label: string;
  /** Position on the service map, 0–100 on both axes. */
  x: number;
  y: number;
  detail(s: S): string;
}

export interface EdgeDef {
  from: string;
  to: string;
}

export interface MetricDef<S extends State> {
  id: string;
  serviceId: string;
  label: string;
  unit: string;
  max: number;
  warn?: number;
  crit?: number;
  /** Presentation only. `noise` is its own stream, so metrics never change a score. */
  value(s: S, noise: Rng): number;
}

export interface LogTemplate<S extends State> {
  id: string;
  serviceId: string;
  level: LogLevel;
  everyTicks: number;
  when?(s: S): boolean;
  text(s: S, rng: Rng): string;
}

export interface AlertRule<S extends State> {
  id: string;
  serviceId: string;
  severity: "warn" | "crit";
  title: string;
  description: string;
  when(s: S): boolean;
}

export interface ActionDef<S extends State> {
  id: string;
  label: string;
  /** null = a global action, always visible. */
  serviceId: string | null;
  category: ActionCategory;
  /** Whole seconds. */
  durationS: number;
  verdict: Verdict;
  /** Applied when the action completes. */
  effect?(s: S): S;
  /** Extra error rate while the action runs, burned as side_effect:<id>. */
  sideEffectBp?: number;
  /** Finding lines added to the log when the action completes. */
  reveals?(s: S): string[];
  available?(s: S): boolean;
}

export interface HotspotDef {
  kind: "clue" | "herring";
  label: string;
  text: string;
  appearsAt?: "incident_start";
}

export interface ColdOpenDef {
  scene: string;
  symptom: { kind: string; surface: string };
  page: { severity: string; title: string; body: string };
  hotspots: Record<string, HotspotDef>;
}

export interface LessonDef {
  id: string;
  when(r: RunResult): boolean;
  text: string;
}

export interface ScenarioDef<S extends State> {
  id: string;
  title: string;
  summary: string;
  difficulty: "easy" | "normal" | "hard";
  timeLimitS: number;
  /** The golden perfect player must burn at most this many basis points. */
  parBp: number;
  slo: { availability: number; budgetRequests: number };
  trafficPerTick: number;
  services: ServiceDef<S>[];
  edges: EdgeDef[];
  setup(rng: Rng): S;
  dynamics(s: S, rng: Rng, tick: number): S;
  /** Integer basis points of requests failing, 0–10000. */
  errorRateBp(s: S): number;
  health(s: S): Record<string, Health>;
  /** Symptoms are reduced while the root cause is still active. */
  mitigated(s: S): boolean;
  resolvedWhen(s: S): boolean;
  metrics: MetricDef<S>[];
  logs: LogTemplate<S>[];
  alerts: AlertRule<S>[];
  actions: ActionDef<S>[];
  rootCauseActionIds: string[];
  coldOpen: ColdOpenDef;
  /** First match wins; the last lesson must match everything. */
  lessons: LessonDef[];
}

export interface ActionRecord {
  tick: number;
  actionId: string;
}

export type TimelineEntry =
  | { tick: number; kind: "page" | "ack" | "escalated" | "resolved" | "dnf" }
  | { tick: number; kind: "action_start" | "action_done"; actionId: string }
  | { tick: number; kind: "inspect"; hotspotId: string }
  | { tick: number; kind: "alert_fired" | "alert_cleared"; alertId: string };

export interface LogEntry {
  seq: number;
  tick: number;
  /** A service id, or "global" for findings from global actions. */
  serviceId: string;
  level: LogLevel;
  text: string;
  finding: boolean;
}

export interface AlertState {
  alertId: string;
  firedAtTick: number;
  clearedAtTick: number | null;
}

export interface BusyState {
  actionId: string;
  startTick: number;
  /** First tick at which the player is free again. */
  endTick: number;
}

export interface Snapshot {
  tick: number;
  outcome: Outcome;
  acked: boolean;
  ackTick: number | null;
  escalated: boolean;
  busy: BusyState | null;
  metrics: Record<string, number>;
  health: Record<string, Health>;
  details: Record<string, string>;
  alerts: AlertState[];
  budgetBurnedBp: number;
  inspected: string[];
  cluesFound: string[];
}

export interface RunResult {
  scenarioId: string;
  seed: number;
  engineVersion: string;
  outcome: "resolved" | "dnf";
  endTick: number;
  mitigatedAtTick: number | null;
  budgetBurnedBp: number;
  burnByTag: Record<string, number>;
  ackTick: number | null;
  escalated: boolean;
  cluesFound: string[];
  rootCauseFound: boolean;
  actions: ActionRecord[];
  timeline: TimelineEntry[];
}
```

`packages/engine/src/define.ts`:
```ts
import type { ScenarioDef, State } from "./types";

/** Identity helper: gives scenario authors type checking and inference for their state. */
export function defineScenario<S extends State>(def: ScenarioDef<S>): ScenarioDef<S> {
  return def;
}
```

- [ ] **Step 2: Write the test fixture scenario**

`packages/engine/src/testing/fixture.ts`:
```ts
import { defineScenario } from "../define";

type Fx = { level: number; fixed: number; patched: number };

/**
 * A tiny scenario with round numbers: 1 request per tick, a 1000-request budget and a
 * 10% error rate until fixed, so one unfixed tick burns exactly 1 bp.
 */
export const fixture = defineScenario<Fx>({
  id: "fixture",
  title: "Fixture",
  summary: "Engine test scenario",
  difficulty: "easy",
  timeLimitS: 90,
  parBp: 0,
  slo: { availability: 99.9, budgetRequests: 1000 },
  trafficPerTick: 1,
  services: [{ id: "svc", label: "svc", x: 50, y: 50, detail: (s) => `level ${s.level}` }],
  edges: [],
  setup: () => ({ level: 0, fixed: 0, patched: 0 }),
  dynamics: (s) => ({ ...s, level: s.level + 1 }),
  errorRateBp: (s) => (s.fixed ? 0 : 1000),
  health: (s) => ({ svc: s.fixed ? "ok" : "crit" }),
  mitigated: (s) => s.patched === 1 && s.fixed === 0,
  resolvedWhen: (s) => s.fixed === 1,
  metrics: [
    { id: "svc.level", serviceId: "svc", label: "Level", unit: "", max: 1000, value: (s, noise) => s.level + noise.next() },
  ],
  logs: [{ id: "svc.tick", serviceId: "svc", level: "INFO", everyTicks: 10, text: (s) => `level ${s.level}` }],
  alerts: [
    { id: "svc.down", serviceId: "svc", severity: "crit", title: "SvcDown", description: "svc failing", when: (s) => s.fixed === 0 },
  ],
  actions: [
    { id: "svc.poke", label: "Poke", serviceId: "svc", category: "investigate", durationS: 2, verdict: "useful", reveals: (s) => [`poked at level ${s.level}`] },
    { id: "svc.fix", label: "Fix", serviceId: "svc", category: "fix", durationS: 1, verdict: "useful", effect: (s) => ({ ...s, fixed: 1 }), available: (s) => s.fixed === 0 },
    { id: "svc.break", label: "Break", serviceId: "svc", category: "mitigate", durationS: 1, verdict: "harmful", sideEffectBp: 5000 },
    { id: "svc.patch", label: "Patch", serviceId: "svc", category: "mitigate", durationS: 1, verdict: "wasted", effect: (s) => ({ ...s, patched: 1 }) },
    { id: "status", label: "Post status", serviceId: null, category: "communicate", durationS: 1, verdict: "useful", reveals: () => ["status posted"] },
  ],
  rootCauseActionIds: ["svc.fix"],
  coldOpen: {
    scene: "cafe",
    symptom: { kind: "http_502", surface: "checkout" },
    page: { severity: "SEV2", title: "Svc down", body: "svc is failing" },
    hotspots: {
      "a.clue": { kind: "clue", label: "A", text: "clue text" },
      "b.herring": { kind: "herring", label: "B", text: "herring text" },
      "c.late": { kind: "clue", label: "C", text: "late clue", appearsAt: "incident_start" },
    },
  },
  lessons: [
    { id: "dnf", when: (r) => r.outcome === "dnf", text: "dnf lesson" },
    { id: "default", when: () => true, text: "default lesson" },
  ],
});

/** Step until the run ends; returns the number of steps taken. */
export function runToEnd(run: { outcome: string; step(): void }): number {
  let steps = 0;
  while (run.outcome === "running") {
    run.step();
    steps++;
  }
  return steps;
}
```

- [ ] **Step 3: Write the failing validation tests**

`packages/engine/src/validate.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { fixture } from "./testing/fixture";
import { ScenarioError, validateScenario } from "./validate";

describe("validateScenario", () => {
  it("accepts a well-formed scenario", () => {
    expect(() => validateScenario(fixture)).not.toThrow();
  });

  it("rejects duplicate action ids", () => {
    const bad = { ...fixture, actions: [...fixture.actions, fixture.actions[0]!] };
    expect(() => validateScenario(bad)).toThrow(/duplicate action svc.poke/);
  });

  it("rejects reserved action ids", () => {
    const ack = { ...fixture.actions[0]!, id: "ack" };
    const inspect = { ...fixture.actions[0]!, id: "inspect:x" };
    expect(() => validateScenario({ ...fixture, actions: [ack] })).toThrow(ScenarioError);
    expect(() => validateScenario({ ...fixture, actions: [inspect] })).toThrow(/reserved/);
  });

  it("rejects references to unknown services", () => {
    const stray = { ...fixture.actions[0]!, id: "x.y", serviceId: "nope" };
    expect(() => validateScenario({ ...fixture, actions: [...fixture.actions, stray] })).toThrow(/unknown service nope/);
  });

  it("rejects fractional action durations", () => {
    const slow = { ...fixture.actions[0]!, id: "x.slow", durationS: 1.5 };
    expect(() => validateScenario({ ...fixture, actions: [...fixture.actions, slow] })).toThrow(/durationS/);
  });

  it("rejects a root cause action that does not exist", () => {
    expect(() => validateScenario({ ...fixture, rootCauseActionIds: ["svc.nope"] })).toThrow(/rootCauseActionIds/);
  });

  it("requires at least one lesson", () => {
    expect(() => validateScenario({ ...fixture, lessons: [] })).toThrow(/lesson/);
  });
});
```

Run: `pnpm --filter @pitwall/engine test`
Expected: FAIL, `Failed to resolve import "./validate"`.

- [ ] **Step 4: Implement `validate.ts`**

```ts
import { ACK, INSPECT_PREFIX } from "./constants";
import type { ScenarioDef, State } from "./types";

export class ScenarioError extends Error {
  name = "ScenarioError";
}

/** Catches authoring mistakes before a scenario can produce a confusing run. */
export function validateScenario<S extends State>(sc: ScenarioDef<S>): void {
  const problems: string[] = [];
  const services = new Set<string>();
  for (const svc of sc.services) {
    if (services.has(svc.id)) problems.push(`duplicate service ${svc.id}`);
    services.add(svc.id);
  }
  const needService = (where: string, id: string | null) => {
    if (id !== null && !services.has(id)) problems.push(`${where} references unknown service ${id}`);
  };
  for (const e of sc.edges) {
    needService("edge", e.from);
    needService("edge", e.to);
  }
  for (const m of sc.metrics) needService(`metric ${m.id}`, m.serviceId);
  for (const a of sc.alerts) needService(`alert ${a.id}`, a.serviceId);
  for (const l of sc.logs) {
    needService(`log ${l.id}`, l.serviceId);
    if (!Number.isInteger(l.everyTicks) || l.everyTicks < 1) problems.push(`log ${l.id} everyTicks must be a positive integer`);
  }
  const actions = new Set<string>();
  for (const a of sc.actions) {
    if (actions.has(a.id)) problems.push(`duplicate action ${a.id}`);
    if (a.id === ACK || a.id.startsWith(INSPECT_PREFIX)) problems.push(`action id ${a.id} is reserved`);
    actions.add(a.id);
    needService(`action ${a.id}`, a.serviceId);
    if (!Number.isInteger(a.durationS) || a.durationS <= 0) problems.push(`action ${a.id} durationS must be a positive whole number`);
  }
  for (const id of sc.rootCauseActionIds) {
    if (!actions.has(id)) problems.push(`rootCauseActionIds has unknown action ${id}`);
  }
  if (sc.lessons.length === 0) problems.push("scenario needs at least one lesson");
  if (problems.length > 0) throw new ScenarioError(`${sc.id}: ${problems.join("; ")}`);
}
```

Run: `pnpm --filter @pitwall/engine test`
Expected: PASS for `validate.test.ts`.

- [ ] **Step 5: Write the failing `Run` tests**

`packages/engine/src/run.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ACK, ESCALATION_TICK, inspectAction } from "./constants";
import { defineScenario } from "./define";
import { ActionRejected, Run } from "./run";
import { fixture, runToEnd } from "./testing/fixture";

const newRun = (seed = 1) => new Run(fixture, seed);
const steps = (run: { step(): void }, n: number) => {
  for (let i = 0; i < n; i++) run.step();
};

describe("paging phase", () => {
  it("starts at tick 0 with the page on the timeline", () => {
    const run = newRun();
    expect(run.tick).toBe(0);
    expect(run.timeline[0]).toEqual({ tick: 0, kind: "page" });
    expect(run.snapshot().acked).toBe(false);
  });

  it("rejects console actions before the ack", () => {
    const run = newRun();
    expect(run.check("svc.poke")).toBe("not_acknowledged");
    expect(() => run.dispatch("svc.poke")).toThrow(ActionRejected);
    try {
      run.dispatch("svc.poke");
    } catch (e) {
      expect((e as ActionRejected).reason).toBe("not_acknowledged");
      expect((e as ActionRejected).tick).toBe(0);
    }
  });

  it("records the ack tick and rejects a second ack", () => {
    const run = newRun();
    steps(run, 25);
    run.dispatch(ACK);
    expect(run.snapshot().ackTick).toBe(25);
    expect(run.check(ACK)).toBe("already_acknowledged");
  });

  it("tags burn before the ack as unacknowledged", () => {
    const run = newRun();
    steps(run, 10);
    run.dispatch(ACK);
    steps(run, 5);
    run.dispatch("svc.fix");
    runToEnd(run);
    const r = run.result();
    expect(r.burnByTag.unacknowledged).toBe(10);
    expect(r.burnByTag.investigating).toBe(14);
  });

  it("escalates at tick 600 when nobody acks", () => {
    const run = newRun();
    steps(run, ESCALATION_TICK);
    expect(run.snapshot().escalated).toBe(false);
    run.step();
    expect(run.snapshot().escalated).toBe(true);
    expect(run.timeline).toContainEqual({ tick: ESCALATION_TICK, kind: "escalated" });
  });

  it("never escalates once acknowledged", () => {
    const run = newRun();
    run.dispatch(ACK);
    steps(run, ESCALATION_TICK + 10);
    expect(run.snapshot().escalated).toBe(false);
  });
});

describe("inspect actions", () => {
  it("are allowed at tick 0 before the ack and take no time", () => {
    const run = newRun();
    run.dispatch(inspectAction("a.clue"));
    run.dispatch(inspectAction("b.herring"));
    run.dispatch(inspectAction("a.clue"));
    const snap = run.snapshot();
    expect(snap.busy).toBeNull();
    expect(snap.inspected).toEqual(["a.clue", "b.herring"]);
    expect(snap.cluesFound).toEqual(["a.clue"]);
    expect(run.actions).toHaveLength(3);
    expect(run.actions.every((a) => a.tick === 0)).toBe(true);
  });

  it("are allowed after the page while the clock runs", () => {
    const run = newRun();
    steps(run, 5);
    run.dispatch(inspectAction("c.late"));
    expect(run.timeline).toContainEqual({ tick: 5, kind: "inspect", hotspotId: "c.late" });
    expect(run.snapshot().cluesFound).toEqual(["c.late"]);
  });

  it("reject unknown hotspots, including prototype keys", () => {
    const run = newRun();
    for (const id of ["nope", "constructor", "__proto__", "toString"]) {
      expect(run.check(inspectAction(id))).toBe("unknown_action");
    }
    expect(run.check("svc.nope")).toBe("unknown_action");
  });
});

describe("timed actions", () => {
  it("keep the player busy until they finish, then reveal findings", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.poke");
    expect(run.snapshot().busy).toEqual({ actionId: "svc.poke", startTick: 0, endTick: 20 });
    steps(run, 5);
    expect(run.check("svc.fix")).toBe("busy");
    expect(run.check(ACK)).toBe("already_acknowledged");
    expect(run.check(inspectAction("a.clue"))).toBeNull();
    steps(run, 15);
    expect(run.snapshot().busy).toBeNull();
    const finding = run.logs.find((l) => l.finding);
    expect(finding).toMatchObject({ tick: 19, serviceId: "svc", text: "poked at level 20", finding: true });
    expect(run.timeline).toContainEqual({ tick: 19, kind: "action_done", actionId: "svc.poke" });
  });

  it("log findings from global actions under 'global'", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("status");
    steps(run, 10);
    expect(run.logs.find((l) => l.finding)).toMatchObject({ serviceId: "global", text: "status posted" });
  });

  it("tag side-effect burn with the action id", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.break");
    steps(run, 10);
    run.dispatch("svc.fix");
    runToEnd(run);
    const r = run.result();
    expect(r.burnByTag["side_effect:svc.break"]).toBe(50);
    expect(r.burnByTag.investigating).toBe(19);
  });

  it("tag burn as mitigated_unfixed while a mitigation hides the cause", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.patch");
    steps(run, 20);
    run.dispatch("svc.fix");
    runToEnd(run);
    const r = run.result();
    expect(r.burnByTag.investigating).toBe(9);
    expect(r.burnByTag.mitigated_unfixed).toBe(20);
  });

  it("respect availability", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.fix");
    steps(run, 10);
    expect(run.check("svc.fix")).toBe("unavailable");
  });
});

describe("resolution and time limit", () => {
  it("resolves after the fix holds for 10 s and records mitigatedAtTick", () => {
    const run = newRun();
    run.dispatch(ACK);
    run.dispatch("svc.fix");
    expect(runToEnd(run)).toBe(109);
    const r = run.result();
    expect(r.outcome).toBe("resolved");
    expect(r.endTick).toBe(109);
    expect(r.mitigatedAtTick).toBe(9);
    expect(r.budgetBurnedBp).toBe(9);
    expect(r.rootCauseFound).toBe(true);
    expect(r.timeline).toContainEqual({ tick: 109, kind: "resolved" });
    expect(r.timeline).toContainEqual({ tick: 9, kind: "alert_cleared", alertId: "svc.down" });
  });

  it("ends as DNF at the time limit with every tick unacknowledged", () => {
    const run = newRun();
    expect(runToEnd(run)).toBe(900);
    const r = run.result();
    expect(r).toMatchObject({ outcome: "dnf", endTick: 900, mitigatedAtTick: null, ackTick: null, escalated: true, budgetBurnedBp: 900, rootCauseFound: false });
    expect(r.burnByTag).toEqual({ unacknowledged: 900 });
  });

  it("refuses to step, dispatch or report once finished, and refuses a result while running", () => {
    const run = newRun();
    expect(() => run.result()).toThrow(/in progress/);
    runToEnd(run);
    expect(() => run.step()).toThrow(/finished/);
    expect(run.check(ACK)).toBe("finished");
  });
});

describe("alerts, logs and metrics", () => {
  it("fires alerts at construction so the page shows them", () => {
    const snap = newRun().snapshot();
    expect(snap.alerts).toEqual([{ alertId: "svc.down", firedAtTick: 0, clearedAtTick: null }]);
  });

  it("emits template logs on their cadence", () => {
    const run = newRun();
    steps(run, 100);
    const lines = run.logs.filter((l) => !l.finding);
    expect(lines).toHaveLength(10);
    expect(lines.every((l) => l.level === "INFO" && l.serviceId === "svc")).toBe(true);
  });

  it("is deterministic per seed, and noise differs across seeds", () => {
    const a = newRun(7);
    const b = newRun(7);
    const c = newRun(8);
    for (const r of [a, b, c]) steps(r, 50);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.logs).toEqual(b.logs);
    expect(a.snapshot().metrics["svc.level"]).not.toBe(c.snapshot().metrics["svc.level"]);
  });

  it("reports service details and health from state", () => {
    const run = newRun();
    steps(run, 3);
    const snap = run.snapshot();
    expect(snap.details).toEqual({ svc: "level 3" });
    expect(snap.health).toEqual({ svc: "crit" });
  });
});

describe("determinism guards", () => {
  it("throws when dynamics produce a non-integer state", () => {
    const bad = defineScenario({ ...fixture, dynamics: (s) => ({ ...s, level: s.level + 0.5 }) });
    const run = new Run(bad, 1);
    expect(() => run.step()).toThrow(/integers/);
  });

  it("validates the scenario on construction", () => {
    expect(() => new Run({ ...fixture, lessons: [] }, 1)).toThrow(/lesson/);
  });
});
```

Note on the `side_effect` test: ticks 0–9 burn 10% base (10 bp investigating) plus 50% side effect (50 bp); the fix is dispatched at tick 10 and completes during tick 19, so ticks 10–18 add 9 more investigating bp: 19 total. On the `mitigated_unfixed` test: the patch completes during tick 9, so ticks 0–8 are investigating (9 bp); ticks 9–19 are mitigated, then the fix runs ticks 20–29 and completes during tick 29, so ticks 20–28 add 9 more: 11 + 9 = 20.

Run: `pnpm --filter @pitwall/engine test`
Expected: FAIL, `Failed to resolve import "./run"`.

- [ ] **Step 6: Implement `run.ts`**

```ts
import { ACK, ENGINE_VERSION, ESCALATION_TICK, INSPECT_PREFIX, LOG_CAP, STABLE_TICKS_TO_RESOLVE, TICKS_PER_SECOND } from "./constants";
import { mulberry32, streamSeed, type Rng } from "./rng";
import type {
  ActionDef, ActionRecord, AlertState, BusyState, LogEntry, LogLevel, Outcome, RunResult, ScenarioDef, Snapshot, State, TimelineEntry,
} from "./types";
import { validateScenario } from "./validate";

export type RejectReason =
  | "finished"
  | "unknown_action"
  | "not_acknowledged"
  | "already_acknowledged"
  | "busy"
  | "unavailable"
  | "out_of_order";

export class ActionRejected extends Error {
  name = "ActionRejected";
  readonly actionId: string;
  readonly tick: number;
  readonly reason: RejectReason;

  constructor(actionId: string, tick: number, reason: RejectReason) {
    super(`${actionId} rejected at tick ${tick}: ${reason}`);
    this.actionId = actionId;
    this.tick = tick;
    this.reason = reason;
  }
}

function assertIntegers(s: State, where: string): void {
  for (const [key, value] of Object.entries(s)) {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`state.${key} is ${value} after ${where}; scenario state must be integers`);
    }
  }
}

const clampBp = (bp: number): number => Math.min(10_000, Math.max(0, Math.floor(bp)));

/**
 * One incident, advanced one 100 ms tick at a time. The browser calls step() in real time;
 * replay() calls it in a loop. Both dispatch actions between steps, so both see the same run.
 *
 * Tick order: dynamics → complete the running action → metrics → alerts → logs → escalation
 * → burn → resolution → time limit.
 */
export class Run<S extends State> {
  readonly scenario: ScenarioDef<S>;
  readonly seed: number;
  readonly actions: ActionRecord[] = [];
  readonly timeline: TimelineEntry[] = [];
  readonly logs: LogEntry[] = [];
  tick = 0;
  outcome: Outcome = "running";

  private s: S;
  private readonly dynamicsRng: Rng;
  private readonly noiseRng: Rng;
  private readonly logRng: Rng;
  private readonly logOffsets: number[];
  private readonly actionDefs: Map<string, ActionDef<S>>;
  private readonly timeLimitTicks: number;
  private acked = false;
  private ackTick: number | null = null;
  private escalated = false;
  private busy: BusyState | null = null;
  private readonly completed = new Set<string>();
  private readonly burnUnits = new Map<string, number>();
  private readonly alertStates: AlertState[] = [];
  private readonly firing = new Map<string, AlertState>();
  private readonly inspected: string[] = [];
  private readonly cluesFound: string[] = [];
  private metricValues: Record<string, number>;
  private stableSince: number | null = null;
  private mitigatedAtTick: number | null = null;
  private endTick: number | null = null;
  private logSeq = 0;

  constructor(scenario: ScenarioDef<S>, seed: number) {
    validateScenario(scenario);
    this.scenario = scenario;
    this.seed = seed;
    this.dynamicsRng = mulberry32(streamSeed(seed, "dynamics"));
    this.noiseRng = mulberry32(streamSeed(seed, "metrics"));
    this.logRng = mulberry32(streamSeed(seed, "logs"));
    this.s = scenario.setup(this.dynamicsRng);
    assertIntegers(this.s, "setup");
    this.logOffsets = scenario.logs.map((l) => this.logRng.int(l.everyTicks));
    this.actionDefs = new Map(scenario.actions.map((a) => [a.id, a]));
    this.timeLimitTicks = scenario.timeLimitS * TICKS_PER_SECOND;
    this.metricValues = this.sampleMetrics();
    this.timeline.push({ tick: 0, kind: "page" });
    this.evaluateAlerts(0);
  }

  /** Why an action would be rejected right now, or null if it is allowed. */
  check(actionId: string): RejectReason | null {
    if (this.outcome !== "running") return "finished";
    if (actionId === ACK) return this.acked ? "already_acknowledged" : null;
    if (actionId.startsWith(INSPECT_PREFIX)) {
      return Object.hasOwn(this.scenario.coldOpen.hotspots, actionId.slice(INSPECT_PREFIX.length)) ? null : "unknown_action";
    }
    const def = this.actionDefs.get(actionId);
    if (!def) return "unknown_action";
    if (!this.acked) return "not_acknowledged";
    if (this.busy) return "busy";
    if (def.available && !def.available(this.s)) return "unavailable";
    return null;
  }

  /** Records the action at the current tick. Throws ActionRejected if it is not allowed. */
  dispatch(actionId: string): void {
    const reason = this.check(actionId);
    if (reason) throw new ActionRejected(actionId, this.tick, reason);
    const tick = this.tick;
    this.actions.push({ tick, actionId });

    if (actionId === ACK) {
      this.acked = true;
      this.ackTick = tick;
      this.timeline.push({ tick, kind: "ack" });
      return;
    }
    if (actionId.startsWith(INSPECT_PREFIX)) {
      const hotspotId = actionId.slice(INSPECT_PREFIX.length);
      if (!this.inspected.includes(hotspotId)) this.inspected.push(hotspotId);
      if (this.scenario.coldOpen.hotspots[hotspotId]?.kind === "clue" && !this.cluesFound.includes(hotspotId)) {
        this.cluesFound.push(hotspotId);
      }
      this.timeline.push({ tick, kind: "inspect", hotspotId });
      return;
    }
    const def = this.actionDefs.get(actionId)!;
    this.busy = { actionId, startTick: tick, endTick: tick + def.durationS * TICKS_PER_SECOND };
    this.timeline.push({ tick, kind: "action_start", actionId });
  }

  step(): void {
    if (this.outcome !== "running") throw new Error("run is finished");
    const t = this.tick;
    const sc = this.scenario;

    this.s = sc.dynamics(this.s, this.dynamicsRng, t);
    assertIntegers(this.s, `dynamics at tick ${t}`);

    const running = this.busy;
    if (running && t === running.endTick - 1) this.complete(running, t);

    this.metricValues = this.sampleMetrics();
    this.evaluateAlerts(t);
    this.emitLogs(t);

    if (!this.acked && t === ESCALATION_TICK) {
      this.escalated = true;
      this.timeline.push({ tick: t, kind: "escalated" });
    }

    this.accountBurn(running);
    this.checkResolution(t);

    this.tick = t + 1;
    if (this.outcome === "running" && this.tick >= this.timeLimitTicks) {
      this.outcome = "dnf";
      this.endTick = this.tick;
      this.timeline.push({ tick: this.tick, kind: "dnf" });
    }
  }

  snapshot(): Snapshot {
    const details: Record<string, string> = {};
    for (const svc of this.scenario.services) details[svc.id] = svc.detail(this.s);
    return {
      tick: this.tick,
      outcome: this.outcome,
      acked: this.acked,
      ackTick: this.ackTick,
      escalated: this.escalated,
      busy: this.busy ? { ...this.busy } : null,
      metrics: { ...this.metricValues },
      health: this.scenario.health(this.s),
      details,
      alerts: this.alertStates.map((a) => ({ ...a })),
      budgetBurnedBp: this.budgetBurnedBp(),
      inspected: [...this.inspected],
      cluesFound: [...this.cluesFound],
    };
  }

  result(): RunResult {
    if (this.outcome === "running" || this.endTick === null) throw new Error("run is still in progress");
    const budget = this.scenario.slo.budgetRequests;
    const burnByTag: Record<string, number> = {};
    for (const [tag, units] of this.burnUnits) burnByTag[tag] = Math.floor(units / budget);
    return {
      scenarioId: this.scenario.id,
      seed: this.seed,
      engineVersion: ENGINE_VERSION,
      outcome: this.outcome,
      endTick: this.endTick,
      mitigatedAtTick: this.mitigatedAtTick,
      budgetBurnedBp: this.budgetBurnedBp(),
      burnByTag,
      ackTick: this.ackTick,
      escalated: this.escalated,
      cluesFound: [...this.cluesFound],
      rootCauseFound: this.scenario.rootCauseActionIds.some((id) => this.completed.has(id)),
      actions: this.actions.map((a) => ({ ...a })),
      timeline: this.timeline.map((e) => ({ ...e })),
    };
  }

  private complete(busy: BusyState, t: number): void {
    const def = this.actionDefs.get(busy.actionId)!;
    if (def.effect) {
      this.s = def.effect(this.s);
      assertIntegers(this.s, `effect of ${def.id}`);
    }
    for (const line of def.reveals?.(this.s) ?? []) this.pushLog(t, def.serviceId ?? "global", "INFO", line, true);
    this.completed.add(def.id);
    this.busy = null;
    this.timeline.push({ tick: t, kind: "action_done", actionId: def.id });
  }

  private sampleMetrics(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of this.scenario.metrics) out[m.id] = m.value(this.s, this.noiseRng);
    return out;
  }

  private evaluateAlerts(t: number): void {
    for (const rule of this.scenario.alerts) {
      const on = rule.when(this.s);
      const current = this.firing.get(rule.id);
      if (on && !current) {
        const state: AlertState = { alertId: rule.id, firedAtTick: t, clearedAtTick: null };
        this.alertStates.push(state);
        this.firing.set(rule.id, state);
        this.timeline.push({ tick: t, kind: "alert_fired", alertId: rule.id });
      } else if (!on && current) {
        current.clearedAtTick = t;
        this.firing.delete(rule.id);
        this.timeline.push({ tick: t, kind: "alert_cleared", alertId: rule.id });
      }
    }
  }

  private emitLogs(t: number): void {
    this.scenario.logs.forEach((tpl, i) => {
      const offset = this.logOffsets[i]!;
      if (t < offset || (t - offset) % tpl.everyTicks !== 0) return;
      if (tpl.when && !tpl.when(this.s)) return;
      this.pushLog(t, tpl.serviceId, tpl.level, tpl.text(this.s, this.logRng), false);
    });
  }

  private pushLog(tick: number, serviceId: string, level: LogLevel, text: string, finding: boolean): void {
    this.logs.push({ seq: this.logSeq++, tick, serviceId, level, text, finding });
    if (this.logs.length > LOG_CAP) this.logs.splice(0, this.logs.length - LOG_CAP);
  }

  private accountBurn(running: BusyState | null): void {
    const sc = this.scenario;
    const base = clampBp(sc.errorRateBp(this.s));
    const tag = !this.acked ? "unacknowledged" : sc.mitigated(this.s) ? "mitigated_unfixed" : "investigating";
    this.addBurn(tag, sc.trafficPerTick * base);
    const sideBp = running ? (this.actionDefs.get(running.actionId)?.sideEffectBp ?? 0) : 0;
    const side = Math.min(clampBp(sideBp), 10_000 - base);
    if (running && side > 0) this.addBurn(`side_effect:${running.actionId}`, sc.trafficPerTick * side);
  }

  private addBurn(tag: string, units: number): void {
    this.burnUnits.set(tag, (this.burnUnits.get(tag) ?? 0) + units);
  }

  /** Burned budget in basis points: Σ(traffic × errorBp) / budgetRequests. */
  private budgetBurnedBp(): number {
    let total = 0;
    for (const units of this.burnUnits.values()) total += units;
    return Math.floor(total / this.scenario.slo.budgetRequests);
  }

  private checkResolution(t: number): void {
    if (!this.acked || !this.scenario.resolvedWhen(this.s)) {
      this.stableSince = null;
      return;
    }
    this.stableSince ??= t;
    if (t - this.stableSince + 1 >= STABLE_TICKS_TO_RESOLVE) {
      this.outcome = "resolved";
      this.endTick = t + 1;
      this.mitigatedAtTick = this.stableSince;
      this.timeline.push({ tick: t + 1, kind: "resolved" });
    }
  }
}
```

`packages/engine/src/index.ts`:
```ts
export * from "./constants";
export { mulberry32, streamSeed, type Rng } from "./rng";
export type * from "./types";
export { defineScenario } from "./define";
export { ScenarioError, validateScenario } from "./validate";
export { ActionRejected, Run, type RejectReason } from "./run";
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @pitwall/engine test`
Expected: PASS, all `validate` and `run` tests green. Then `pnpm --filter @pitwall/engine typecheck` and `pnpm lint`: both clean.

- [ ] **Step 8: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): Run tick loop with paging phase, cause-tagged burn and resolution"
```

---

### Task 3: Replay and lessons

**Files:**
- Create: `packages/engine/src/replay.ts`, `lessons.ts`, `replay.test.ts`, `lessons.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: Task 2 `Run`, `ActionRejected`, `RunResult`, `ScenarioDef`, `LessonDef`.
- Produces: `replay<S extends State>(scenario: ScenarioDef<S>, seed: number, actions: readonly ActionRecord[]): RunResult` (throws `ActionRejected`), `pickLesson<S extends State>(scenario: ScenarioDef<S>, result: RunResult): LessonDef`.

- [ ] **Step 1: Write the failing tests**

`packages/engine/src/replay.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ACK, inspectAction } from "./constants";
import { replay } from "./replay";
import { ActionRejected, Run } from "./run";
import { fixture, runToEnd } from "./testing/fixture";

const rejection = (fn: () => unknown): ActionRejected => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ActionRejected) return e;
    throw e;
  }
  throw new Error("expected ActionRejected");
};

describe("replay", () => {
  it("reproduces a live run exactly, including tick-0 inspects and same-tick actions", () => {
    const live = new Run(fixture, 99);
    live.dispatch(inspectAction("a.clue"));
    live.dispatch(inspectAction("b.herring"));
    for (let i = 0; i < 3; i++) live.step();
    live.dispatch(ACK);
    live.dispatch("svc.poke");
    for (let i = 0; i < 22; i++) live.step();
    live.dispatch(inspectAction("c.late"));
    live.dispatch("svc.fix");
    runToEnd(live);
    const result = live.result();

    expect(replay(fixture, 99, result.actions)).toEqual(result);
  });

  it("is deterministic: the same log twice gives the same result", () => {
    const log = [{ tick: 4, actionId: ACK }, { tick: 4, actionId: "svc.fix" }];
    expect(replay(fixture, 5, log)).toEqual(replay(fixture, 5, log));
  });

  it("rejects a console action before the ack", () => {
    const e = rejection(() => replay(fixture, 1, [{ tick: 0, actionId: "svc.fix" }]));
    expect(e.reason).toBe("not_acknowledged");
  });

  it("rejects out-of-order, negative and fractional ticks", () => {
    const outOfOrder = [{ tick: 5, actionId: ACK }, { tick: 3, actionId: "svc.poke" }];
    expect(rejection(() => replay(fixture, 1, outOfOrder)).reason).toBe("out_of_order");
    expect(rejection(() => replay(fixture, 1, [{ tick: -1, actionId: ACK }])).reason).toBe("out_of_order");
    expect(rejection(() => replay(fixture, 1, [{ tick: 2.5, actionId: ACK }])).reason).toBe("out_of_order");
  });

  it("rejects actions after the run ended", () => {
    const late = [{ tick: 0, actionId: ACK }, { tick: 0, actionId: "svc.fix" }, { tick: 500, actionId: "svc.poke" }];
    expect(rejection(() => replay(fixture, 1, late)).reason).toBe("finished");
    expect(rejection(() => replay(fixture, 1, [{ tick: 5000, actionId: ACK }])).reason).toBe("finished");
  });

  it("rejects unknown actions and a busy player", () => {
    expect(rejection(() => replay(fixture, 1, [{ tick: 0, actionId: "rm -rf" }])).reason).toBe("unknown_action");
    const busy = [{ tick: 0, actionId: ACK }, { tick: 0, actionId: "svc.poke" }, { tick: 3, actionId: "svc.fix" }];
    expect(rejection(() => replay(fixture, 1, busy)).reason).toBe("busy");
  });
});
```

`packages/engine/src/lessons.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ACK } from "./constants";
import { pickLesson } from "./lessons";
import { replay } from "./replay";
import { fixture } from "./testing/fixture";

describe("pickLesson", () => {
  it("returns the first lesson whose condition matches", () => {
    expect(pickLesson(fixture, replay(fixture, 1, [])).id).toBe("dnf");
    const fixed = replay(fixture, 1, [{ tick: 0, actionId: ACK }, { tick: 0, actionId: "svc.fix" }]);
    expect(pickLesson(fixture, fixed).id).toBe("default");
  });

  it("throws when no lesson matches, so a missing catch-all is caught in tests", () => {
    const noCatchAll = { ...fixture, lessons: [fixture.lessons[0]!] };
    const fixed = replay(fixture, 1, [{ tick: 0, actionId: ACK }, { tick: 0, actionId: "svc.fix" }]);
    expect(() => pickLesson(noCatchAll, fixed)).toThrow(/no lesson/);
  });
});
```

Run: `pnpm --filter @pitwall/engine test`
Expected: FAIL, `Failed to resolve import "./replay"`.

- [ ] **Step 2: Implement**

`packages/engine/src/replay.ts`:
```ts
import { ActionRejected, Run } from "./run";
import type { ActionRecord, RunResult, ScenarioDef, State } from "./types";

/**
 * Re-runs an action log from scratch. The server trusts only this (spec §4): an action the
 * live client could not have taken at its tick throws ActionRejected (HTTP 422 in M2).
 * Ticks must be non-decreasing integers; several actions may share a tick.
 */
export function replay<S extends State>(scenario: ScenarioDef<S>, seed: number, actions: readonly ActionRecord[]): RunResult {
  const run = new Run(scenario, seed);
  let i = 0;
  while (run.outcome === "running") {
    for (let next = actions[i]; next && next.tick <= run.tick; next = actions[i]) {
      if (next.tick !== run.tick) throw new ActionRejected(next.actionId, next.tick, "out_of_order");
      run.dispatch(next.actionId);
      i++;
    }
    run.step();
  }
  const leftover = actions[i];
  if (leftover) throw new ActionRejected(leftover.actionId, leftover.tick, "finished");
  return run.result();
}
```

`packages/engine/src/lessons.ts`:
```ts
import type { LessonDef, RunResult, ScenarioDef, State } from "./types";

export function pickLesson<S extends State>(scenario: ScenarioDef<S>, result: RunResult): LessonDef {
  const lesson = scenario.lessons.find((l) => l.when(result));
  if (!lesson) throw new Error(`${scenario.id}: no lesson matches this run; make the last lesson a catch-all`);
  return lesson;
}
```

Add to `index.ts`:
```ts
export { replay } from "./replay";
export { pickLesson } from "./lessons";
```

Why the loop rejects bad ticks: a negative or fractional tick is `<= run.tick` at some point but never `=== run.tick`, so it lands in the `out_of_order` branch; a tick past the end is never reached and is reported as `finished`.

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pnpm --filter @pitwall/engine test`
Expected: PASS (all engine tests).

- [ ] **Step 4: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): replay action logs and pick the debrief lesson"
```

---

### Task 4: Scenario 1 "The Slow Leak" with golden players

**Files:**
- Create: `packages/scenarios/package.json`, `tsconfig.json`, `src/slow-leak.ts`, `src/index.ts`, `src/golden.test.ts`, `src/content.test.ts`
- Modify: `docs/specs/2026-09-28-cold-open-design.md` (§5 clue rule → 1–3, decision P5)

**Interfaces:**
- Consumes: `@pitwall/engine` (`defineScenario`, `replay`, `pickLesson`, `inspectAction`, `ACK`, types).
- Produces: `slowLeak: ScenarioDef<SlowLeak>`, `SCENARIOS: readonly ScenarioDef<State>[]`, `getScenario(id: string): ScenarioDef<State> | undefined`. Scenario id `"db-pool-exhaustion"`. Service ids `edge`, `checkout`, `postgres`, `payments`. Action ids listed below.

**Model.** The checkout-api pool (100 connections) is tracked in milli-connections so the leak stays integer. v142 leaks 18–24 milli-connections per tick (seeded). Errors start once the pool passes 88% and reach 40% at saturation. Traffic is 2 requests per tick; the budget is 5,000 requests.

| Action id | Service | Category | Seconds | Verdict | Effect |
|---|---|---|---|---|---|
| `edge.error_log` | edge | investigate | 3 | useful | finding: upstream timeouts, all from checkout-api |
| `edge.add_workers` | edge | mitigate | 10 | wasted | finding: timeouts unchanged |
| `checkout.pool_stats` | checkout | investigate | 4 | useful | finding: pool full, oldest connection idle in transaction |
| `checkout.deploys` | checkout | investigate | 3 | useful | finding: v142 shipped 52 min ago |
| `checkout.restart` | checkout | mitigate | 15 | harmful | 50% errors while it runs; pool reset to 40; leak continues |
| `checkout.rollback` | checkout | fix | 30 | useful | leak stops, pool to 30; root cause |
| `postgres.connections` | postgres | investigate | 3 | useful | finding: 94 connections idle in transaction from checkout-api |
| `postgres.raise_max_conns` | postgres | fix | 20 | harmful | 20% errors while the DB restarts; no effect on the pool |
| `postgres.failover` | postgres | mitigate | 30 | harmful | 30% errors while it runs; pool reset to 40; leak continues |
| `payments.status` | payments | investigate | 3 | wasted | finding: provider healthy |
| `global.status_update` | global | communicate | 5 | useful | finding: status page updated |
| `global.ask_secondary` | global | communicate | 10 | useful | finding: the secondary remembers the v142 deploy |

- [ ] **Step 1: Scaffold the package**

`packages/scenarios/package.json`:
```json
{
  "name": "@pitwall/scenarios",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pitwall/engine": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^5.0.2"
  }
}
```
`packages/scenarios/tsconfig.json`: same as the engine's. Run `pnpm install`.

- [ ] **Step 2: Write the failing golden and content tests**

`packages/scenarios/src/golden.test.ts`:
```ts
import { ACK, inspectAction, pickLesson, replay, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { slowLeak } from "./slow-leak";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** Reads the clue, acks in 2 s, checks the pool and the deploys, rolls back. */
const perfect = [
  at(0, inspectAction("laptop.slack.deploys")),
  at(20, ACK),
  at(20, "checkout.pool_stats"),
  at(60, "checkout.deploys"),
  at(90, "checkout.rollback"),
];

/** Chases the loud database, then restarts, and only then rolls back. */
const redHerring = [
  at(20, ACK),
  at(20, "postgres.connections"),
  at(50, "postgres.raise_max_conns"),
  at(250, "postgres.failover"),
  at(550, "checkout.restart"),
  at(700, "checkout.rollback"),
];

describe("The Slow Leak: golden players", () => {
  it("perfect player resolves under par with the root cause found", () => {
    const r = replay(slowLeak, 1, perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(r.budgetBurnedBp).toBeLessThanOrEqual(slowLeak.parBp);
    expect(r.cluesFound).toEqual(["laptop.slack.deploys"]);
  });

  it("perfect player resolves under par on every seed from 1 to 50", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = replay(slowLeak, seed, perfect);
      expect({ seed, outcome: r.outcome, underPar: r.budgetBurnedBp <= slowLeak.parBp }).toEqual({ seed, outcome: "resolved", underPar: true });
    }
  });

  it("do-nothing player DNFs, escalates, and burns only unacknowledged budget", () => {
    const r = replay(slowLeak, 1, []);
    expect(r.outcome).toBe("dnf");
    expect(r.escalated).toBe(true);
    expect(Object.keys(r.burnByTag)).toEqual(["unacknowledged"]);
    expect(pickLesson(slowLeak, r).id).toBe("dnf");
  });

  it("red-herring player scores strictly worse than perfect, with side-effect burn", () => {
    const best = replay(slowLeak, 1, perfect);
    const r = replay(slowLeak, 1, redHerring);
    expect(r.outcome).toBe("resolved");
    expect(r.budgetBurnedBp).toBeGreaterThan(best.budgetBurnedBp);
    expect(r.burnByTag["side_effect:postgres.failover"]).toBeGreaterThan(0);
    expect(r.burnByTag["side_effect:checkout.restart"]).toBeGreaterThan(0);
    expect(pickLesson(slowLeak, r).id).toBe("restart-trap");
  });

  it("restart trap: the leak returns and burns as mitigated_unfixed", () => {
    const r = replay(slowLeak, 1, [at(20, ACK), at(20, "checkout.restart"), at(3200, "checkout.rollback")]);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
  });

  it("slow ack gets the ack lesson", () => {
    const r = replay(slowLeak, 1, [at(400, ACK), at(400, "checkout.rollback")]);
    expect(pickLesson(slowLeak, r).id).toBe("slow-ack");
  });

  it("the default lesson covers a clean run", () => {
    expect(pickLesson(slowLeak, replay(slowLeak, 1, perfect)).id).toBe("default");
  });
});
```

`packages/scenarios/src/content.test.ts`:
```ts
import { Run } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { getScenario, SCENARIOS } from "./index";

/** Hotspot areas each scene draws (cold-open spec §6). M1.5 replaces this with the scenes package. */
const SCENE_AREAS: Record<string, string[]> = { cafe: ["laptop", "phone", "table", "wall"] };

describe.each(SCENARIOS.map((s) => [s.id, s] as const))("%s content", (_id, scenario) => {
  it("passes engine validation", () => {
    expect(() => new Run(scenario, 1)).not.toThrow();
  });

  it("has 1–3 clues and 1–2 herrings (cold-open spec §5)", () => {
    const kinds = Object.values(scenario.coldOpen.hotspots).map((h) => h.kind);
    const clues = kinds.filter((k) => k === "clue").length;
    const herrings = kinds.filter((k) => k === "herring").length;
    expect(clues).toBeGreaterThanOrEqual(1);
    expect(clues).toBeLessThanOrEqual(3);
    expect(herrings).toBeGreaterThanOrEqual(1);
    expect(herrings).toBeLessThanOrEqual(2);
  });

  it("places every hotspot in an area its scene draws", () => {
    const areas = SCENE_AREAS[scenario.coldOpen.scene];
    expect(areas).toBeDefined();
    for (const id of Object.keys(scenario.coldOpen.hotspots)) {
      expect(areas).toContain(id.split(".")[0]);
    }
  });

  it("ends its lessons with a catch-all", () => {
    expect(scenario.lessons.at(-1)!.when({} as never)).toBe(true);
  });

  it("is registered by id", () => {
    expect(getScenario(scenario.id)).toBe(scenario);
  });
});
```

Run: `pnpm --filter @pitwall/scenarios test`
Expected: FAIL, `Failed to resolve import "./slow-leak"`.

- [ ] **Step 3: Implement the scenario**

`packages/scenarios/src/slow-leak.ts`:
```ts
import { defineScenario, type Rng } from "@pitwall/engine";

/** checkout-api pool, in milli-connections so the leak stays integer (spec §5, rule 3). */
const POOL_MAX = 100_000;
const OTHER_DB_CLIENTS = 8;

type SlowLeak = {
  pool: number;
  leak: number;
  rolledBack: number;
  restarts: number;
  failovers: number;
  dbMaxConns: number;
  statusPosted: number;
};

const inUse = (s: SlowLeak) => Math.floor(s.pool / 1000);
const dbConns = (s: SlowLeak) => inUse(s) + OTHER_DB_CLIENTS;
const errorRateBp = (s: SlowLeak): number =>
  s.pool <= 88_000 ? 0 : s.pool >= POOL_MAX ? 4000 : Math.floor((s.pool - 88_000) / 3);
const p99Ms = (s: SlowLeak): number =>
  s.pool <= 85_000 ? 140 : Math.min(5000, 140 + Math.floor(((s.pool - 85_000) * 4860) / 15_000));
const jitter = (rng: Rng, spread: number) => (rng.next() - 0.5) * spread;
const hex4 = (rng: Rng) => rng.int(0x10000).toString(16).padStart(4, "0");

export const slowLeak = defineScenario<SlowLeak>({
  id: "db-pool-exhaustion",
  title: "The Slow Leak",
  summary: "Checkout is failing and the database is shouting. Is it really the database?",
  difficulty: "normal",
  timeLimitS: 480,
  parBp: 450,
  slo: { availability: 99.9, budgetRequests: 5000 },
  trafficPerTick: 2,

  services: [
    { id: "edge", label: "edge-gateway", x: 12, y: 50, detail: () => "nginx · 2 nodes" },
    { id: "checkout", label: "checkout-api", x: 44, y: 50, detail: (s) => (s.rolledBack ? "v141 · 3 pods" : "v142 · 3 pods") },
    { id: "postgres", label: "postgres", x: 80, y: 24, detail: (s) => `primary · max ${s.dbMaxConns} conns` },
    { id: "payments", label: "payments", x: 80, y: 76, detail: () => "external provider" },
  ],
  edges: [
    { from: "edge", to: "checkout" },
    { from: "checkout", to: "postgres" },
    { from: "checkout", to: "payments" },
  ],

  setup: (rng) => ({
    pool: 88_500 + rng.int(1001),
    leak: 18 + rng.int(7),
    rolledBack: 0,
    restarts: 0,
    failovers: 0,
    dbMaxConns: 120,
    statusPosted: 0,
  }),
  dynamics: (s) => ({ ...s, pool: Math.min(POOL_MAX, s.pool + s.leak) }),
  errorRateBp,
  health: (s) => {
    const err = errorRateBp(s);
    const conns = dbConns(s);
    return {
      edge: err >= 1000 ? "crit" : err >= 100 ? "warn" : "ok",
      checkout: inUse(s) >= 90 ? "warn" : "ok",
      postgres: conns >= 95 ? "crit" : conns >= 85 ? "warn" : "ok",
      payments: "ok",
    };
  },
  mitigated: (s) => s.rolledBack === 0 && s.restarts + s.failovers > 0,
  resolvedWhen: (s) => s.rolledBack === 1 && s.pool < 60_000,

  metrics: [
    { id: "edge.rps", serviceId: "edge", label: "Requests", unit: "req/s", max: 40, value: (_s, n) => 20 + jitter(n, 3) },
    { id: "edge.err", serviceId: "edge", label: "5xx rate", unit: "%", max: 50, warn: 1, crit: 2, value: (s, n) => Math.max(0, errorRateBp(s) / 100 + (errorRateBp(s) ? jitter(n, 0.6) : 0)) },
    { id: "checkout.pool", serviceId: "checkout", label: "Pool in use", unit: "of 100", max: 100, warn: 90, crit: 100, value: (s) => inUse(s) },
    { id: "checkout.p99", serviceId: "checkout", label: "p99 latency", unit: "ms", max: 5500, warn: 1000, crit: 2000, value: (s, n) => Math.max(0, p99Ms(s) + jitter(n, 40)) },
    { id: "postgres.conns", serviceId: "postgres", label: "Connections", unit: "conns", max: 120, warn: 85, crit: 95, value: (s, n) => dbConns(s) + jitter(n, 2) },
    { id: "postgres.cpu", serviceId: "postgres", label: "CPU", unit: "%", max: 100, warn: 70, crit: 90, value: (_s, n) => 24 + jitter(n, 8) },
    { id: "payments.p99", serviceId: "payments", label: "p99 latency", unit: "ms", max: 2000, warn: 800, crit: 1500, value: (_s, n) => 182 + jitter(n, 40) },
    { id: "payments.err", serviceId: "payments", label: "Error rate", unit: "%", max: 5, warn: 1, crit: 2, value: (_s, n) => 0.1 + jitter(n, 0.1) },
  ],

  logs: [
    { id: "edge.upstream_timeout", serviceId: "edge", level: "ERROR", everyTicks: 7, when: (s) => errorRateBp(s) >= 100,
      text: (_s, r) => `upstream timed out (110) while reading response header, client 10.0.${r.int(256)}.${r.int(256)}, request "POST /checkout", upstream "checkout-api:8080"` },
    { id: "edge.access", serviceId: "edge", level: "INFO", everyTicks: 12,
      text: (_s, r) => `GET /products/${1000 + r.int(9000)} 200 ${30 + r.int(40)}ms` },
    { id: "checkout.pool_timeout", serviceId: "checkout", level: "WARN", everyTicks: 9, when: (s) => s.pool >= 95_000,
      text: (s, r) => `pool timeout: waited 5000ms for a connection (active=${inUse(s)} idle=0 waiting=${10 + r.int(40)})` },
    { id: "checkout.ok", serviceId: "checkout", level: "INFO", everyTicks: 16, when: (s) => s.pool < 98_000,
      text: (s, r) => `POST /checkout 200 ${p99Ms(s) > 1000 ? 900 + r.int(900) : 90 + r.int(80)}ms` },
    { id: "checkout.held", serviceId: "checkout", level: "WARN", everyTicks: 60, when: (s) => s.rolledBack === 0,
      text: (_s, r) => `connection held ${40 + r.int(20)} min by tx ${hex4(r)} and never released` },
    { id: "postgres.reset", serviceId: "postgres", level: "WARN", everyTicks: 5, when: (s) => dbConns(s) >= 90,
      text: () => "could not receive data from client: Connection reset by peer" },
    { id: "postgres.slow_query", serviceId: "postgres", level: "WARN", everyTicks: 40,
      text: (_s, r) => `duration: ${1000 + r.int(400)}.${r.int(1000)} ms  statement: SELECT o.* FROM orders o WHERE o.customer_id = $1` },
    { id: "postgres.checkpoint", serviceId: "postgres", level: "INFO", everyTicks: 150,
      text: (_s, r) => `checkpoint complete: wrote ${1000 + r.int(900)} buffers` },
    { id: "payments.ok", serviceId: "payments", level: "INFO", everyTicks: 18,
      text: (_s, r) => `POST /v1/charges 200 ${150 + r.int(60)}ms` },
  ],

  alerts: [
    { id: "checkout_5xx", serviceId: "edge", severity: "crit", title: "CheckoutErrorRate", description: "Checkout 5xx above 1% at the gateway", when: (s) => errorRateBp(s) >= 100 },
    { id: "pg_connections", serviceId: "postgres", severity: "crit", title: "PostgresConnectionsHigh", description: "Postgres connections above 95", when: (s) => dbConns(s) >= 95 },
    { id: "checkout_latency", serviceId: "checkout", severity: "warn", title: "CheckoutLatencyP99", description: "checkout-api p99 above 2 s", when: (s) => s.pool >= 91_000 },
  ],

  actions: [
    { id: "edge.error_log", label: "Read gateway error log", serviceId: "edge", category: "investigate", durationS: 3, verdict: "useful",
      reveals: () => [`nginx: every 5xx in the last 5 min is an upstream timeout from checkout-api:8080`] },
    { id: "edge.add_workers", label: "Add gateway workers", serviceId: "edge", category: "mitigate", durationS: 10, verdict: "wasted",
      reveals: () => ["gateway workers 8 → 16; upstream timeouts unchanged"] },
    { id: "checkout.pool_stats", label: "Check connection pool", serviceId: "checkout", category: "investigate", durationS: 4, verdict: "useful",
      reveals: (s) => [`pool: ${inUse(s)} of 100 in use, ${100 - inUse(s)} idle; oldest connection checked out 52 min ago, idle in transaction`] },
    { id: "checkout.deploys", label: "View recent deploys", serviceId: "checkout", category: "investigate", durationS: 3, verdict: "useful",
      reveals: () => [`v142 by dimas, 52 min ago: "checkout refactor: move tx handling to middleware"; v141 ran 6 days without issues`] },
    { id: "checkout.restart", label: "Restart pods", serviceId: "checkout", category: "mitigate", durationS: 15, verdict: "harmful", sideEffectBp: 5000,
      effect: (s) => ({ ...s, pool: 40_000, restarts: s.restarts + 1 }),
      reveals: () => ["rolling restart done: 3 of 3 pods ready, pool reset"] },
    { id: "checkout.rollback", label: "Roll back to v141", serviceId: "checkout", category: "fix", durationS: 30, verdict: "useful",
      available: (s) => s.rolledBack === 0,
      effect: (s) => ({ ...s, rolledBack: 1, leak: 0, pool: 30_000 }),
      reveals: () => ["rollback to v141 complete: 3 of 3 pods ready"] },
    { id: "postgres.connections", label: "Inspect active connections", serviceId: "postgres", category: "investigate", durationS: 3, verdict: "useful",
      reveals: (s) => [`pg_stat_activity: ${dbConns(s)} connections; ${inUse(s)} from checkout-api, ${Math.max(0, inUse(s) - 6)} of them idle in transaction`] },
    { id: "postgres.raise_max_conns", label: "Raise max_connections", serviceId: "postgres", category: "fix", durationS: 20, verdict: "harmful", sideEffectBp: 2000,
      available: (s) => s.dbMaxConns === 120,
      effect: (s) => ({ ...s, dbMaxConns: 200 }),
      reveals: () => ["postgres restarted with max_connections = 200"] },
    { id: "postgres.failover", label: "Fail over to replica", serviceId: "postgres", category: "mitigate", durationS: 30, verdict: "harmful", sideEffectBp: 3000,
      effect: (s) => ({ ...s, pool: 40_000, failovers: s.failovers + 1 }),
      reveals: () => ["failover complete: replica promoted, clients reconnected"] },
    { id: "payments.status", label: "Check provider status", serviceId: "payments", category: "investigate", durationS: 3, verdict: "wasted",
      reveals: () => ["payments provider: all systems operational, p99 182 ms"] },
    { id: "global.status_update", label: "Post status update", serviceId: null, category: "communicate", durationS: 5, verdict: "useful",
      available: (s) => s.statusPosted === 0,
      effect: (s) => ({ ...s, statusPosted: 1 }),
      reveals: () => [`status page: "Investigating elevated checkout errors"`] },
    { id: "global.ask_secondary", label: "Ask secondary on-call", serviceId: null, category: "communicate", durationS: 10, verdict: "useful",
      reveals: () => [`Maya (secondary): "Dimas shipped v142 about an hour ago. Could that be it?"`] },
  ],
  rootCauseActionIds: ["checkout.rollback"],

  coldOpen: {
    scene: "cafe",
    symptom: { kind: "http_502", surface: "checkout" },
    page: { severity: "SEV2", title: "Checkout returning 5xx", body: "Checkout requests for {brand} are failing at the gateway. You are the primary on-call." },
    hotspots: {
      "laptop.slack.deploys": { kind: "clue", label: "Laptop: Slack #deploys", text: "Dimas: shipping the checkout refactor (v142), heading home" },
      "laptop.slack.infra": { kind: "herring", label: "Laptop: Slack #infra", text: "Reminder: DB maintenance window tomorrow at 02:00 UTC" },
      "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} checkout just errors out??", appearsAt: "incident_start" },
      "table.neighbours": { kind: "clue", label: "The next table", text: "Their site keeps giving me some gateway error." },
      "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand} FLASH SALE 50% today" },
    },
  },

  lessons: [
    { id: "dnf", when: (r) => r.outcome === "dnf",
      text: "The pool had been leaking since v142 shipped. Postgres was loud, but its CPU stayed calm: the database was a victim, not the cause. When symptoms start after a deploy, roll it back first." },
    { id: "slow-ack", when: (r) => r.ackTick !== null && r.ackTick > 300,
      text: "Acknowledging took more than 30 seconds. A fast ack tells the team someone is on it and stops the page from escalating." },
    { id: "restart-trap", when: (r) => r.actions.some((a) => a.actionId === "checkout.restart" || a.actionId === "postgres.failover"),
      text: "Restarts buy time, not a fix. The pool drained, then v142 leaked it again. Roll back the bad deploy instead of cycling what it broke." },
    { id: "default", when: () => true,
      text: "Loud is not the same as guilty. Postgres raised the most alarms, but checkout-api was holding the connections. Checking recent deploys early is the fastest way to the cause." },
  ],
});
```

`packages/scenarios/src/index.ts`:
```ts
import type { ScenarioDef, State } from "@pitwall/engine";
import { slowLeak } from "./slow-leak";

export { slowLeak };

export const SCENARIOS: readonly ScenarioDef<State>[] = [slowLeak];

export function getScenario(id: string): ScenarioDef<State> | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @pitwall/scenarios test`
Expected: PASS (7 golden + 5 content tests). If the per-seed par test fails, print the worst seed's `budgetBurnedBp` and raise `parBp` to the worst perfect score rounded up to the next 50, with a ledger ruling; the perfect script is the definition of good play and does not change.

- [ ] **Step 5: Amend the cold-open spec (decision P5)**

In `docs/specs/2026-09-28-cold-open-design.md` §5, change "Each scenario must have **1–2 clues and 1–2 herrings**." to "Each scenario must have **1–3 clues and 1–2 herrings**."

- [ ] **Step 6: Typecheck, lint, commit**

Run: `pnpm typecheck && pnpm lint`. Expected: clean.
```bash
git add packages/scenarios docs/specs/2026-09-28-cold-open-design.md pnpm-lock.yaml
git commit -m "feat(scenarios): The Slow Leak with golden players and cold-open clues"
```

---

### Task 5: DESIGN.md, design tokens, fonts and theme

**Files:**
- Create: `docs/DESIGN.md`, `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`, `apps/web/src/theme.ts`, `apps/web/src/theme.test.ts`, `apps/web/src/ThemeToggle.tsx`
- Modify: `apps/web/package.json` (fonts, workspace packages), `apps/web/src/main.tsx`, `apps/web/index.html`

**Interfaces:**
- Produces: `type Theme = "dark" | "light"`, `readStoredTheme(): Theme`, `currentTheme(): Theme`, `applyTheme(t: Theme): void`, `<ThemeToggle />`. CSS classes used by every later task: `.btn`, `.btn.primary`, `.btn-lg`, `.tag.{crit,warn,ok,info}`, `.seg`, `.panel`, `.ph`, `.pb`, `.pf`, `.empty`, `.hint`, `.overlay`, `.card`, `.wordmark`, `.mono`, `.muted`, `.visually-hidden`.

- [ ] **Step 1: Write `docs/DESIGN.md`**

````markdown
# Pit Wall On-Call: Design System

- **Status:** v1, 2026-09-28. Source of truth for every UI task (roadmap: "UI quality bar").
- **Direction:** decision D14, "variant 1": a neutral observability console. IBM Plex, Grafana-like slate, one blue accent. Dark is the default, with a light theme.
- **Not this:** no motorsport or F1 theming, no emoji, no decorative icons, no gradients or glow. The product name is only a name.

## 1. Principles

1. **It should feel like a real tool.** Players should recognize an incident console they could use at work. Anything decorative has to earn its place as information.
2. **Status is always text.** Every state has a word: `Crit`, `Warn`, `Healthy`, `Degraded`, `Critical`, `Resolved`. Color adds to the word and never replaces it, so the UI is colorblind-safe.
3. **Density with hierarchy.** The console is dense. Each panel has one job, and panels line up on a 12 px grid.
4. **Nothing is unexplained.** A disabled control has a visible reason nearby, and an empty panel says why it is empty.

## 2. Color tokens

Tokens live in `apps/web/src/styles/tokens.css`. Components use tokens only, never raw hex values.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#111217` | `#f4f5f7` | Page background |
| `--panel` | `#181b1f` | `#ffffff` | Panels and cards |
| `--raised` | `#1f2329` | `#f8f9fb` | Buttons, map nodes |
| `--sunken` | `#0d0e12` | `#eef0f3` | Meters, inputs, kbd |
| `--border` | `#2a2f36` | `#dce0e5` | Panel borders, dividers |
| `--border-strong` | `#3a414b` | `#c3c9d1` | Control borders, edges |
| `--text` | `#d8dee9` | `#1f2329` | Primary text |
| `--muted` | `#8e97a5` | `#5a6270` | Secondary text, timestamps, labels |
| `--faint` | `#5f6875` | `#8a929e` | Non-text only (disabled strokes, grid lines) |
| `--accent` | `#3d71d9` | `#2f5fc4` | Primary action, selection, focus ring |
| `--accent-hover` | `#4f82e6` | `#264fa6` | Primary hover |
| `--accent-soft` | 16% accent | 10% accent | Selected chips, info tags |
| `--accent-text` | `#8ab4ff` | `#2f5fc4` | Accent-colored text |
| `--crit` | `#f2495c` | `#c9283b` | Critical status |
| `--warn` | `#ff9830` | `#b85c12` | Warning status |
| `--ok` | `#73bf69` | `#2a7d34` | Healthy and resolved |
| `--info` | `#5cc8ff` | `#0a73a8` | Informational log level |

Each status color has a `-soft` background (about 12% alpha) for tags. The light `--ok` is darkened from the prototype's `#2f8a3a` so tag text reaches 4.5:1.

**Contrast rule:** body text and timestamps use `--text` or `--muted` (at least 4.5:1 on `--bg` and `--panel` in both themes). `--faint` is never used for text.

## 3. Typography

- **Sans:** IBM Plex Sans 400/500/600, for UI text. **Mono:** IBM Plex Mono 400/500, for numbers, clocks, logs and values. Both are self-hosted through `@fontsource` (no third-party font requests).
- Every number that changes over time uses `font-variant-numeric: tabular-nums`, so digits don't jitter.

| Token | Size | Use |
|---|---|---|
| `--fs-xs` | 11px | Panel headers (uppercase, 0.06em tracking), tags, hints |
| `--fs-sm` | 12px | Buttons, log lines |
| `--fs` | 13px | Console body text |
| `--fs-md` | 15px | Landing and debrief body, large buttons |
| `--fs-lg` | 20px | Card titles |
| `--fs-xl` | 28px | Clock, metric values, debrief tiles |
| `--fs-2xl` | 40px | Landing and debrief headlines |

Copy is sentence case. Panel headers are the only uppercase text.

## 4. Space, radius, layout

- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px (`--space-1` … `--space-7`). The console gap is 12 px.
- Radius: 8 px for panels and cards, 6 px for buttons, 4 px for tags and kbd.
- **Console (≥1024 px):** a 56 px top bar; three columns (280 px alerts and notes · flexible map and metrics · 320 px actions); a 220 px log stream at the bottom. Nothing scrolls the page; panels scroll inside themselves.
- **Landing and debrief:** single column, max 880 px, 16 px side gutters, no horizontal scroll at 375 px.
- Below 1024 px, the console is not offered. The landing explains why in plain text instead of hiding the start button without a reason.

## 5. Components and states

Every interactive component covers: default, hover, pressed (`:active` moves it down 1 px), focus-visible (2 px accent outline, 2 px offset), disabled (42% opacity, `not-allowed` cursor, with the reason shown nearby), and, where relevant, selected or running.

| Component | Notes |
|---|---|
| Button | `.btn` secondary, `.btn.primary` for the single most important action on a screen, `.btn-lg` on landing and debrief. |
| Tag | `.tag.crit / .warn / .ok / .info`: 11px, 600 weight, uppercase, always a word. |
| Segmented control | `.seg` for the theme switch; `aria-pressed` marks the active option. |
| Panel | `.panel` with `.ph` (header), `.pb` (scrolling body), `.pf` (footer). |
| Service node | An HTML button over an SVG edge layer. Shows name, detail, a health word and its number key. Selected nodes get an accent border and `aria-pressed="true"`. |
| Metric panel | Label, current value (mono, 28px, colored at warn and crit thresholds and tagged), and a 2-minute sparkline with dashed threshold lines. |
| Action button | Label plus its duration. While running it shows a 2 px progress bar, and the panel shows "Running: <action> · N s left". |
| Log line | Time · level · service · message, all mono. Findings from the player's own actions are highlighted and labeled `FOUND`. |
| Budget meter | 6 px bar with marks at 50% and 80%. The value is text next to it. |
| Overlay | Pause and error states: a scrim, a centered card, focus on its primary button. |

## 6. Keyboard

| Key | Where | Action |
|---|---|---|
| `A` | Page | Acknowledge |
| `1`–`9` | Console | Select a service (in map order) |
| `Esc` | Console | Clear the log filter |
| `P` | Page and console | Pause or resume |
| `Tab` / `Enter` | Everywhere | Every control is a real button or link |

Shortcuts ignore key presses with Ctrl, Cmd or Alt held, and are shown as `<kbd>` hints next to their controls.

## 7. Motion

- Motion is functional only: 120 ms hover and press transitions, a progress bar on running actions, and a dashed flow on edges into a critical service.
- `prefers-reduced-motion: reduce` turns off all transitions and animations. Nothing in the game depends on motion.

## 8. Accessibility checklist (per UI task)

- Every control can be reached and used with the keyboard, with a visible focus ring.
- Status is conveyed by text, not color alone.
- The alert feed is an `aria-live="polite"` region. The page card is an `alertdialog`. The pause and error cards are dialogs whose primary button gets focus.
- Every state is designed: empty (no alerts, no logs, nothing noted), running, paused, resolved, DNF and error.
````

- [ ] **Step 2: Add dependencies**

Run:
```bash
pnpm --filter @pitwall/web add @pitwall/engine@workspace:* @pitwall/scenarios@workspace:* @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
```
Expected: `apps/web/package.json` lists the four dependencies; the lockfile updates.

- [ ] **Step 3: Write the failing theme tests**

`apps/web/src/theme.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, currentTheme, readStoredTheme } from "./theme";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme", () => {
  it("defaults to dark when nothing is stored", () => {
    expect(readStoredTheme()).toBe("dark");
  });

  it("applies the theme to <html> and remembers it", () => {
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(currentTheme()).toBe("light");
    expect(readStoredTheme()).toBe("light");
  });

  it("still works when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredTheme()).toBe("dark");
    expect(() => applyTheme("light")).not.toThrow();
    expect(currentTheme()).toBe("light");
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem("pitwall.theme", "sepia");
    expect(readStoredTheme()).toBe("dark");
  });
});
```

Run: `pnpm --filter @pitwall/web test`
Expected: FAIL, `Failed to resolve import "./theme"`.

- [ ] **Step 4: Implement theme, toggle, tokens and base styles**

`apps/web/src/theme.ts`:
```ts
export type Theme = "dark" | "light";

const KEY = "pitwall.theme";

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked (private mode, policy): the theme lasts for this visit only.
  }
}
```

`apps/web/src/ThemeToggle.tsx`:
```tsx
import { useState } from "react";
import { applyTheme, currentTheme, type Theme } from "./theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const choose = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };
  return (
    <div className="seg" role="group" aria-label="Theme">
      <button type="button" aria-pressed={theme === "dark"} onClick={() => choose("dark")}>Dark</button>
      <button type="button" aria-pressed={theme === "light"} onClick={() => choose("light")}>Light</button>
    </div>
  );
}
```

`apps/web/src/styles/tokens.css`:
```css
:root,
[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111217;
  --panel: #181b1f;
  --raised: #1f2329;
  --sunken: #0d0e12;
  --border: #2a2f36;
  --border-strong: #3a414b;
  --text: #d8dee9;
  --muted: #8e97a5;
  --faint: #5f6875;
  --accent: #3d71d9;
  --accent-hover: #4f82e6;
  --accent-soft: rgba(61, 113, 217, 0.16);
  --accent-text: #8ab4ff;
  --on-accent: #ffffff;
  --crit: #f2495c;
  --warn: #ff9830;
  --ok: #73bf69;
  --info: #5cc8ff;
  --crit-soft: rgba(242, 73, 92, 0.12);
  --warn-soft: rgba(255, 152, 48, 0.12);
  --ok-soft: rgba(115, 191, 105, 0.12);
  --info-soft: rgba(92, 200, 255, 0.12);
  --scrim: rgba(5, 6, 8, 0.72);
}

[data-theme="light"] {
  color-scheme: light;
  --bg: #f4f5f7;
  --panel: #ffffff;
  --raised: #f8f9fb;
  --sunken: #eef0f3;
  --border: #dce0e5;
  --border-strong: #c3c9d1;
  --text: #1f2329;
  --muted: #5a6270;
  --faint: #8a929e;
  --accent: #2f5fc4;
  --accent-hover: #264fa6;
  --accent-soft: rgba(47, 95, 196, 0.1);
  --accent-text: #2f5fc4;
  --on-accent: #ffffff;
  --crit: #c9283b;
  --warn: #b85c12;
  --ok: #2a7d34;
  --info: #0a73a8;
  --crit-soft: rgba(201, 40, 59, 0.08);
  --warn-soft: rgba(184, 92, 18, 0.1);
  --ok-soft: rgba(42, 125, 52, 0.1);
  --info-soft: rgba(10, 115, 168, 0.1);
  --scrim: rgba(31, 35, 41, 0.45);
}

:root {
  --font: "IBM Plex Sans", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
  --fs-xs: 11px;
  --fs-sm: 12px;
  --fs: 13px;
  --fs-md: 15px;
  --fs-lg: 20px;
  --fs-xl: 28px;
  --fs-2xl: 40px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --radius: 8px;
  --radius-md: 6px;
  --radius-sm: 4px;
  --gap: 12px;
}
```

`apps/web/src/styles/base.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font: 400 var(--fs) / 1.45 var(--font);
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, p, ul, ol, dl, dd { margin: 0; }
ul, ol { padding: 0; list-style: none; }
button { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.wordmark { font-weight: 600; letter-spacing: 0.01em; white-space: nowrap; }
.empty { color: var(--muted); }
.hint { color: var(--muted); font-size: var(--fs-xs); font-weight: 400; text-transform: none; letter-spacing: 0; }

kbd {
  font: 500 var(--fs-xs) var(--mono);
  padding: 0 5px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--sunken);
  color: var(--muted);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font: 500 var(--fs-sm) var(--font);
  padding: 7px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--raised);
  color: var(--text);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, transform 0.06s;
}
.btn:hover { border-color: var(--muted); }
.btn:active { transform: translateY(1px); background: var(--sunken); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn.primary kbd { background: transparent; border-color: rgba(255, 255, 255, 0.45); color: inherit; }
.btn:disabled { opacity: 0.42; cursor: not-allowed; transform: none; }
.btn:disabled:hover { border-color: var(--border-strong); }
.btn.primary:disabled:hover { background: var(--accent); border-color: var(--accent); }
.btn-lg { font-size: var(--fs-md); padding: 11px 20px; }

.tag {
  display: inline-block;
  font: 600 var(--fs-xs) / 1.5 var(--font);
  letter-spacing: 0.04em;
  padding: 0 6px;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  white-space: nowrap;
}
.tag.crit { background: var(--crit-soft); color: var(--crit); }
.tag.warn { background: var(--warn-soft); color: var(--warn); }
.tag.ok { background: var(--ok-soft); color: var(--ok); }
.tag.info { background: var(--accent-soft); color: var(--accent-text); }

.seg { display: inline-flex; border: 1px solid var(--border-strong); border-radius: var(--radius-md); overflow: hidden; }
.seg button { font: 500 var(--fs-sm) var(--font); background: transparent; border: 0; color: var(--muted); padding: 6px 10px; cursor: pointer; }
.seg button:hover { color: var(--text); }
.seg button[aria-pressed="true"] { background: var(--accent-soft); color: var(--accent-text); }

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.ph {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 10px var(--space-3);
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.ph h2, .ph h3 { font: inherit; }
.pb { padding: var(--space-2) var(--space-3) var(--space-3); overflow: auto; min-height: 0; flex: 1; }
.pf { padding: var(--space-3); border-top: 1px solid var(--border); }

.overlay { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: var(--space-4); background: var(--scrim); }
.card {
  width: 100%;
  max-width: 460px;
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.card h2 { font-size: var(--fs-lg); font-weight: 600; }
.card p { color: var(--muted); font-size: var(--fs-md); }
.card .btn { justify-self: start; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0s !important; animation: none !important; }
}
```

`apps/web/src/main.tsx`:
```tsx
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/tokens.css";
import "./styles/base.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, readStoredTheme } from "./theme";

applyTheme(readStoredTheme());

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

In `apps/web/index.html`, set `<html lang="en" data-theme="dark">` and add `<meta name="description" content="A browser game about being on call: acknowledge the page, find the cause, protect the error budget." />` and `<meta name="color-scheme" content="dark light" />`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @pitwall/web test`
Expected: PASS (theme tests plus the existing App and api tests). `pnpm --filter @pitwall/web build` succeeds and `dist/assets` contains `.woff2` files.

- [ ] **Step 6: Commit**

```bash
git add docs/DESIGN.md apps/web pnpm-lock.yaml
git commit -m "feat(web): DESIGN.md, variant 1 tokens, self-hosted Plex fonts and theme toggle"
```

---

### Task 6: Game plumbing: formatting, tick driver, metric history, run loop

**Files:**
- Create: `apps/web/src/game/format.ts`, `clock.ts`, `history.ts`, `brand.ts`, `useRunLoop.ts` and tests `format.test.ts`, `clock.test.ts`, `history.test.ts`, `brand.test.ts`, `useRunLoop.test.tsx`

**Interfaces:**
- Consumes: `@pitwall/engine` (`Run`, `Snapshot`, `RunResult`, `TICK_MS`, `TICKS_PER_SECOND`, `ACK`), `@pitwall/scenarios` (`slowLeak`).
- Produces:
  - `formatClock(ticks: number): string` ("mm:ss"), `formatBp(bp: number): string` ("18.3%"), `formatMetric(v: number): string`
  - `class TickDriver { constructor(now: () => number, maxTicksPerCall = 50); start(); pause(); resume(); due(): number }`
  - `class MetricHistory { constructor(size = 120); record(tick, metrics); snapshot(): Record<string, number[]> }`
  - `brandFor(seed: number): string`, `fillBrand(text: string, brand: string): string`
  - `useRunLoop(run: Run<State>, opts: { active: boolean; onFinish(r: RunResult): void; now?: () => number; intervalMs?: number }): { snapshot: Snapshot; history: Record<string, number[]>; paused: boolean; pause(): void; resume(): void; refresh(): void }`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/game/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatBp, formatClock, formatMetric } from "./format";

describe("format", () => {
  it("formats ticks as mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(615)).toBe("01:01");
    expect(formatClock(4800)).toBe("08:00");
  });

  it("formats basis points as a percentage with one decimal", () => {
    expect(formatBp(0)).toBe("0.0%");
    expect(formatBp(1834)).toBe("18.3%");
    expect(formatBp(12000)).toBe("120.0%");
  });

  it("formats metric values by magnitude", () => {
    expect(formatMetric(3.14159)).toBe("3.1");
    expect(formatMetric(97.6)).toBe("97.6");
    expect(formatMetric(2143.7)).toBe("2144");
  });
});
```

`apps/web/src/game/clock.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { TickDriver } from "./clock";

const fakeClock = () => {
  let t = 1000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("TickDriver", () => {
  it("returns whole ticks and carries the remainder", () => {
    const c = fakeClock();
    const d = new TickDriver(c.now);
    d.start();
    c.advance(250);
    expect(d.due()).toBe(2);
    c.advance(60);
    expect(d.due()).toBe(1);
    c.advance(89);
    expect(d.due()).toBe(0);
    c.advance(1);
    expect(d.due()).toBe(1);
  });

  it("returns nothing before start", () => {
    const c = fakeClock();
    const d = new TickDriver(c.now);
    c.advance(500);
    expect(d.due()).toBe(0);
  });

  it("stops the clock while paused and keeps the partial tick", () => {
    const c = fakeClock();
    const d = new TickDriver(c.now);
    d.start();
    c.advance(40);
    d.pause();
    c.advance(60_000);
    expect(d.due()).toBe(0);
    d.resume();
    c.advance(60);
    expect(d.due()).toBe(1);
  });

  it("caps each call and catches up on the next ones", () => {
    const c = fakeClock();
    const d = new TickDriver(c.now, 50);
    d.start();
    c.advance(8000);
    expect(d.due()).toBe(50);
    expect(d.due()).toBe(30);
    expect(d.due()).toBe(0);
  });
});
```

`apps/web/src/game/history.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MetricHistory } from "./history";

describe("MetricHistory", () => {
  it("records at most one sample per game second", () => {
    const h = new MetricHistory();
    h.record(0, { a: 1 });
    h.record(5, { a: 2 });
    h.record(10, { a: 3 });
    expect(h.snapshot()).toEqual({ a: [1, 3] });
  });

  it("keeps only the newest samples", () => {
    const h = new MetricHistory(3);
    for (let s = 0; s < 5; s++) h.record(s * 10, { a: s });
    expect(h.snapshot().a).toEqual([2, 3, 4]);
  });

  it("returns copies", () => {
    const h = new MetricHistory();
    h.record(0, { a: 1 });
    h.snapshot().a!.push(99);
    expect(h.snapshot().a).toEqual([1]);
  });
});
```

`apps/web/src/game/brand.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { brandFor, fillBrand } from "./brand";

describe("brand", () => {
  it("picks a stable brand per seed", () => {
    expect(brandFor(4)).toBe(brandFor(4));
    expect(new Set([0, 1, 2].map(brandFor)).size).toBe(3);
  });

  it("handles seeds above 2^31", () => {
    expect(typeof brandFor(0xffffffff)).toBe("string");
  });

  it("fills every {brand} placeholder", () => {
    expect(fillBrand("{brand} sale at {brand}", "Northbound")).toBe("Northbound sale at Northbound");
  });
});
```

`apps/web/src/game/useRunLoop.test.tsx`:
```tsx
import { ACK, Run, type State } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRunLoop } from "./useRunLoop";

const now = () => Date.now();
const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setHidden(false);
});

describe("useRunLoop", () => {
  it("does not tick while inactive", () => {
    const run = new Run<State>(slowLeak, 1);
    const { result } = renderHook(() => useRunLoop(run, { active: false, onFinish: vi.fn(), now }));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.snapshot.tick).toBe(0);
  });

  it("advances 10 ticks per real second", () => {
    const run = new Run<State>(slowLeak, 1);
    const { result } = renderHook(() => useRunLoop(run, { active: true, onFinish: vi.fn(), now }));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.snapshot.tick).toBe(10);
    expect(result.current.history["checkout.pool"]!.length).toBeGreaterThanOrEqual(2);
  });

  it("pauses when the tab is hidden and loses no time on resume", () => {
    const run = new Run<State>(slowLeak, 1);
    const { result } = renderHook(() => useRunLoop(run, { active: true, onFinish: vi.fn(), now }));
    act(() => vi.advanceTimersByTime(500));
    act(() => setHidden(true));
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.paused).toBe(true);
    expect(result.current.snapshot.tick).toBe(5);
    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.paused).toBe(false);
    expect(result.current.snapshot.tick).toBe(10);
  });

  it("reports the result once when the run ends", () => {
    const run = new Run<State>(slowLeak, 1);
    run.dispatch(ACK);
    run.dispatch("checkout.rollback");
    const onFinish = vi.fn();
    renderHook(() => useRunLoop(run, { active: true, onFinish, now }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0].outcome).toBe("resolved");
  });

  it("refresh() shows a dispatched action immediately", () => {
    const run = new Run<State>(slowLeak, 1);
    const { result } = renderHook(() => useRunLoop(run, { active: true, onFinish: vi.fn(), now }));
    run.dispatch(ACK);
    act(() => result.current.refresh());
    expect(result.current.snapshot.acked).toBe(true);
  });
});
```

Run: `pnpm --filter @pitwall/web test`
Expected: FAIL, unresolved imports for `./format`, `./clock`, `./history`, `./brand`, `./useRunLoop`.

- [ ] **Step 2: Implement**

`apps/web/src/game/format.ts`:
```ts
import { TICKS_PER_SECOND } from "@pitwall/engine";

const pad = (n: number) => String(n).padStart(2, "0");

export function formatClock(ticks: number): string {
  const seconds = Math.floor(ticks / TICKS_PER_SECOND);
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

export function formatBp(bp: number): string {
  return `${(bp / 100).toFixed(1)}%`;
}

export function formatMetric(value: number): string {
  return Math.abs(value) >= 100 ? String(Math.round(value)) : value.toFixed(1);
}
```

`apps/web/src/game/clock.ts`:
```ts
import { TICK_MS } from "@pitwall/engine";

/** Turns wall-clock time into whole engine ticks. Game time only moves while running. */
export class TickDriver {
  private last: number | null = null;
  private carry = 0;
  private readonly now: () => number;
  private readonly maxTicksPerCall: number;

  constructor(now: () => number, maxTicksPerCall = 50) {
    this.now = now;
    this.maxTicksPerCall = maxTicksPerCall;
  }

  start(): void {
    this.last = this.now();
    this.carry = 0;
  }

  pause(): void {
    if (this.last === null) return;
    this.carry += this.now() - this.last;
    this.last = null;
  }

  resume(): void {
    if (this.last === null) this.last = this.now();
  }

  /** Whole ticks elapsed since the previous call. The remainder carries over. */
  due(): number {
    if (this.last !== null) {
      const t = this.now();
      this.carry += t - this.last;
      this.last = t;
    }
    const ticks = Math.min(this.maxTicksPerCall, Math.floor(this.carry / TICK_MS));
    this.carry -= ticks * TICK_MS;
    return ticks;
  }
}
```

Note: `due()` while paused still drains carried whole ticks (the capped backlog), but a partial tick banked by `pause()` stays below one tick, so pausing never produces a tick on its own.

`apps/web/src/game/history.ts`:
```ts
import { TICKS_PER_SECOND } from "@pitwall/engine";

/** Last N one-second samples of every metric, for the sparklines. */
export class MetricHistory {
  private readonly series = new Map<string, number[]>();
  private lastSecond = -1;
  private readonly size: number;

  constructor(size = 120) {
    this.size = size;
  }

  record(tick: number, metrics: Record<string, number>): void {
    const second = Math.floor(tick / TICKS_PER_SECOND);
    if (second === this.lastSecond) return;
    this.lastSecond = second;
    for (const [id, value] of Object.entries(metrics)) {
      const values = this.series.get(id) ?? [];
      values.push(value);
      if (values.length > this.size) values.shift();
      this.series.set(id, values);
    }
  }

  snapshot(): Record<string, number[]> {
    return Object.fromEntries([...this.series].map(([id, values]) => [id, [...values]]));
  }
}
```

`apps/web/src/game/brand.ts`:
```ts
/** M1 stand-in: M1.5 moves brand selection into resolveScene (decision P10). */
const BRANDS = ["Kettle & Co.", "Northbound", "Maison Loaf"] as const;

export function brandFor(seed: number): string {
  return BRANDS[(seed >>> 0) % BRANDS.length]!;
}

export function fillBrand(text: string, brand: string): string {
  return text.replaceAll("{brand}", brand);
}
```

`apps/web/src/game/useRunLoop.ts`:
```ts
import type { Run, RunResult, Snapshot, State } from "@pitwall/engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { TickDriver } from "./clock";
import { MetricHistory } from "./history";

export interface RunLoopOptions {
  active: boolean;
  onFinish: (result: RunResult) => void;
  now?: () => number;
  intervalMs?: number;
}

const defaultNow = () => performance.now();

/** Drives a Run in real time, pauses it when the tab is hidden, and exposes a render view. */
export function useRunLoop(run: Run<State>, { active, onFinish, now = defaultNow, intervalMs = 50 }: RunLoopOptions) {
  const [history] = useState(() => {
    const h = new MetricHistory();
    const snap = run.snapshot();
    h.record(snap.tick, snap.metrics);
    return h;
  });
  const [view, setView] = useState(() => ({ snapshot: run.snapshot(), history: history.snapshot() }));
  const [paused, setPaused] = useState(false);
  const driverRef = useRef<TickDriver | null>(null);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const refresh = useCallback(() => setView({ snapshot: run.snapshot(), history: history.snapshot() }), [run, history]);

  useEffect(() => {
    if (!active || run.outcome !== "running") return;
    const driver = new TickDriver(now);
    driver.start();
    driverRef.current = driver;

    const id = window.setInterval(() => {
      const due = driver.due();
      if (due === 0) return;
      for (let i = 0; i < due && run.outcome === "running"; i++) run.step();
      const snapshot = run.snapshot();
      history.record(snapshot.tick, snapshot.metrics);
      setView({ snapshot, history: history.snapshot() });
      if (run.outcome !== "running") {
        window.clearInterval(id);
        onFinishRef.current(run.result());
      }
    }, intervalMs);

    const onVisibility = () => {
      if (document.hidden) {
        driver.pause();
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      driverRef.current = null;
    };
  }, [active, run, history, now, intervalMs]);

  const pause = useCallback(() => {
    driverRef.current?.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    driverRef.current?.resume();
    setPaused(false);
  }, []);

  return { snapshot: view.snapshot, history: view.history, paused, pause, resume, refresh };
}
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pnpm --filter @pitwall/web test`
Expected: PASS. Then `pnpm --filter @pitwall/web typecheck` and `pnpm lint`: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/game
git commit -m "feat(web): real-time run loop with tab-hidden pause and metric history"
```

---

### Task 7: The incident console

**Files:**
- Create: `apps/web/src/console/Console.tsx`, `TopBar.tsx`, `AlertFeed.tsx`, `SceneNotes.tsx`, `ServiceMap.tsx`, `MetricPanel.tsx`, `ActionsPanel.tsx`, `LogStream.tsx`, `Console.test.tsx`, `apps/web/src/styles/console.css`
- Modify: `apps/web/src/main.tsx` (import `console.css`)

**Interfaces:**
- Consumes: engine types and `TICKS_PER_SECOND`; `formatClock`, `formatBp`, `formatMetric`, `fillBrand`; `ThemeToggle`.
- Produces: `<Console scenario snapshot logs history brand check onAction onPause />` where
  `scenario: ScenarioDef<State>`, `snapshot: Snapshot`, `logs: readonly LogEntry[]`, `history: Record<string, number[]>`, `brand: string`, `check(actionId: string): RejectReason | null`, `onAction(actionId: string): void`, `onPause(): void`.
  The console owns selection state: `selected` (defaults to the first service) and `filter` (null until the player selects a node; `Esc` clears it). `P` is handled by the parent (Task 10) so it also works while paused.

- [ ] **Step 1: Write the failing console tests**

`apps/web/src/console/Console.test.tsx`:
```tsx
import { ACK, Run, type State } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Console } from "./Console";

afterEach(cleanup);

function setup({ steps = 50, acked = true, inspect = [] as string[] } = {}) {
  const run = new Run<State>(slowLeak, 1);
  for (const id of inspect) run.dispatch(`inspect:${id}`);
  if (acked) run.dispatch(ACK);
  for (let i = 0; i < steps; i++) run.step();
  const onAction = vi.fn();
  const onPause = vi.fn();
  const view = () => (
    <Console
      scenario={slowLeak}
      snapshot={run.snapshot()}
      logs={run.logs}
      history={{}}
      brand="Northbound"
      check={(id) => run.check(id)}
      onAction={onAction}
      onPause={onPause}
    />
  );
  const utils = render(view());
  return { run, onAction, onPause, rerender: () => utils.rerender(view()) };
}

describe("Console", () => {
  it("shows the page title, the clock and the budget burned", () => {
    setup();
    expect(screen.getByText("Checkout returning 5xx")).toBeTruthy();
    expect(screen.getByLabelText("Incident time").textContent).toContain("00:05");
    expect(screen.getByRole("meter", { name: "Error budget burned" })).toBeTruthy();
  });

  it("lists firing alerts with a text severity", () => {
    setup();
    const alerts = screen.getByRole("region", { name: "Alerts" });
    expect(within(alerts).getByText("PostgresConnectionsHigh")).toBeTruthy();
    expect(within(alerts).getAllByText("Crit").length).toBeGreaterThan(0);
  });

  it("renders services as buttons that name their health", () => {
    setup();
    expect(screen.getByRole("button", { name: /postgres.*Critical/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /payments.*Healthy/ })).toBeTruthy();
  });

  it("selecting a node focuses metrics, actions and the log filter on it", () => {
    setup({ steps: 200 });
    fireEvent.click(screen.getByRole("button", { name: /^postgres/ }));
    expect(screen.getByRole("button", { name: /^postgres/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "postgres" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Inspect active connections/ })).toBeTruthy();
    expect(screen.getByLabelText("Connections metric")).toBeTruthy();
    const logs = screen.getByRole("region", { name: "Logs" });
    expect(within(logs).getByRole("button", { name: /Clear filter/ })).toBeTruthy();
    const services = within(logs).getAllByTestId("log-service").map((el) => el.textContent);
    expect(services.length).toBeGreaterThan(0);
    expect(services.every((s) => s === "postgres")).toBe(true);
  });

  it("number keys select services and Esc clears the log filter", () => {
    setup();
    fireEvent.keyDown(window, { key: "2" });
    expect(screen.getByRole("button", { name: /^checkout-api/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Clear filter/ })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: /Clear filter/ })).toBeNull();
    fireEvent.keyDown(window, { key: "3", ctrlKey: true });
    expect(screen.getByRole("button", { name: /^checkout-api/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("dispatches actions and shows the running one with its time left", () => {
    const { run, onAction, rerender } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^checkout-api/ }));
    fireEvent.click(screen.getByRole("button", { name: /Check connection pool/ }));
    expect(onAction).toHaveBeenCalledWith("checkout.pool_stats");
    run.dispatch("checkout.pool_stats");
    rerender();
    expect(screen.getByRole("status").textContent).toContain("Running: Check connection pool");
    expect((screen.getByRole("button", { name: /Roll back to v141/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("the pause button calls onPause", () => {
    const { onPause } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    expect(onPause).toHaveBeenCalled();
  });

  it("shows what the player noticed before the page, with the brand filled in", () => {
    setup({ inspect: ["wall.poster"] });
    expect(screen.getByText("Northbound FLASH SALE 50% today")).toBeTruthy();
  });

  it("explains empty states", () => {
    setup({ steps: 0 });
    expect(screen.getByText("You went straight to the page. Nothing noted.")).toBeTruthy();
    expect(screen.getByText("No log lines from any service yet.")).toBeTruthy();
  });
});
```

Run: `pnpm --filter @pitwall/web test`
Expected: FAIL, `Failed to resolve import "./Console"`.

- [ ] **Step 2: Implement the panels**

`apps/web/src/console/TopBar.tsx`:
```tsx
import { TICKS_PER_SECOND, type ScenarioDef, type Snapshot, type State } from "@pitwall/engine";
import { formatBp, formatClock } from "../game/format";
import { ThemeToggle } from "../ThemeToggle";

export function TopBar({ scenario, snapshot, onPause }: { scenario: ScenarioDef<State>; snapshot: Snapshot; onPause: () => void }) {
  const burned = snapshot.budgetBurnedBp;
  const level = burned >= 8000 ? "crit" : burned >= 5000 ? "warn" : "ok";
  const pct = Math.min(100, burned / 100);
  return (
    <header className="topbar">
      <span className="wordmark">Pit Wall On-Call</span>
      <span className="tag crit">{scenario.coldOpen.page.severity}</span>
      <div className="topbar-title">
        <b>{scenario.coldOpen.page.title}</b>
        <small>{scenario.title}</small>
      </div>
      <div className="spacer" />
      <div className="kv">
        <span className="k">Incident time</span>
        <span className="clock mono" aria-label="Incident time">
          {formatClock(snapshot.tick)}
          <small> / {formatClock(scenario.timeLimitS * TICKS_PER_SECOND)}</small>
        </span>
      </div>
      <div className="budget">
        <div className="budget-row">
          <span className="k">Error budget burned</span>
          <b className={`budget-value mono ${level}`}>{formatBp(burned)}</b>
        </div>
        <div className="meter" role="meter" aria-label="Error budget burned" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i className={level} style={{ width: `${pct}%` }} />
          <u style={{ left: "50%" }} />
          <u style={{ left: "80%" }} />
        </div>
      </div>
      <button type="button" className="btn" onClick={onPause}>
        Pause <kbd>P</kbd>
      </button>
      <ThemeToggle />
    </header>
  );
}
```

`apps/web/src/console/AlertFeed.tsx`:
```tsx
import type { AlertState, ScenarioDef, State } from "@pitwall/engine";
import { formatClock } from "../game/format";

export function AlertFeed({ scenario, alerts }: { scenario: ScenarioDef<State>; alerts: AlertState[] }) {
  const rules = new Map(scenario.alerts.map((a) => [a.id, a]));
  const firing = alerts.filter((a) => a.clearedAtTick === null).sort((a, b) => b.firedAtTick - a.firedAtTick);
  const cleared = alerts.filter((a) => a.clearedAtTick !== null).sort((a, b) => b.clearedAtTick! - a.clearedAtTick!);
  return (
    <section className="panel" aria-labelledby="alerts-h">
      <div className="ph">
        <h2 id="alerts-h">Alerts</h2>
        {firing.length > 0 && <span className="tag crit">{firing.length} firing</span>}
      </div>
      <div className="pb" aria-live="polite">
        {firing.length === 0 && <p className="empty">No alerts firing.</p>}
        <ul className="alert-list">
          {[...firing, ...cleared].map((a) => {
            const rule = rules.get(a.alertId)!;
            const resolved = a.clearedAtTick !== null;
            return (
              <li key={`${a.alertId}-${a.firedAtTick}`} className={resolved ? "alert resolved" : "alert"}>
                <div className="alert-h">
                  <span className={`tag ${resolved ? "ok" : rule.severity}`}>{resolved ? "Resolved" : rule.severity === "crit" ? "Crit" : "Warn"}</span>
                  <b>{rule.title}</b>
                </div>
                <time className="mono">{formatClock(resolved ? a.clearedAtTick! : a.firedAtTick)}</time>
                <span className="alert-d">{rule.description}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
```

`apps/web/src/console/SceneNotes.tsx`:
```tsx
import type { ScenarioDef, State } from "@pitwall/engine";
import { fillBrand } from "../game/brand";

/** Everything the player looked at before the console opened, clue or not (no spoilers). */
export function SceneNotes({ scenario, inspected, brand }: { scenario: ScenarioDef<State>; inspected: string[]; brand: string }) {
  return (
    <section className="panel notes" aria-labelledby="notes-h">
      <div className="ph">
        <h2 id="notes-h">What you noticed</h2>
      </div>
      <div className="pb">
        {inspected.length === 0 ? (
          <p className="empty">You went straight to the page. Nothing noted.</p>
        ) : (
          <ul className="note-list">
            {inspected.map((id) => {
              const hotspot = scenario.coldOpen.hotspots[id]!;
              return (
                <li key={id}>
                  <span className="note-src">{hotspot.label}</span>
                  <span>{fillBrand(hotspot.text, brand)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
```

`apps/web/src/console/ServiceMap.tsx`:
```tsx
import type { Health, ScenarioDef, State } from "@pitwall/engine";

export const HEALTH_LABEL: Record<Health, string> = { ok: "Healthy", warn: "Degraded", crit: "Critical" };

interface Props {
  scenario: ScenarioDef<State>;
  health: Record<string, Health>;
  details: Record<string, string>;
  selected: string;
  onSelect: (serviceId: string) => void;
}

export function ServiceMap({ scenario, health, details, selected, onSelect }: Props) {
  const byId = new Map(scenario.services.map((s) => [s.id, s]));
  return (
    <section className="panel map-panel" aria-labelledby="map-h">
      <div className="ph">
        <h2 id="map-h">Service map</h2>
        <span className="hint">Select a service or press 1–{scenario.services.length}</span>
      </div>
      <div className="map">
        <svg className="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {scenario.edges.map((e) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const hot = health[e.to] === "crit";
            return <line key={`${e.from}-${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={hot ? "edge hot" : "edge"} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        {scenario.services.map((svc, i) => {
          const h = health[svc.id] ?? "ok";
          const isSelected = svc.id === selected;
          return (
            <button
              key={svc.id}
              type="button"
              className={`node ${h}${isSelected ? " selected" : ""}`}
              style={{ left: `${svc.x}%`, top: `${svc.y}%` }}
              aria-pressed={isSelected}
              onClick={() => onSelect(svc.id)}
            >
              <span className="node-top">
                <span className="node-name">{svc.label}</span>
                <span className={`node-health ${h}`}>{HEALTH_LABEL[h]}</span>
              </span>
              <span className="node-detail mono">{details[svc.id]}</span>
              <kbd className="node-key" aria-hidden="true">{i + 1}</kbd>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

`apps/web/src/console/MetricPanel.tsx`:
```tsx
import type { MetricDef, State } from "@pitwall/engine";
import { formatMetric } from "../game/format";

const WIDTH = 120;
const HEIGHT = 40;
const WINDOW = 120;

function Sparkline({ values, max, warn, crit }: { values: number[]; max: number; warn?: number; crit?: number }) {
  const y = (v: number) => HEIGHT - (Math.max(0, Math.min(max, v)) / max) * HEIGHT;
  const step = WIDTH / (WINDOW - 1);
  const points = values.map((v, i) => `${WIDTH - (values.length - 1 - i) * step},${y(v)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      {warn !== undefined && <line className="thr warn" x1={0} x2={WIDTH} y1={y(warn)} y2={y(warn)} vectorEffect="non-scaling-stroke" />}
      {crit !== undefined && <line className="thr crit" x1={0} x2={WIDTH} y1={y(crit)} y2={y(crit)} vectorEffect="non-scaling-stroke" />}
      {values.length > 1 && <polyline className="line" points={points} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export function MetricPanel({ metric, value, history }: { metric: MetricDef<State>; value: number; history: number[] }) {
  const level = metric.crit !== undefined && value >= metric.crit ? "crit" : metric.warn !== undefined && value >= metric.warn ? "warn" : "ok";
  return (
    <section className="panel metric" aria-label={`${metric.label} metric`}>
      <div className="ph">
        <h3>{metric.label}</h3>
        {level !== "ok" && <span className={`tag ${level}`}>{level === "crit" ? "Crit" : "Warn"}</span>}
      </div>
      <div className="pb">
        <div className={`metric-value mono ${level}`}>
          {formatMetric(value)}
          <small>{metric.unit}</small>
        </div>
        <Sparkline values={history} max={metric.max} warn={metric.warn} crit={metric.crit} />
        <p className="hint">Last 2 minutes</p>
      </div>
    </section>
  );
}
```

`apps/web/src/console/ActionsPanel.tsx`:
```tsx
import { TICKS_PER_SECOND, type ActionCategory, type ActionDef, type RejectReason, type ScenarioDef, type ServiceDef, type Snapshot, type State } from "@pitwall/engine";
import { HEALTH_LABEL } from "./ServiceMap";

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  investigate: "Investigate",
  mitigate: "Mitigate",
  fix: "Fix",
  communicate: "Communicate",
};
const ORDER: ActionCategory[] = ["investigate", "mitigate", "fix", "communicate"];

interface Props {
  scenario: ScenarioDef<State>;
  service: ServiceDef<State>;
  snapshot: Snapshot;
  check: (actionId: string) => RejectReason | null;
  onAction: (actionId: string) => void;
}

export function ActionsPanel({ scenario, service, snapshot, check, onAction }: Props) {
  const local = scenario.actions.filter((a) => a.serviceId === service.id);
  const global = scenario.actions.filter((a) => a.serviceId === null);
  const busy = snapshot.busy;
  const busyDef = busy ? scenario.actions.find((a) => a.id === busy.actionId) : undefined;
  const health = snapshot.health[service.id] ?? "ok";

  const renderAction = (a: ActionDef<State>) => {
    const running = busy?.actionId === a.id;
    const progress = running && busy ? (snapshot.tick - busy.startTick) / (busy.endTick - busy.startTick) : 0;
    return (
      <li key={a.id}>
        <button type="button" className={`btn action${running ? " running" : ""}`} disabled={check(a.id) !== null} onClick={() => onAction(a.id)}>
          <span>{a.label}</span>
          <span className="action-d mono">{a.durationS} s</span>
          {running && <span className="action-progress" style={{ width: `${Math.round(progress * 100)}%` }} />}
        </button>
      </li>
    );
  };

  return (
    <section className="panel actions" aria-labelledby="actions-h">
      <div className="ph">
        <h2 id="actions-h">{service.label}</h2>
        <span className={`tag ${health}`}>{HEALTH_LABEL[health]}</span>
      </div>
      <div className="pb">
        {busy && busyDef && (
          <p className="busy" role="status">
            Running: {busyDef.label} · {Math.ceil((busy.endTick - snapshot.tick) / TICKS_PER_SECOND)} s left
          </p>
        )}
        {local.length === 0 && <p className="empty">No actions for this service.</p>}
        {ORDER.map((category) => {
          const items = local.filter((a) => a.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="action-group">
              <h3 className="group-h">{CATEGORY_LABEL[category]}</h3>
              <ul>{items.map(renderAction)}</ul>
            </div>
          );
        })}
      </div>
      <div className="pf">
        <h3 className="group-h">Global</h3>
        <ul>{global.map(renderAction)}</ul>
      </div>
    </section>
  );
}
```

`apps/web/src/console/LogStream.tsx`:
```tsx
import type { LogEntry, ScenarioDef, State } from "@pitwall/engine";
import { useLayoutEffect, useRef } from "react";
import { formatClock } from "../game/format";

const VISIBLE = 200;

interface Props {
  scenario: ScenarioDef<State>;
  logs: readonly LogEntry[];
  filter: string | null;
  onClearFilter: () => void;
}

export function LogStream({ scenario, logs, filter, onClearFilter }: Props) {
  const labels = new Map(scenario.services.map((s) => [s.id, s.label]));
  const visible = (filter ? logs.filter((l) => l.serviceId === filter || l.serviceId === "global") : logs).slice(-VISIBLE);
  const listRef = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  });

  return (
    <section className="panel logs" aria-labelledby="logs-h">
      <div className="ph">
        <h2 id="logs-h">Logs</h2>
        {filter ? (
          <button type="button" className="chip" onClick={onClearFilter}>
            Clear filter: {labels.get(filter)} <kbd>Esc</kbd>
          </button>
        ) : (
          <span className="hint">All services</span>
        )}
      </div>
      <ol
        className="log-lines mono"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {visible.length === 0 && <li className="empty">No log lines from {filter ? labels.get(filter) : "any service"} yet.</li>}
        {visible.map((l) => (
          <li key={l.seq} className={l.finding ? "ll finding" : "ll"}>
            <time>{formatClock(l.tick)}</time>
            <span className={`lvl ${l.finding ? "FOUND" : l.level}`}>{l.finding ? "FOUND" : l.level}</span>
            <span className="svc" data-testid="log-service">{labels.get(l.serviceId) ?? "you"}</span>
            <span className="msg">{l.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

Note on the filter test: postgres findings only exist after an action, and global findings only after a global action, so after 200 plain steps every visible line in the postgres filter is a postgres line.

`apps/web/src/console/Console.tsx`:
```tsx
import type { LogEntry, RejectReason, ScenarioDef, Snapshot, State } from "@pitwall/engine";
import { useCallback, useEffect, useState } from "react";
import { ActionsPanel } from "./ActionsPanel";
import { AlertFeed } from "./AlertFeed";
import { LogStream } from "./LogStream";
import { MetricPanel } from "./MetricPanel";
import { SceneNotes } from "./SceneNotes";
import { ServiceMap } from "./ServiceMap";
import { TopBar } from "./TopBar";

export interface ConsoleProps {
  scenario: ScenarioDef<State>;
  snapshot: Snapshot;
  logs: readonly LogEntry[];
  history: Record<string, number[]>;
  brand: string;
  check: (actionId: string) => RejectReason | null;
  onAction: (actionId: string) => void;
  onPause: () => void;
}

export function Console({ scenario, snapshot, logs, history, brand, check, onAction, onPause }: ConsoleProps) {
  const [selected, setSelected] = useState(scenario.services[0]!.id);
  const [filter, setFilter] = useState<string | null>(null);

  const select = useCallback((serviceId: string) => {
    setSelected(serviceId);
    setFilter(serviceId);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        setFilter(null);
        return;
      }
      const index = Number(e.key);
      const svc = Number.isInteger(index) && index > 0 ? scenario.services[index - 1] : undefined;
      if (svc) select(svc.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenario, select]);

  const service = scenario.services.find((s) => s.id === selected)!;
  const metrics = scenario.metrics.filter((m) => m.serviceId === selected).slice(0, 2);

  return (
    <div className="console">
      <TopBar scenario={scenario} snapshot={snapshot} onPause={onPause} />
      <main className="console-main">
        <div className="col col-left">
          <AlertFeed scenario={scenario} alerts={snapshot.alerts} />
          <SceneNotes scenario={scenario} inspected={snapshot.inspected} brand={brand} />
        </div>
        <div className="col col-center">
          <ServiceMap scenario={scenario} health={snapshot.health} details={snapshot.details} selected={selected} onSelect={select} />
          <div className="charts">
            {metrics.map((m) => (
              <MetricPanel key={m.id} metric={m} value={snapshot.metrics[m.id] ?? 0} history={history[m.id] ?? []} />
            ))}
          </div>
        </div>
        <div className="col col-right">
          <ActionsPanel scenario={scenario} service={service} snapshot={snapshot} check={check} onAction={onAction} />
        </div>
      </main>
      <LogStream scenario={scenario} logs={logs} filter={filter} onClearFilter={() => setFilter(null)} />
    </div>
  );
}
```

`apps/web/src/styles/console.css`:
```css
.console {
  display: grid;
  grid-template-rows: 56px minmax(0, 1fr) 220px;
  gap: var(--gap);
  height: 100vh;
  min-width: 1024px;
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.topbar-title { display: flex; align-items: baseline; gap: var(--space-2); min-width: 0; }
.topbar-title b { font-weight: 500; font-size: var(--fs-md); white-space: nowrap; }
.topbar-title small { color: var(--muted); font-size: var(--fs-sm); white-space: nowrap; }
.spacer { flex: 1; }
.kv { display: flex; flex-direction: column; }
.k { font-size: var(--fs-xs); color: var(--muted); }
.clock { font-size: 22px; font-weight: 500; line-height: 1.1; }
.clock small { font-size: var(--fs-sm); color: var(--muted); }
.budget { width: 200px; }
.budget-row { display: flex; justify-content: space-between; align-items: baseline; }
.budget-value { font-size: var(--fs); font-weight: 500; }
.budget-value.ok { color: var(--text); }
.budget-value.warn { color: var(--warn); }
.budget-value.crit { color: var(--crit); }
.meter { position: relative; height: 6px; margin-top: 4px; background: var(--sunken); border-radius: 3px; overflow: hidden; }
.meter i { position: absolute; inset: 0 auto 0 0; background: var(--accent); transition: width 0.4s; }
.meter i.warn { background: var(--warn); }
.meter i.crit { background: var(--crit); }
.meter u { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--border-strong); }

.console-main {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  gap: var(--gap);
  padding: 0 var(--gap);
  min-height: 0;
}
.col { display: grid; gap: var(--gap); min-height: 0; }
.col-left { grid-template-rows: minmax(0, 3fr) minmax(0, 2fr); }
.col-center { grid-template-rows: minmax(0, 1fr) 210px; }
.col-right { grid-template-rows: minmax(0, 1fr); }

.alert { display: grid; grid-template-columns: 1fr auto; gap: 2px var(--space-2); padding: var(--space-2) 0; border-bottom: 1px solid var(--border); }
.alert:last-child { border-bottom: 0; }
.alert-h { display: flex; gap: var(--space-2); align-items: center; min-width: 0; }
.alert-h b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
.alert time { font-size: var(--fs-sm); color: var(--muted); }
.alert-d { grid-column: 1 / -1; color: var(--muted); font-size: var(--fs-sm); }
.alert.resolved .alert-h b, .alert.resolved .alert-d { color: var(--muted); }

.note-list li { display: grid; gap: 2px; padding: var(--space-2) 0; border-bottom: 1px solid var(--border); }
.note-list li:last-child { border-bottom: 0; }
.note-src { font-size: var(--fs-xs); color: var(--muted); }

.map { position: relative; flex: 1; min-height: 0; margin: var(--space-3); }
.map-edges { position: absolute; inset: 0; width: 100%; height: 100%; }
.edge { stroke: var(--border-strong); stroke-width: 1.5; }
.edge.hot { stroke: var(--crit); stroke-dasharray: 5 4; animation: flow 1s linear infinite; }
@keyframes flow { to { stroke-dashoffset: -9; } }
.node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: grid;
  gap: 2px;
  min-width: 180px;
  padding: 10px 12px;
  text-align: left;
  background: var(--raised);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color 0.12s;
}
.node:hover { border-color: var(--muted); }
.node:active { background: var(--sunken); }
.node.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.node-top { display: flex; justify-content: space-between; gap: var(--space-3); }
.node-name { font-weight: 500; }
.node-health { font-size: var(--fs-xs); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.node-health.ok { color: var(--ok); }
.node-health.warn { color: var(--warn); }
.node-health.crit { color: var(--crit); }
.node-detail { font-size: var(--fs-xs); color: var(--muted); }
.node-key { position: absolute; top: -9px; left: -9px; }

.charts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); min-height: 0; }
.metric-value { font-size: var(--fs-xl); font-weight: 500; line-height: 1.1; }
.metric-value small { font: 400 var(--fs-sm) var(--font); color: var(--muted); margin-left: var(--space-1); }
.metric-value.warn { color: var(--warn); }
.metric-value.crit { color: var(--crit); }
.spark { display: block; width: 100%; height: 96px; margin: var(--space-2) 0 var(--space-1); }
.spark .line { fill: none; stroke: var(--accent-text); stroke-width: 1.5; }
.spark .thr { stroke-dasharray: 3 3; stroke-width: 1; }
.spark .thr.warn { stroke: var(--warn); }
.spark .thr.crit { stroke: var(--crit); }

.busy { margin-bottom: var(--space-2); padding: var(--space-2); border-radius: var(--radius-md); background: var(--accent-soft); color: var(--accent-text); font-size: var(--fs-sm); }
.group-h { margin: var(--space-3) 0 var(--space-2); font-size: var(--fs-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.pf .group-h { margin-top: 0; }
.action-group:first-of-type .group-h { margin-top: var(--space-1); }
.actions li + li { margin-top: 6px; }
.btn.action { position: relative; width: 100%; justify-content: space-between; overflow: hidden; text-align: left; }
.btn.action.running { border-color: var(--accent); opacity: 1; }
.action-d { font-size: var(--fs-xs); color: var(--muted); }
.action-progress { position: absolute; left: 0; bottom: 0; height: 2px; background: var(--accent); transition: width 0.1s linear; }

.logs { margin: 0 var(--gap) var(--gap); }
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: 500 var(--fs-sm) var(--font);
  text-transform: none;
  letter-spacing: 0;
  padding: 3px 10px;
  border-radius: 14px;
  border: 0;
  background: var(--accent-soft);
  color: var(--accent-text);
  cursor: pointer;
}
.log-lines { flex: 1; min-height: 0; overflow: auto; padding: var(--space-2) var(--space-3); font-size: var(--fs-sm); line-height: 1.7; }
.ll { display: grid; grid-template-columns: 48px 48px 110px minmax(0, 1fr); gap: var(--space-3); }
.ll time, .ll .svc { color: var(--muted); }
.ll .msg { overflow-wrap: anywhere; }
.lvl.INFO { color: var(--info); }
.lvl.WARN { color: var(--warn); }
.lvl.ERROR { color: var(--crit); }
.lvl.FOUND { color: var(--accent-text); font-weight: 500; }
.ll.finding { background: var(--accent-soft); border-radius: var(--radius-sm); }
```

Add `import "./styles/console.css";` to `main.tsx` after `base.css`.

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pnpm --filter @pitwall/web test`
Expected: PASS (all Console tests). Then `pnpm --filter @pitwall/web typecheck` and `pnpm lint`: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/console apps/web/src/styles/console.css apps/web/src/main.tsx
git commit -m "feat(web): incident console with service map, metrics, actions and logs"
```

---

### Task 8: Minimal cold open (pre-page, page, ack)

**Files:**
- Create: `apps/web/src/screens/ColdOpen.tsx`, `ColdOpen.test.tsx`, `apps/web/src/styles/screens.css` (cold-open section; Tasks 9–10 append theirs)
- Modify: `apps/web/src/main.tsx` (import `screens.css`)

**Interfaces:**
- Consumes: `ColdOpenDef`, `formatClock`, `fillBrand`.
- Produces: `<ColdOpen coldOpen brand phase ticks escalated onInspect onSkip onAck />` with `phase: "prepage" | "paging"`, `ticks: number`, `escalated: boolean`, `onInspect(hotspotId: string)`, `onSkip()`, `onAck()`. Each hotspot is inspected at most once (the first click); later clicks only toggle nothing.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/screens/ColdOpen.test.tsx`:
```tsx
import { slowLeak } from "@pitwall/scenarios";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColdOpen } from "./ColdOpen";

afterEach(cleanup);

const props = (over: Partial<Parameters<typeof ColdOpen>[0]> = {}) => ({
  coldOpen: slowLeak.coldOpen,
  brand: "Kettle & Co.",
  phase: "prepage" as const,
  ticks: 0,
  escalated: false,
  onInspect: vi.fn(),
  onSkip: vi.fn(),
  onAck: vi.fn(),
  ...over,
});

describe("ColdOpen", () => {
  it("before the page, lists the hotspots that already exist", () => {
    render(<ColdOpen {...props()} />);
    expect(screen.getByRole("button", { name: "Laptop: Slack #deploys" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Poster on the wall" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Phone: new mention" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Acknowledge/ })).toBeNull();
  });

  it("opening a hotspot reveals its text once and inspects it once", () => {
    const p = props();
    render(<ColdOpen {...p} />);
    const poster = screen.getByRole("button", { name: "Poster on the wall" });
    fireEvent.click(poster);
    fireEvent.click(poster);
    expect(screen.getByText("Kettle & Co. FLASH SALE 50% today")).toBeTruthy();
    expect(poster.getAttribute("aria-expanded")).toBe("true");
    expect(p.onInspect).toHaveBeenCalledTimes(1);
    expect(p.onInspect).toHaveBeenCalledWith("wall.poster");
  });

  it("skip goes to the page", () => {
    const p = props();
    render(<ColdOpen {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(p.onSkip).toHaveBeenCalled();
  });

  it("the page is an alert dialog with the incident, the running clock and new hotspots", () => {
    render(<ColdOpen {...props({ phase: "paging", ticks: 73 })} />);
    const dialog = screen.getByRole("alertdialog", { name: "Checkout returning 5xx" });
    expect(dialog.textContent).toContain("00:07");
    expect(dialog.textContent).toContain("Checkout requests for Kettle & Co. are failing");
    expect(screen.getByRole("button", { name: "Phone: new mention" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip to the page" })).toBeNull();
  });

  it("acknowledges with the button or the A key, but not with Ctrl+A", () => {
    const p = props({ phase: "paging" });
    render(<ColdOpen {...p} />);
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    expect(p.onAck).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(p.onAck).toHaveBeenCalledTimes(2);
  });

  it("shows the escalation once the secondary is paged", () => {
    render(<ColdOpen {...props({ phase: "paging", escalated: true })} />);
    expect(screen.getByText(/Paging the secondary on-call/)).toBeTruthy();
  });
});
```

Run: `pnpm --filter @pitwall/web test`
Expected: FAIL, `Failed to resolve import "./ColdOpen"`.

- [ ] **Step 2: Implement**

`apps/web/src/screens/ColdOpen.tsx`:
```tsx
import type { ColdOpenDef } from "@pitwall/engine";
import { useEffect, useState } from "react";
import { fillBrand } from "../game/brand";
import { formatClock } from "../game/format";

interface Props {
  coldOpen: ColdOpenDef;
  brand: string;
  phase: "prepage" | "paging";
  ticks: number;
  escalated: boolean;
  onInspect: (hotspotId: string) => void;
  onSkip: () => void;
  onAck: () => void;
}

/** M1 minimal cold open: a card over a dimmed backdrop. M1.5 replaces it with the café scene. */
export function ColdOpen({ coldOpen, brand, phase, ticks, escalated, onInspect, onSkip, onAck }: Props) {
  const [opened, setOpened] = useState<string[]>([]);
  const paging = phase === "paging";
  const hotspots = Object.entries(coldOpen.hotspots).filter(([, h]) => paging || h.appearsAt !== "incident_start");

  useEffect(() => {
    if (!paging) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "a" || e.key === "A") && !e.ctrlKey && !e.metaKey && !e.altKey) onAck();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paging, onAck]);

  const open = (id: string) => {
    if (opened.includes(id)) return;
    setOpened([...opened, id]);
    onInspect(id);
  };

  return (
    <div className="cold-open">
      <div
        className={paging ? "co-card paging" : "co-card"}
        role={paging ? "alertdialog" : "region"}
        aria-labelledby="co-title"
        aria-describedby="co-body"
      >
        {paging ? (
          <>
            <div className="co-meta">
              <span className="tag crit">{coldOpen.page.severity}</span>
              <span>
                Paging you · <span className="mono">{formatClock(ticks)}</span>
              </span>
            </div>
            <h1 id="co-title">{coldOpen.page.title}</h1>
            <p id="co-body">{fillBrand(coldOpen.page.body, brand)}</p>
            {escalated && (
              <p className="co-escalated" role="status">
                <span className="tag warn">Escalated</span> No acknowledgement for 60 s. Paging the secondary on-call.
              </p>
            )}
            <button type="button" className="btn primary btn-lg co-ack" onClick={onAck} autoFocus>
              Acknowledge <kbd>A</kbd>
            </button>
          </>
        ) : (
          <>
            <div className="co-meta">
              <span className="tag info">On call</span>
              <span>{brand}</span>
            </div>
            <h1 id="co-title">A quiet evening at the café</h1>
            <p id="co-body">
              You are the primary on-call for {brand}. Nothing is broken yet. The incident clock starts when the pager goes off.
            </p>
          </>
        )}

        <div className="co-look">
          <h2>{paging ? "Around you, while the clock runs" : "Look around"}</h2>
          <ul>
            {hotspots.map(([id, h]) => (
              <li key={id}>
                <button type="button" className="co-hotspot" aria-expanded={opened.includes(id)} onClick={() => open(id)}>
                  {h.label}
                </button>
                {opened.includes(id) && <p className="co-reveal">{fillBrand(h.text, brand)}</p>}
              </li>
            ))}
          </ul>
        </div>

        {!paging && (
          <div className="co-foot">
            <button type="button" className="btn" onClick={onSkip}>
              Skip to the page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

`apps/web/src/styles/screens.css` (cold-open section):
```css
/* Cold open (M1 minimal) */
.cold-open { min-height: 100vh; display: grid; place-items: center; padding: var(--space-4); background: var(--sunken); }
.co-card { width: 100%; max-width: 560px; display: grid; gap: var(--space-4); padding: var(--space-6); background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); }
.co-card.paging { border-color: var(--crit); box-shadow: 0 0 0 1px var(--crit); }
.co-meta { display: flex; align-items: center; gap: var(--space-2); color: var(--muted); font-size: var(--fs-sm); }
.co-card h1 { font-size: 26px; font-weight: 600; line-height: 1.2; }
.co-card p { font-size: var(--fs-md); color: var(--muted); }
.co-escalated { display: flex; gap: var(--space-2); align-items: center; color: var(--warn) !important; }
.co-ack { justify-self: start; }
.co-look h2 { margin-bottom: var(--space-2); font-size: var(--fs-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.co-look li + li { margin-top: var(--space-1); }
.co-hotspot {
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  background: var(--raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.co-hotspot:hover { border-color: var(--muted); }
.co-hotspot[aria-expanded="true"] { border-color: var(--border-strong); color: var(--muted); }
.co-reveal { margin: var(--space-1) 0 var(--space-2) var(--space-3); padding-left: var(--space-3); border-left: 2px solid var(--border-strong); color: var(--text) !important; font-size: var(--fs) !important; }
.co-foot { display: flex; justify-content: flex-end; }
```

Add `import "./styles/screens.css";` to `main.tsx` after `console.css`.

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pnpm --filter @pitwall/web test`
Expected: PASS. Typecheck and lint clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/screens apps/web/src/styles/screens.css apps/web/src/main.tsx
git commit -m "feat(web): minimal cold open with free pre-page hotspots and the ack card"
```

---

### Task 9: Debrief

**Files:**
- Create: `apps/web/src/screens/Debrief.tsx`, `Debrief.test.tsx`
- Modify: `apps/web/src/styles/screens.css` (debrief section)

**Interfaces:**
- Consumes: `pickLesson`, `RunResult`, `ScenarioDef`; `formatBp`, `formatClock`; `ThemeToggle`.
- Produces: `<Debrief scenario result onPlayAgain onHome />`, and the pure helpers `burnLabel(tag, scenario): string` and `burnClass(tag): string`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/screens/Debrief.test.tsx`:
```tsx
import { ACK, inspectAction, replay } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { burnLabel, Debrief } from "./Debrief";

afterEach(cleanup);

const perfect = replay(slowLeak, 1, [
  { tick: 0, actionId: inspectAction("laptop.slack.deploys") },
  { tick: 20, actionId: ACK },
  { tick: 20, actionId: "checkout.pool_stats" },
  { tick: 60, actionId: "checkout.deploys" },
  { tick: 90, actionId: "checkout.rollback" },
]);
const dnf = replay(slowLeak, 1, []);

const show = (result = perfect) => {
  const handlers = { onPlayAgain: vi.fn(), onHome: vi.fn() };
  render(<Debrief scenario={slowLeak} result={result} {...handlers} />);
  return handlers;
};

describe("Debrief", () => {
  it("headlines a resolved run with its score tiles", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Resolved in \d\d:\d\d$/);
    const tiles = screen.getByRole("list", { name: "Score" });
    expect(within(tiles).getByText("Found")).toBeTruthy();
    expect(within(tiles).getByText("00:02")).toBeTruthy();
    expect(within(tiles).getByText("1/3")).toBeTruthy();
  });

  it("headlines a DNF and says the secondary was paged", () => {
    show(dnf);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Did not finish");
    expect(screen.getByText("Never")).toBeTruthy();
    expect(screen.getByText("Not mitigated")).toBeTruthy();
    expect(screen.getByText("Secondary paged")).toBeTruthy();
  });

  it("breaks the burn down by cause, in words", () => {
    show();
    const legend = screen.getByRole("list", { name: "Budget burned by cause" });
    expect(within(legend).getByText("Before acknowledging")).toBeTruthy();
    expect(within(legend).getByText("Investigating")).toBeTruthy();
  });

  it("labels each action on the timeline with its verdict", () => {
    show();
    const timeline = screen.getByRole("list", { name: "Timeline" });
    expect(within(timeline).getByText("Roll back to v141")).toBeTruthy();
    expect(within(timeline).getAllByText("Useful").length).toBe(3);
    expect(within(timeline).getByText("Acknowledged")).toBeTruthy();
  });

  it("shows the scenario lesson and the next steps", () => {
    const h = show(dnf);
    expect(screen.getByText(/the database was a victim, not the cause/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to start" }));
    expect(h.onPlayAgain).toHaveBeenCalled();
    expect(h.onHome).toHaveBeenCalled();
  });

  it("names side-effect burn after the action", () => {
    expect(burnLabel("side_effect:checkout.restart", slowLeak)).toBe("Side effect: Restart pods");
    expect(burnLabel("mitigated_unfixed", slowLeak)).toBe("Mitigated, cause still active");
  });
});
```

Run: `pnpm --filter @pitwall/web test`
Expected: FAIL, `Failed to resolve import "./Debrief"`.

- [ ] **Step 2: Implement**

`apps/web/src/screens/Debrief.tsx`:
```tsx
import { pickLesson, type RunResult, type ScenarioDef, type State, type Verdict } from "@pitwall/engine";
import { formatBp, formatClock } from "../game/format";
import { ThemeToggle } from "../ThemeToggle";

const SIDE_EFFECT = "side_effect:";

export function burnLabel(tag: string, scenario: ScenarioDef<State>): string {
  if (tag === "unacknowledged") return "Before acknowledging";
  if (tag === "investigating") return "Investigating";
  if (tag === "mitigated_unfixed") return "Mitigated, cause still active";
  if (tag.startsWith(SIDE_EFFECT)) {
    const id = tag.slice(SIDE_EFFECT.length);
    return `Side effect: ${scenario.actions.find((a) => a.id === id)?.label ?? id}`;
  }
  return tag;
}

export function burnClass(tag: string): string {
  if (tag === "unacknowledged") return "burn-unack";
  if (tag === "mitigated_unfixed") return "burn-mitigated";
  if (tag.startsWith(SIDE_EFFECT)) return "burn-side";
  return "burn-investigating";
}

const VERDICT: Record<Verdict, { label: string; tag: string }> = {
  useful: { label: "Useful", tag: "ok" },
  wasted: { label: "Wasted time", tag: "warn" },
  harmful: { label: "Harmful", tag: "crit" },
};

interface Row {
  tick: number;
  label: string;
  verdict?: Verdict;
}

function timelineRows(scenario: ScenarioDef<State>, result: RunResult): Row[] {
  const actions = new Map(scenario.actions.map((a) => [a.id, a]));
  const rows: Row[] = [];
  for (const e of result.timeline) {
    if (e.kind === "page") rows.push({ tick: e.tick, label: "Paged" });
    else if (e.kind === "ack") rows.push({ tick: e.tick, label: "Acknowledged" });
    else if (e.kind === "escalated") rows.push({ tick: e.tick, label: "Secondary on-call paged" });
    else if (e.kind === "action_start") {
      const def = actions.get(e.actionId);
      if (def) rows.push({ tick: e.tick, label: def.label, verdict: def.verdict });
    } else if (e.kind === "resolved") rows.push({ tick: e.tick, label: "Resolved" });
    else if (e.kind === "dnf") rows.push({ tick: e.tick, label: "Time limit reached" });
  }
  return rows;
}

interface Props {
  scenario: ScenarioDef<State>;
  result: RunResult;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function Debrief({ scenario, result, onPlayAgain, onHome }: Props) {
  const resolved = result.outcome === "resolved";
  const lesson = pickLesson(scenario, result);
  const clueTotal = Object.values(scenario.coldOpen.hotspots).filter((h) => h.kind === "clue").length;
  const burns = Object.entries(result.burnByTag)
    .filter(([, bp]) => bp > 0)
    .sort((a, b) => b[1] - a[1]);
  const burnTotal = burns.reduce((sum, [, bp]) => sum + bp, 0);

  return (
    <div className="page">
      <header className="site-head">
        <span className="wordmark">Pit Wall On-Call</span>
        <ThemeToggle />
      </header>
      <main className="debrief">
        <section className="debrief-hero">
          <p className="eyebrow">{scenario.title} · Debrief</p>
          <h1>{resolved ? `Resolved in ${formatClock(result.endTick)}` : "Did not finish"}</h1>
          {!resolved && <p className="muted">The time limit ran out before checkout recovered.</p>}
        </section>

        <ul className="tiles" aria-label="Score">
          <li className="tile">
            <span className="tile-k">Error budget burned</span>
            <span className="tile-v mono">{formatBp(result.budgetBurnedBp)}</span>
          </li>
          <li className="tile">
            <span className="tile-k">Mitigated at</span>
            <span className="tile-v mono">{result.mitigatedAtTick === null ? "Not mitigated" : formatClock(result.mitigatedAtTick)}</span>
          </li>
          <li className="tile">
            <span className="tile-k">Root cause</span>
            <span className="tile-v">{result.rootCauseFound ? "Found" : "Not found"}</span>
          </li>
          <li className="tile">
            <span className="tile-k">Acknowledged</span>
            <span className="tile-v mono">{result.ackTick === null ? "Never" : formatClock(result.ackTick)}</span>
            {result.escalated && <span className="tag warn">Secondary paged</span>}
          </li>
          <li className="tile">
            <span className="tile-k">Clues found</span>
            <span className="tile-v mono">{`${result.cluesFound.length}/${clueTotal}`}</span>
          </li>
        </ul>

        <section className="panel" aria-labelledby="burn-h">
          <div className="ph">
            <h2 id="burn-h">Where the budget went</h2>
          </div>
          <div className="pb">
            {burnTotal === 0 ? (
              <p className="empty">No budget burned. Nothing to break down.</p>
            ) : (
              <>
                <div className="burn-bar" aria-hidden="true">
                  {burns.map(([tag, bp]) => (
                    <span key={tag} className={`burn-seg ${burnClass(tag)}`} style={{ width: `${(bp / burnTotal) * 100}%` }} />
                  ))}
                </div>
                <ul className="burn-legend" aria-label="Budget burned by cause">
                  {burns.map(([tag, bp]) => (
                    <li key={tag}>
                      <span className={`swatch ${burnClass(tag)}`} aria-hidden="true" />
                      <span>{burnLabel(tag, scenario)}</span>
                      <span className="mono">{formatBp(bp)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="timeline-h">
          <div className="ph">
            <h2 id="timeline-h">Timeline</h2>
          </div>
          <ol className="timeline pb" aria-label="Timeline">
            {timelineRows(scenario, result).map((row, i) => (
              <li key={i}>
                <time className="mono">{formatClock(row.tick)}</time>
                <span>{row.label}</span>
                {row.verdict && <span className={`tag ${VERDICT[row.verdict].tag}`}>{VERDICT[row.verdict].label}</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="panel lesson" aria-labelledby="lesson-h">
          <div className="ph">
            <h2 id="lesson-h">Lesson</h2>
          </div>
          <p className="pb">{lesson.text}</p>
        </section>

        <div className="debrief-actions">
          <button type="button" className="btn primary btn-lg" onClick={onPlayAgain}>
            Play again
          </button>
          <button type="button" className="btn btn-lg" onClick={onHome}>
            Back to start
          </button>
        </div>
      </main>
    </div>
  );
}
```

Append to `apps/web/src/styles/screens.css`:
```css
/* Shared page frame (landing and debrief) */
.page { min-height: 100vh; display: flex; flex-direction: column; }
.site-head, .site-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: var(--space-4);
}
.site-foot { margin-top: auto; flex-wrap: wrap; color: var(--muted); font-size: var(--fs-sm); }
.eyebrow { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }

/* Debrief */
.debrief { width: 100%; max-width: 880px; margin: 0 auto; padding: var(--space-4) var(--space-4) var(--space-7); display: grid; gap: var(--space-5); }
.debrief-hero { display: grid; gap: var(--space-2); }
.debrief-hero h1 { font-size: var(--fs-2xl); font-weight: 600; line-height: 1.1; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--gap); }
.tile { display: grid; align-content: start; gap: var(--space-1); padding: var(--space-4); background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); }
.tile .tag { justify-self: start; }
.tile-k { font-size: var(--fs-sm); color: var(--muted); }
.tile-v { font-size: 24px; font-weight: 500; }
.burn-bar { display: flex; height: 14px; border-radius: var(--radius-sm); overflow: hidden; gap: 2px; background: var(--sunken); }
.burn-seg { min-width: 3px; }
.burn-legend { display: grid; gap: var(--space-2); margin-top: var(--space-3); }
.burn-legend li { display: grid; grid-template-columns: 12px 1fr auto; gap: var(--space-2); align-items: center; font-size: var(--fs-md); }
.swatch { width: 12px; height: 12px; border-radius: 3px; }
.burn-unack { background: var(--warn); }
.burn-investigating { background: var(--accent); }
.burn-mitigated { background: var(--info); }
.burn-side { background: var(--crit); }
.timeline li { display: grid; grid-template-columns: 56px 1fr auto; gap: var(--space-3); align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: var(--fs-md); }
.timeline li:last-child { border-bottom: 0; }
.timeline time { color: var(--muted); font-size: var(--fs-sm); }
.lesson p { font-size: var(--fs-md); line-height: 1.6; }
.debrief-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
@media (max-width: 480px) {
  .debrief-hero h1 { font-size: var(--fs-xl); }
  .debrief-actions .btn { flex: 1 1 100%; }
}
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pnpm --filter @pitwall/web test`
Expected: PASS. Typecheck and lint clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/screens apps/web/src/styles/screens.css
git commit -m "feat(web): debrief with burn breakdown, timeline verdicts and the lesson"
```

---

### Task 10: Landing, incident flow and app wiring

**Files:**
- Create: `apps/web/src/screens/Landing.tsx`, `Incident.tsx`, `ErrorBoundary.tsx`, `ErrorBoundary.test.tsx`, `apps/web/src/useMediaQuery.ts`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/styles/screens.css` (landing and incident sections)

**Interfaces:**
- Consumes: everything above.
- Produces: `<App fetchVersion? newSeed? prepageMs? />`; `<Incident scenario seed onFinish prepageMs? now? />` with `PREPAGE_MS = 18_000`; `<Landing scenario apiLine build wide onStart />`; `<ErrorBoundary onReset>`; `useMediaQuery(query, fallback = true): boolean`.

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/src/App.test.tsx`:
```tsx
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const online = async () => "abc1234";

describe("App", () => {
  it("shows the API version when the API is up", async () => {
    render(<App fetchVersion={online} />);
    expect(await screen.findByText("API online · abc1234")).toBeTruthy();
  });

  it("shows unreachable when the API call fails", async () => {
    render(
      <App
        fetchVersion={async () => {
          throw new Error("HTTP 502");
        }}
      />,
    );
    expect(await screen.findByText("API unreachable")).toBeTruthy();
  });

  it("landing pitches the game and offers the first scenario", async () => {
    render(<App fetchVersion={online} />);
    expect(screen.getByRole("heading", { level: 1, name: "Pit Wall On-Call" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The Slow Leak" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start shift" })).toBeTruthy();
    await screen.findByText("API online · abc1234");
  });

  it("on a small screen, explains why the console is not offered", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<App fetchVersion={online} />);
    expect(screen.queryByRole("button", { name: "Start shift" })).toBeNull();
    expect(screen.getByText(/needs a screen at least 1024 px wide/)).toBeTruthy();
    await screen.findByText("API online · abc1234");
    vi.unstubAllGlobals();
  });

  it("plays through: start, pre-page, page, ack, console, pause and resume", async () => {
    render(<App fetchVersion={online} newSeed={() => 1} />);
    await screen.findByText("API online · abc1234");
    fireEvent.click(screen.getByRole("button", { name: "Start shift" }));
    expect(screen.getByRole("heading", { name: "A quiet evening at the café" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Laptop: Slack #deploys" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(screen.getByRole("alertdialog", { name: "Checkout returning 5xx" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(screen.getByRole("region", { name: "Alerts" })).toBeTruthy();
    expect(screen.getByText(/Dimas: shipping the checkout refactor/)).toBeTruthy();

    fireEvent.keyDown(window, { key: "p" });
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Alerts" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
    expect(screen.getByRole("region", { name: "Alerts" })).toBeTruthy();
  });

  it("the pre-page ends by itself after its time", async () => {
    vi.useFakeTimers();
    render(<App fetchVersion={online} newSeed={() => 1} prepageMs={18_000} />);
    fireEvent.click(screen.getByRole("button", { name: "Start shift" }));
    act(() => vi.advanceTimersByTime(18_000));
    expect(screen.getByRole("alertdialog", { name: "Checkout returning 5xx" })).toBeTruthy();
  });
});
```

Note: `queryByRole` ignores elements inside a `hidden` ancestor, so the paused console is invisible to it.

`apps/web/src/screens/ErrorBoundary.test.tsx`:
```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Boom(): never {
  throw new Error("engine exploded");
}

describe("ErrorBoundary", () => {
  it("replaces a crashed run with an explanation and a way back", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alertdialog", { name: "The simulation hit an error" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to start" }));
    expect(onReset).toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter @pitwall/web test`
Expected: FAIL (App tests cannot find "Start shift"; ErrorBoundary import unresolved).

- [ ] **Step 2: Implement**

`apps/web/src/useMediaQuery.ts`:
```ts
import { useEffect, useState } from "react";

/** Matches a media query; `fallback` is used where matchMedia does not exist (tests, old engines). */
export function useMediaQuery(query: string, fallback = true): boolean {
  const [matches, setMatches] = useState(() => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : fallback));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
```

`apps/web/src/screens/ErrorBoundary.tsx`:
```tsx
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onReset: () => void;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("simulation crashed", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="overlay">
        <div className="card" role="alertdialog" aria-labelledby="crash-h" aria-describedby="crash-d">
          <h2 id="crash-h">The simulation hit an error</h2>
          <p id="crash-d">This run can't continue. Nothing was submitted.</p>
          <button
            type="button"
            className="btn primary"
            autoFocus
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            Back to start
          </button>
        </div>
      </div>
    );
  }
}
```

`apps/web/src/screens/Incident.tsx`:
```tsx
import { ACK, ActionRejected, inspectAction, Run, type RunResult, type ScenarioDef, type State } from "@pitwall/engine";
import { useCallback, useEffect, useState } from "react";
import { Console } from "../console/Console";
import { brandFor } from "../game/brand";
import { useRunLoop } from "../game/useRunLoop";
import { ColdOpen } from "./ColdOpen";

/** Cold-open spec §3: about 18 s of free pre-page before the pager fires. */
export const PREPAGE_MS = 18_000;

interface Props {
  scenario: ScenarioDef<State>;
  seed: number;
  onFinish: (result: RunResult) => void;
  prepageMs?: number;
  now?: () => number;
}

type Phase = "prepage" | "paging" | "console";

export function Incident({ scenario, seed, onFinish, prepageMs = PREPAGE_MS, now }: Props) {
  const [run] = useState(() => new Run(scenario, seed));
  const [phase, setPhase] = useState<Phase>("prepage");
  const { snapshot, history, paused, pause, resume, refresh } = useRunLoop(run, { active: phase !== "prepage", onFinish, now });
  const brand = brandFor(seed);

  useEffect(() => {
    if (phase !== "prepage") return;
    const id = window.setTimeout(() => setPhase("paging"), prepageMs);
    return () => window.clearTimeout(id);
  }, [phase, prepageMs]);

  useEffect(() => {
    if (phase === "prepage") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (paused) resume();
      else pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, paused, pause, resume]);

  const dispatch = useCallback(
    (actionId: string) => {
      try {
        run.dispatch(actionId);
      } catch (e) {
        // The UI disables unavailable actions; a rejection here is a harmless double click.
        if (!(e instanceof ActionRejected)) throw e;
      }
      refresh();
    },
    [run, refresh],
  );

  const acknowledge = useCallback(() => {
    dispatch(ACK);
    setPhase("console");
  }, [dispatch]);

  return (
    <>
      <div hidden={paused}>
        {phase === "console" ? (
          <Console
            scenario={scenario}
            snapshot={snapshot}
            logs={run.logs}
            history={history}
            brand={brand}
            check={(id) => run.check(id)}
            onAction={dispatch}
            onPause={pause}
          />
        ) : (
          <ColdOpen
            coldOpen={scenario.coldOpen}
            brand={brand}
            phase={phase}
            ticks={snapshot.tick}
            escalated={snapshot.escalated}
            onInspect={(id) => dispatch(inspectAction(id))}
            onSkip={() => setPhase("paging")}
            onAck={acknowledge}
          />
        )}
      </div>
      {paused && (
        <div className="overlay">
          <div className="card" role="dialog" aria-modal="true" aria-labelledby="paused-h" aria-describedby="paused-d">
            <h2 id="paused-h">Paused</h2>
            <p id="paused-d">The incident clock is stopped and the console is hidden until you resume.</p>
            <button type="button" className="btn primary" autoFocus onClick={resume}>
              Resume <kbd>P</kbd>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

The ColdOpen `A` shortcut only listens while `phase === "paging"`, and a paused run hides it; the ack button is not reachable while paused because its container is `hidden`.

`apps/web/src/screens/Landing.tsx`:
```tsx
import type { ScenarioDef, State } from "@pitwall/engine";
import { ThemeToggle } from "../ThemeToggle";

interface Props {
  scenario: ScenarioDef<State>;
  apiLine: string;
  build: string;
  wide: boolean;
  onStart: () => void;
}

const DIFFICULTY = { easy: "Easy", normal: "Normal", hard: "Hard" } as const;

export function Landing({ scenario, apiLine, build, wide, onStart }: Props) {
  return (
    <div className="page">
      <header className="site-head">
        <span className="wordmark">Pit Wall On-Call</span>
        <ThemeToggle />
      </header>
      <main className="landing">
        <section className="hero">
          <h1>Pit Wall On-Call</h1>
          <p className="lede">You are on call and production is failing. Find the cause before the error budget runs out.</p>
        </section>

        <section className="scenario-card" aria-labelledby="scenario-h">
          <div className="sc-meta">
            <span className="tag info">Scenario 1</span>
            <span>
              {DIFFICULTY[scenario.difficulty]} · {scenario.timeLimitS / 60} min limit
            </span>
          </div>
          <h2 id="scenario-h">{scenario.title}</h2>
          <p>{scenario.summary}</p>
          {wide ? (
            <button type="button" className="btn primary btn-lg" onClick={onStart}>
              Start shift
            </button>
          ) : (
            <p className="note">The incident console needs a screen at least 1024 px wide. Open this page on a laptop or desktop to play.</p>
          )}
        </section>

        <section className="how" aria-labelledby="how-h">
          <h2 id="how-h">How it plays</h2>
          <ol>
            <li>
              <b>Get paged.</b> Acknowledge quickly: time before the ack burns budget too.
            </li>
            <li>
              <b>Investigate.</b> Read alerts, metrics and logs. The loudest service is not always the cause.
            </li>
            <li>
              <b>Act.</b> Every action takes time, and some make things worse.
            </li>
          </ol>
        </section>
      </main>
      <footer className="site-foot">
        <span>{apiLine}</span>
        <span>Web build · {build}</span>
      </footer>
    </div>
  );
}
```

`apps/web/src/App.tsx`:
```tsx
import type { RunResult } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { useEffect, useState } from "react";
import { fetchApiVersion } from "./api";
import { Debrief } from "./screens/Debrief";
import { ErrorBoundary } from "./screens/ErrorBoundary";
import { Incident } from "./screens/Incident";
import { Landing } from "./screens/Landing";
import { useMediaQuery } from "./useMediaQuery";

type ApiStatus = { state: "checking" } | { state: "online"; version: string } | { state: "unreachable" };

type Screen = { name: "landing" } | { name: "incident"; seed: number } | { name: "debrief"; result: RunResult };

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

interface AppProps {
  fetchVersion?: () => Promise<string>;
  newSeed?: () => number;
  prepageMs?: number;
}

export function App({ fetchVersion = fetchApiVersion, newSeed = randomSeed, prepageMs }: AppProps) {
  const [status, setStatus] = useState<ApiStatus>({ state: "checking" });
  const [screen, setScreen] = useState<Screen>({ name: "landing" });
  const wide = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    let cancelled = false;
    fetchVersion().then(
      (version) => {
        if (!cancelled) setStatus({ state: "online", version });
      },
      () => {
        if (!cancelled) setStatus({ state: "unreachable" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchVersion]);

  const home = () => setScreen({ name: "landing" });
  const start = () => setScreen({ name: "incident", seed: newSeed() });

  if (screen.name === "incident") {
    return (
      <ErrorBoundary onReset={home}>
        <Incident
          key={screen.seed}
          scenario={slowLeak}
          seed={screen.seed}
          prepageMs={prepageMs}
          onFinish={(result) => setScreen({ name: "debrief", result })}
        />
      </ErrorBoundary>
    );
  }
  if (screen.name === "debrief") {
    return <Debrief scenario={slowLeak} result={screen.result} onPlayAgain={start} onHome={home} />;
  }

  const apiLine =
    status.state === "checking" ? "Checking API…" : status.state === "online" ? `API online · ${status.version}` : "API unreachable";
  return <Landing scenario={slowLeak} apiLine={apiLine} build={import.meta.env.VITE_GIT_SHA ?? "dev"} wide={wide} onStart={start} />;
}
```

Append to `apps/web/src/styles/screens.css`:
```css
/* Landing */
.landing { width: 100%; max-width: 880px; margin: 0 auto; padding: var(--space-6) var(--space-4) var(--space-7); display: grid; gap: var(--space-6); }
.hero { display: grid; gap: var(--space-3); }
.hero h1 { font-size: var(--fs-2xl); font-weight: 600; line-height: 1.1; }
.lede { font-size: 18px; color: var(--muted); max-width: 36em; }
.scenario-card { display: grid; gap: var(--space-3); padding: var(--space-5); background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); }
.scenario-card h2 { font-size: var(--fs-lg); font-weight: 600; }
.scenario-card p { font-size: var(--fs-md); color: var(--muted); }
.scenario-card .btn { justify-self: start; }
.sc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); color: var(--muted); font-size: var(--fs-sm); }
.note { padding: var(--space-3); border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: var(--radius-sm); color: var(--text) !important; }
.how h2 { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: var(--space-3); }
.how ol { display: grid; gap: var(--space-3); counter-reset: step; }
.how li { font-size: var(--fs-md); color: var(--muted); }
.how b { color: var(--text); font-weight: 600; }
@media (max-width: 480px) {
  .hero h1 { font-size: var(--fs-xl); }
  .lede { font-size: var(--fs-md); }
  .scenario-card .btn { justify-self: stretch; }
}
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all packages PASS; typecheck, lint and build clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): landing, incident flow with pause, and debrief wiring"
```

---

### Task 11: Play it for real, write back the decisions, open the PR

**Files:**
- Modify: `docs/specs/2026-09-27-pit-wall-on-call-design.md` (revisions P1–P4, P6–P7), `docs/plans/2026-09-27-roadmap.md` (M1 plan link)

- [ ] **Step 1: Play through in a real browser at 1440×900**

Start `pnpm --filter @pitwall/web dev` (through the preview tool, port 5173) and play three runs:
1. **Perfect:** open two hotspots, skip, ack with `A`, check the pool, view deploys, roll back. Expected: resolves around 01:00, the debrief shows 2/3 or fewer clues, "Found", the default lesson.
2. **Red herring:** failover postgres, restart pods, then roll back. Expected: side-effect segments in the burn bar and the restart-trap lesson.
3. **Do nothing past 60 s:** the page shows "Escalated". Then ack and let it run; pause with `P`, switch tabs, and come back: the clock must not move while hidden.
Check both themes, keyboard-only play (Tab, Enter, 1–4, Esc, P, A), and the console console for errors. Take screenshots of the console and the debrief in both themes.

- [ ] **Step 2: Check the 375 px pages**

Resize to 375×812. Expected: landing and debrief have no horizontal scroll, and the landing shows the "needs a screen at least 1024 px wide" note instead of Start.

- [ ] **Step 3: Write the plan decisions back into the main spec**

Add a "Revisions" section at the end of `docs/specs/2026-09-27-pit-wall-on-call-design.md`:
```markdown
## 17. Revisions

| Date | Change | Source |
|---|---|---|
| 2026-09-28 | `undetected` is not produced in v1: the page fires at tick 0, so there is no pre-alert window. | M1 plan P1 |
| 2026-09-28 | No "declare resolved" action: a run resolves once its resolve condition holds for 10 s; `mitigated_at_tick` is the start of that stretch. | M1 plan P2 |
| 2026-09-28 | Selecting a node is UI only. Investigation is explicit per-service actions that cost clock time. | M1 plan P3 |
| 2026-09-28 | Action ticks must be non-decreasing (several actions may share a tick), replacing "strictly increasing" in §8. | M1 plan P4 |
| 2026-09-28 | The player runs one timed action at a time; `ack` and `inspect` are instant and never blocked. | M1 plan P6 |
| 2026-09-28 | Action categories are shown as text labels; the category emoji in §6 are dropped (D14). | M1 plan P7 |
```
Also edit the affected lines in place so the spec reads correctly on its own: §5 burn tags (note on `undetected`), §6 action categories (drop the emoji), §7 right column (remove "declare resolved"), §8 validation step 1 ("non-decreasing ticks").

- [ ] **Step 4: Roadmap**

In `docs/plans/2026-09-27-roadmap.md`, set M1's "Detailed plan" cell to `2026-09-28-m1-engine-first-incident.md`.

- [ ] **Step 5: Final checks and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green.
```bash
git add docs
git commit -m "docs: write M1 plan decisions back into the spec and link the plan"
```

- [ ] **Step 6: Push and open the PR (do not merge: a merge deploys to production)**

```bash
git push -u origin feat/m1-engine-first-incident
gh pr create --title "M1: engine, The Slow Leak, console and debrief" --body-file <prepared body>
```
The PR body follows `.github/pull_request_template.md`, lists the rulings from the ledger, and attaches the screenshots. No AI attribution.

