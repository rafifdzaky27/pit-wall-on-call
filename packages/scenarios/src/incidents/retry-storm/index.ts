import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident } from "../../kit/incident";
import { stormDesktop } from "./desktop";
import { retryStorm, STORM_VARIANTS } from "./scenario";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** A brief blip, then callers' retries keep the dependency down after it recovered (M4 research C2). */
export const retryStormIncident = defineIncident({
  id: "retry-storm",
  title: "Retry Storm",
  family: "dependencies",
  difficulty: 4,
  from: "2026-10-03",
  variants: STORM_VARIANTS.map((v) => ({
    key: v.key,
    scenario: retryStorm(v),
    desktop: stormDesktop(v),
    golden: {
      perfect: [at(0, inspectAction("phone.mention")), at(20, ACK), at(20, "caller.retry_logs"), at(60, "caller.fix")],
      masking: [at(20, ACK), at(20, "dep.scale_up"), at(2300, "caller.fix")],
      herring: [at(20, ACK), at(20, v.herring === "dependency_deploy" ? "dep.rollback" : "store.flush"), at(400, "dep.restart"), at(900, "caller.fix")],
    },
  })),
});
