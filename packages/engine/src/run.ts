import { ACK, ENGINE_VERSION, ESCALATION_TICK, INSPECT_PREFIX, LOG_CAP, STABLE_TICKS_TO_RESOLVE, TICKS_PER_SECOND } from "./constants";
import { mulberry32, streamSeed, type Rng } from "./rng";
import type {
  ActionDef,
  ActionRecord,
  AlertState,
  BusyState,
  LogEntry,
  LogLevel,
  Outcome,
  RunResult,
  ScenarioDef,
  Snapshot,
  State,
  TimelineEntry,
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
      errorRateBp: this.currentErrorBp(),
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

  private currentErrorBp(): number {
    const base = clampBp(this.scenario.errorRateBp(this.s));
    const side = this.busy ? clampBp(this.actionDefs.get(this.busy.actionId)?.sideEffectBp ?? 0) : 0;
    return Math.min(10_000, base + side);
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
