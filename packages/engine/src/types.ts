import type { Rng } from "./rng";

/** Scenario state. Every value must be an integer, because the score depends on it (spec §5, rule 3). */
export type State = Record<string, number>;
export type Health = "ok" | "warn" | "crit";
export type ActionCategory = "investigate" | "mitigate" | "fix" | "communicate";
export type Verdict = "useful" | "wasted" | "harmful";
export type LogLevel = "INFO" | "WARN" | "ERROR";
export type Outcome = "running" | "resolved" | "dnf";
/** Where the incident stands, derived each tick for the UI (M2.5 spec §3). Scoring never reads it. */
export type IncidentStatus = "paging" | "investigating" | "mitigated" | "holding" | "resolved" | "dnf";

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
  /**
   * Runs in the background (a question to a teammate): it never blocks other actions, and its
   * effect and reveals land when its time is up (M2.5 plan B1).
   */
  async?: boolean;
}

export interface HotspotDef {
  kind: "clue" | "herring";
  label: string;
  text: string;
  appearsAt?: "incident_start";
  /** Who said it, when the hotspot is a message. Filled from the world's colleagues. */
  author?: "deployer" | "secondary" | "infra" | "support";
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
  /** The rubber duck's questions, in order (M2.5 spec §9). */
  hints?: string[];
  /** For actions that only hide the symptom: what they did, for the postmortem (M2.5 spec §3). */
  maskNotes?: Record<string, string>;
  /** The guided training shift: never posted to the leaderboard (M2.5 spec §5, D4). */
  training?: boolean;
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
  /** Asynchronous actions still running, in the order they started. */
  pending: BusyState[];
  metrics: Record<string, number>;
  health: Record<string, Health>;
  details: Record<string, string>;
  alerts: AlertState[];
  budgetBurnedBp: number;
  /** Requests failing right now, including a running side effect (presentation only). */
  errorRateBp: number;
  inspected: string[];
  cluesFound: string[];
  /** The tick the resolve condition started holding, or null; read only, for the countdown (cold-open spec §4). */
  stableSinceTick: number | null;
  status: IncidentStatus;
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
