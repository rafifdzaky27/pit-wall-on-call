import { ACK, INSPECT_PREFIX } from "@pitwall/engine";
import { describe, expect, it } from "vitest";
import { normaliseCli } from "./kit/cli";
import { INCIDENTS } from "./registry";

/**
 * Hard mode, workstream A1's incidents: every action a golden player takes can be typed, and what
 * is typed matches that action and no other (M6 spec H5). ACK and hotspot inspections are not
 * scenario actions: `ack` is a builtin and inspections are not commands.
 */
const PART_1 = ["db-pool-exhaustion", "disk-full", "expired-cert", "payment-provider-blinks", "retry-storm"];

const variants = INCIDENTS.filter((i) => PART_1.includes(i.id)).flatMap((i) => i.variants.map((v) => ({ name: v.scenario.id, scenario: v.scenario, golden: v.golden })));

describe("hard-mode commands: golden players", () => {
  it("covers every incident of part 1", () => {
    expect([...new Set(INCIDENTS.filter((i) => PART_1.includes(i.id)).map((i) => i.id))].sort()).toEqual([...PART_1].sort());
  });

  describe.each(variants)("$name", ({ scenario, golden }) => {
    for (const player of ["perfect", "masking", "herring"] as const) {
      it(`${player}: each action's cli matches exactly that action`, () => {
        const ids = golden[player].map((r) => r.actionId).filter((id) => id !== ACK && !id.startsWith(INSPECT_PREFIX));
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
          const action = scenario.actions.find((a) => a.id === id);
          expect(action, `${id} is an action of ${scenario.id}`).toBeDefined();
          expect(action!.cli, `${id} has a cli`).toBeTruthy();
          const typed = normaliseCli(action!.cli!);
          const matches = scenario.actions.filter((a) => a.cli && normaliseCli(a.cli) === typed).map((a) => a.id);
          expect(matches, `${id}: ${action!.cli}`).toEqual([id]);
        }
      });
    }
  });
});
