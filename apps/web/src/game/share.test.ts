import { ACK, inspectAction, replay } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { describe, expect, it } from "vitest";
import { shareText } from "./share";

const perfect = replay(slowLeak, 1, [
  { tick: 0, actionId: inspectAction("laptop.slack.deploys") },
  { tick: 20, actionId: ACK },
  { tick: 20, actionId: "checkout.pool_stats" },
  { tick: 60, actionId: "checkout.deploys" },
  { tick: 90, actionId: "checkout.rollback" },
]);

describe("shareText (parent spec §7)", () => {
  it("is spoiler-free: burn, mitigation, one square per action verdict, and whether the cause was found", () => {
    expect(shareText(slowLeak, perfect, "https://pitwall.example")).toBe(
      ["Pit Wall On-Call · The Slow Leak", "Budget burned: 2.5%   Mitigated: 0:38", "🟩🟩🟩  root cause ✔", "https://pitwall.example"].join("\n"),
    );
  });

  it("marks wasted time yellow and harmful actions red, and says when time ran out", () => {
    const messy = replay(slowLeak, 1, [
      { tick: 20, actionId: ACK },
      { tick: 20, actionId: "payments.status" },
      { tick: 60, actionId: "checkout.restart" },
    ]);
    const text = shareText(slowLeak, messy, "https://pitwall.example");
    expect(text).toContain("Mitigated: out of time");
    expect(text).toContain("🟨🟥  root cause ✘");
  });
});
