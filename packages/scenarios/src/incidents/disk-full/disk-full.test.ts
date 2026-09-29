import { ACK, pickLesson, replay, Run, type ActionRecord } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { diskFullIncident } from "./index";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });
const [logsV, walV] = diskFullIncident.variants.map((v) => v.scenario);
const [logsGolden, walGolden] = diskFullIncident.variants.map((v) => v.golden);

describe("Disk Full: both variants", () => {
  it.each([
    ["logs", logsV!, logsGolden!],
    ["wal", walV!, walGolden!],
  ])("%s: perfect resolves under par with the default lesson; doing nothing is a dnf", (_n, s, g) => {
    const r = replay(s, 1, g.perfect);
    expect(r.outcome).toBe("resolved");
    expect(r.rootCauseFound).toBe(true);
    expect(r.budgetBurnedBp).toBeLessThanOrEqual(s.parBp);
    expect(pickLesson(s, r).id).toBe("default");
    const dnf = replay(s, 1, []);
    expect(dnf.outcome).toBe("dnf");
    expect(pickLesson(s, dnf).id).toBe("dnf");
  });

  it("the variants fill different volumes with different root-cause actions and tools", () => {
    expect(logsV!.rootCauseActionIds).toEqual(["checkout.rollback_config"]);
    expect(walV!.rootCauseActionIds).toEqual(["postgres.drop_slot"]);
    const tool = (s: typeof logsV, id: string) => s!.actions.find((a) => a.id === id)!.tool;
    expect(tool(logsV, "checkout.rollback_config")).toBe("deploys");
    expect(tool(walV, "postgres.drop_slot")).toBe("db");
  });
});

describe("Disk Full (log volume)", () => {
  it("rotating the logs frees the disk, errors stop, then debug logging fills it again", () => {
    const r = replay(logsV!, 1, logsGolden!.masking);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(logsV!, r).id).toBe("rotate-trap");
  });

  it("deleting the files by hand burns side effects and frees nothing", () => {
    const r = replay(logsV!, 1, [at(20, ACK), at(20, "checkout.delete_logs"), at(300, "checkout.deploys"), at(340, "checkout.rollback_config"), at(600, "checkout.rotate_logs")]);
    expect(r.burnByTag["side_effect:checkout.delete_logs"]).toBeGreaterThan(0);
    expect(pickLesson(logsV!, r).id).toBe("delete-trap");
  });

  it("the fix is not offered until the deploy history has been read", () => {
    const run = new Run(logsV!, 1);
    run.dispatch(ACK);
    expect(run.check("checkout.rollback_config")).toBe("unavailable");
    run.dispatch("checkout.deploys");
    for (let i = 0; i < 50; i++) run.step();
    expect(run.check("checkout.rollback_config")).toBeNull();
  });

  it("rolling back the config alone leaves the old files on disk, so it is not resolved until rotated", () => {
    expect(replay(logsV!, 1, [at(20, ACK), at(20, "checkout.deploys"), at(60, "checkout.rollback_config")]).outcome).toBe("dnf");
  });
});

describe("Disk Full (WAL volume)", () => {
  it("the fix is not offered until the replication slots have been inspected", () => {
    const run = new Run(walV!, 1);
    run.dispatch(ACK);
    expect(run.check("postgres.drop_slot")).toBe("unavailable");
    run.dispatch("postgres.slots");
    for (let i = 0; i < 50; i++) run.step();
    expect(run.check("postgres.drop_slot")).toBeNull();
  });

  it("growing the volume buys time, then the stale slot fills it again", () => {
    const r = replay(walV!, 1, walGolden!.masking);
    expect(r.outcome).toBe("resolved");
    expect(r.burnByTag.mitigated_unfixed).toBeGreaterThan(0);
    expect(pickLesson(walV!, r).id).toBe("grow-trap");
  });

  it("deleting WAL files by hand is harmful and gets its lesson", () => {
    const r = replay(walV!, 1, [at(20, ACK), at(20, "postgres.delete_wal"), at(300, "postgres.slots"), at(340, "postgres.drop_slot")]);
    expect(r.burnByTag["side_effect:postgres.delete_wal"]).toBeGreaterThan(0);
    expect(pickLesson(walV!, r).id).toBe("wal-trap");
  });
});
