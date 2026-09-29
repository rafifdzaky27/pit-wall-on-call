import { ACK, pickLesson, replay, Run, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { cacheStampedeIncident } from "./index";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

describe.each(cacheStampedeIncident.variants.map((v) => [v.scenario.id, v] as const))("%s: golden players", (_id, v) => {
  const s = v.scenario;
  const fix = s.rootCauseActionIds[0]!;

  it("the perfect player gets the default lesson and finds the root cause", () => {
    const r = replay(s, 1, v.golden.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(pickLesson(s, r).id).toBe("default");
  });

  it("raising connections masks the errors, then the keys expire together and the stampede returns", () => {
    const run = new Run(s, 1);
    run.dispatch(ACK);
    run.dispatch("db.raise_conns");
    for (let i = 0; i < 1400; i++) run.step();
    expect(run.snapshot().status).toBe("mitigated");
    for (let i = 0; i < 1800; i++) run.step();
    expect(run.snapshot().status).toBe("investigating");
    const r = replay(s, 1, v.golden.masking);
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("capacity-trap");
  });

  it("restarting redis burns side effects and teaches the harmful lesson", () => {
    const r = replay(s, 1, [at(20, ACK), at(20, "redis.restart"), at(400, fix)]);
    expect(r.burnByTag["side_effect:redis.restart"]).toBeGreaterThan(0);
    expect(pickLesson(s, r).id).toBe("harmful");
    const f = replay(s, 1, [at(20, ACK), at(20, "db.failover"), at(400, fix)]);
    expect(f.burnByTag["side_effect:db.failover"]).toBeGreaterThan(0);
  });

  it("coalescing alone fixes it, whatever emptied the cache", () => {
    const r = replay(s, 1, [at(20, ACK), at(20, "cache.coalesce")]);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
  });

  it("doing nothing gets the dnf lesson and a slow ack gets the ack lesson", () => {
    expect(pickLesson(s, replay(s, 1, [])).id).toBe("dnf");
    expect(pickLesson(s, replay(s, 1, [at(400, ACK), at(400, fix)])).id).toBe("slow-ack");
  });
});

describe("cache-stampede variants differ for the player", () => {
  const [prefix, restart] = cacheStampedeIncident.variants;
  it("has a rollback only when a deploy changed the prefix, and a different service and clue", () => {
    expect(prefix!.scenario.actions.some((a) => a.id === "cache.rollback")).toBe(true);
    expect(restart!.scenario.actions.some((a) => a.id === "cache.rollback")).toBe(false);
    expect(prefix!.scenario.services.map((x) => x.label)).not.toEqual(restart!.scenario.services.map((x) => x.label));
    expect(Object.keys(prefix!.scenario.coldOpen.hotspots)).toContain("laptop.slack.infra");
    expect(prefix!.scenario.coldOpen.hotspots["laptop.slack.infra"]!.kind).toBe("herring");
    expect(restart!.scenario.coldOpen.hotspots["laptop.slack.infra"]!.kind).toBe("clue");
  });
});
