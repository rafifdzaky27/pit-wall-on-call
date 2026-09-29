import { ACK, LOG_CAP, Run, type State } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { slowLeak } from "./slow-leak";

describe("the log cap (M2.5 PR B review I3)", () => {
  it("drops the oldest plain lines, never a finding, so tools keep showing what the player learned", () => {
    const run = new Run<State>(slowLeak, 1);
    run.dispatch(ACK);
    run.dispatch("postgres.connections");
    for (let i = 0; i < 40; i++) run.step();
    const found = run.logs.find((l) => l.finding);
    expect(found).toBeDefined();
    // Run on until far more lines were written than the cap holds.
    while (run.outcome === "running" && run.logs.at(-1)!.seq < LOG_CAP + 500) run.step();
    expect(run.logs.at(-1)!.seq).toBeGreaterThan(LOG_CAP + 100);
    expect(run.logs.length).toBeLessThanOrEqual(LOG_CAP);
    expect(run.logs.some((l) => l.seq === found!.seq)).toBe(true);
  });
});
