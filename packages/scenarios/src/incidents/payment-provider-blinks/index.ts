import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident } from "../../kit/incident";
import { blinksDesktop } from "./desktop";
import { BLINKS_VARIANTS, paymentProviderBlinks } from "./scenario";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** A third party degrades; the right move is a fallback, not a restart (M4 research C1). */
export const paymentProviderBlinksIncident = defineIncident({
  id: "payment-provider-blinks",
  title: "The Payment Provider Blinks",
  family: "dependencies",
  difficulty: 2,
  from: "2026-10-03",
  variants: BLINKS_VARIANTS.map((v) => ({
    key: v.key,
    scenario: paymentProviderBlinks(v),
    desktop: blinksDesktop(v),
    golden: {
      perfect: [at(0, inspectAction("phone.mention")), at(20, ACK), at(20, "payments.timeouts"), at(50, "global.provider_status"), at(100, "checkout.enable_fallback")],
      masking: [at(20, ACK), at(20, "checkout.restart"), at(1500, "checkout.enable_fallback")],
      herring: [at(20, ACK), at(20, v.herring === "deploy" ? "checkout.rollback" : "postgres.cancel_report"), at(400, "checkout.restart"), at(900, "checkout.enable_fallback")],
    },
  })),
});
