import { ACK, replay, Run, type ActionRecord, type IncidentStatus, type TimelineEntry } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { describe, expect, it } from "vitest";
import { checklist, type ChecklistExtra, type ChecklistItemId } from "./checklist";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });
const NONE: ChecklistExtra = { browserOpened: false, postmortemOpened: false };
const RUNNING = { status: "investigating" as IncidentStatus };

/** The ids of the items that are done. */
function done(timeline: readonly TimelineEntry[], status: IncidentStatus = "investigating", extra: ChecklistExtra = NONE): ChecklistItemId[] {
  return checklist(slowLeak, timeline, { status }, extra)
    .filter((i) => i.done)
    .map((i) => i.id);
}

const doneAction = (tick: number, actionId: string): TimelineEntry => ({ tick, kind: "action_done", actionId });

describe("checklist", () => {
  it("lists the seven steps in order, all to do before the page", () => {
    const items = checklist(slowLeak, [], RUNNING, NONE);
    expect(items.map((i) => i.id)).toEqual(["ack", "impact", "hypothesis", "mitigate", "verify", "communicate", "close"]);
    expect(items.map((i) => i.label)).toEqual([
      "Acknowledge the page",
      "Check the impact",
      "Form a hypothesis",
      "Stop the bleeding",
      "Verify",
      "Communicate",
      "Close",
    ]);
    expect(items.every((i) => !i.done)).toBe(true);
  });

  it("never names the answer", () => {
    const copy = checklist(slowLeak, [], RUNNING, NONE)
      .map((i) => `${i.label} ${i.hint}`)
      .join(" ")
      .toLowerCase();
    for (const word of ["rollback", "roll back", "v142", "deploy", "checkout", "postgres", "pool", "restart", "failover"]) expect(copy).not.toContain(word);
  });

  it("ticks Acknowledge from the ack", () => {
    expect(done(replay(slowLeak, 1, []).timeline)).not.toContain("ack");
    expect(done(replay(slowLeak, 1, [at(20, ACK)]).timeline)).toEqual(["ack"]);
  });

  it("ticks Check the impact when the Browser was opened", () => {
    expect(done([], "investigating", { ...NONE, browserOpened: true })).toEqual(["impact"]);
  });

  it("ticks Check the impact when the edge service was investigated, and only once it completes", () => {
    expect(done([{ tick: 20, kind: "action_start", actionId: "edge.error_log" }])).toEqual([]);
    expect(done([doneAction(50, "edge.error_log")])).toEqual(["impact"]);
    // Investigating a service behind the edge is not what customers see.
    expect(done([doneAction(50, "postgres.connections")])).toEqual([]);
  });

  it("ticks Form a hypothesis after investigating two different services", () => {
    expect(done([doneAction(40, "checkout.pool_stats"), doneAction(70, "checkout.deploys")])).toEqual([]);
    expect(done([doneAction(40, "checkout.pool_stats"), doneAction(70, "postgres.connections")])).toEqual(["hypothesis"]);
    // The duck is an investigation with no service; it does not count as a second one.
    expect(done([doneAction(40, "checkout.pool_stats"), doneAction(340, "duck")])).toEqual([]);
    const played = replay(slowLeak, 1, [at(20, ACK), at(20, "checkout.pool_stats"), at(60, "postgres.connections")]).timeline;
    expect(done(played)).toEqual(["ack", "hypothesis"]);
  });

  it("ticks Stop the bleeding when a mitigation or a fix completes", () => {
    expect(done([doneAction(200, "checkout.restart")])).toEqual(["mitigate"]);
    expect(done([doneAction(200, "checkout.rollback")])).toEqual(["mitigate"]);
    expect(done([{ tick: 50, kind: "action_start", actionId: "checkout.rollback" }])).toEqual([]);
    // Investigating is not mitigating, and neither is the status page.
    expect(done([doneAction(40, "checkout.pool_stats"), doneAction(60, "global.status_update")])).not.toContain("mitigate");
  });

  it("ticks Verify while the fix holds and once it is resolved", () => {
    expect(done([], "mitigated")).toEqual([]);
    expect(done([], "holding")).toEqual(["verify"]);
    expect(done([], "resolved")).toEqual(["verify"]);
    expect(done([], "dnf")).toEqual([]);

    // From a real run: the rollback completes, and the fix starts holding.
    const run = new Run(slowLeak, 1);
    run.dispatch(ACK);
    run.dispatch("checkout.rollback");
    while (run.snapshot().status !== "holding" && run.outcome === "running") run.step();
    expect(checklist(slowLeak, run.timeline, run.snapshot(), NONE).find((i) => i.id === "verify")!.done).toBe(true);
  });

  it("ticks Communicate from the status update, not from asking the secondary", () => {
    expect(done([doneAction(40, "global.ask_secondary")])).toEqual([]);
    expect(done([doneAction(40, "global.status_update")])).toEqual(["communicate"]);
  });

  it("ticks Close once the postmortem was opened", () => {
    expect(done([], "resolved", { ...NONE, postmortemOpened: true })).toEqual(["verify", "close"]);
  });

  it("works for any scenario, from its categories, services and edges", () => {
    // A made-up shape: the entry point is "lb", not "edge", and no action id matches The Slow Leak's.
    const other = {
      ...slowLeak,
      services: [
        { id: "lb", label: "lb", x: 0, y: 0, detail: () => "" },
        { id: "web", label: "web", x: 0, y: 0, detail: () => "" },
        { id: "cache", label: "cache", x: 0, y: 0, detail: () => "" },
      ],
      edges: [
        { from: "lb", to: "web" },
        { from: "web", to: "cache" },
      ],
      actions: [
        { id: "lb.look", label: "", serviceId: "lb", category: "investigate", durationS: 1, verdict: "useful" },
        { id: "cache.look", label: "", serviceId: "cache", category: "investigate", durationS: 1, verdict: "useful" },
        { id: "web.undo", label: "", serviceId: "web", category: "fix", durationS: 1, verdict: "useful" },
      ],
    } as typeof slowLeak;
    const items = (timeline: TimelineEntry[]) =>
      checklist(other, timeline, RUNNING, NONE)
        .filter((i) => i.done)
        .map((i) => i.id);
    expect(items([doneAction(10, "cache.look")])).toEqual([]);
    expect(items([doneAction(10, "lb.look")])).toEqual(["impact"]);
    expect(items([doneAction(10, "lb.look"), doneAction(20, "cache.look"), doneAction(30, "web.undo")])).toEqual(["impact", "hypothesis", "mitigate"]);
  });

  it("ticks everything for a full, tidy run", () => {
    const r = replay(slowLeak, 1, [
      at(20, ACK),
      at(20, "edge.error_log"),
      at(50, "checkout.pool_stats"),
      at(90, "checkout.deploys"),
      at(120, "global.status_update"),
      at(170, "checkout.rollback"),
    ]);
    expect(r.outcome).toBe("resolved");
    expect(done(r.timeline, "resolved", { browserOpened: false, postmortemOpened: true })).toEqual([
      "ack",
      "impact",
      "hypothesis",
      "mitigate",
      "verify",
      "communicate",
      "close",
    ]);
  });
});
