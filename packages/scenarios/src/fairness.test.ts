import { ACK, INSPECT_PREFIX, replay, Run, type ActionRecord, type ScenarioDef, type State } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import type { IncidentVariant } from "./kit/incident";
import { INCIDENTS } from "./registry";

/** Hard but fair, for every variant of every incident (M4 spec N4, N6). */
const cases = INCIDENTS.flatMap((inc) => inc.variants.map((v) => [v.scenario.id, v as IncidentVariant] as const));
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const toolOf = (s: ScenarioDef<State>, id: string) => s.actions.find((a) => a.id === id)?.tool ?? "dashboards";
const playerActions = (list: ActionRecord[]) => list.filter((a) => a.actionId !== ACK && !a.actionId.startsWith(INSPECT_PREFIX));

describe.each(cases)("%s", (_id, v) => {
  const s = v.scenario;

  it("the perfect player resolves under par, finding the root cause, on every seed", () => {
    for (const seed of SEEDS) {
      const r = replay(s, seed, v.golden.perfect);
      expect(r.outcome, `seed ${seed}`).toBe("resolved");
      expect(r.rootCauseFound, `seed ${seed}`).toBe(true);
      expect(r.budgetBurnedBp, `seed ${seed}`).toBeLessThanOrEqual(s.parBp);
    }
  });

  it("doing nothing runs out of time", () => {
    expect(replay(s, 1, []).outcome).toBe("dnf");
  });

  it("masking the symptom and chasing the red herring both score worse than the fix", () => {
    for (const seed of SEEDS.slice(0, 5)) {
      const best = replay(s, seed, v.golden.perfect).budgetBurnedBp;
      for (const [name, list] of [["masking", v.golden.masking], ["herring", v.golden.herring]] as const) {
        const r = replay(s, seed, list);
        expect(r.outcome === "dnf" || r.budgetBurnedBp > best, `${name}, seed ${seed}`).toBe(true);
      }
    }
  });

  it("has a masking action with a note, and a harmful action", () => {
    expect(Object.keys(s.maskNotes ?? {}).length).toBeGreaterThan(0);
    expect(s.actions.some((a) => a.verdict === "harmful")).toBe(true);
  });

  it("is short to solve, and not from Monitoring alone", () => {
    const steps = playerActions(v.golden.perfect);
    expect(steps.length).toBeLessThanOrEqual(6);
    const tools = new Set(steps.map((a) => toolOf(s, a.actionId)));
    expect(tools.size).toBeGreaterThanOrEqual(2);
    expect([...tools].some((t) => t !== "dashboards")).toBe(true);
    for (const id of s.rootCauseActionIds) expect(toolOf(s, id), id).not.toBe("dashboards");
  });

  it("never offers a fix that names the cause before the player has found it (PR 30 review I3)", () => {
    expect(v.spoilers.length, "declare the words that name the cause").toBeGreaterThan(0);
    const run = new Run(s, 1);
    run.dispatch(ACK);
    for (const id of s.rootCauseActionIds) {
      const a = s.actions.find((x) => x.id === id)!;
      const shown = `${a.label} ${a.command ?? ""}`.toLowerCase();
      const names = v.spoilers.filter((w) => shown.includes(w.toLowerCase()));
      if (names.length > 0) expect(run.check(id), `${id} says ${names.join(", ")}, so it waits for its target`).toBe("unavailable");
    }
  });

  it("never names the fix in an alert, a log line or a chat message", () => {
    const fixes = s.rootCauseActionIds.map((id) => s.actions.find((a) => a.id === id)!.label.toLowerCase());
    // Log lines from every kind of play, so lines that appear only after a fix or a mask are seen too (review 3).
    const logs = [v.golden.perfect, v.golden.masking, v.golden.herring, []].flatMap((list) => {
      const run = new Run(s, 1);
      let next = 0;
      while (run.outcome === "running") {
        while (next < list.length && list[next]!.tick === run.snapshot().tick) run.dispatch(list[next++]!.actionId);
        run.step();
      }
      return run.logs.filter((l) => !l.finding).map((l) => l.text);
    });
    const chat = v.desktop.chat.flatMap((m) => ("text" in m ? [m.text] : []));
    const texts = [...s.alerts.flatMap((a) => [a.title, a.description]), ...logs, ...chat].map((t) => t.toLowerCase());
    for (const fix of fixes) for (const t of texts) expect(t, fix).not.toContain(fix);
  });
});
