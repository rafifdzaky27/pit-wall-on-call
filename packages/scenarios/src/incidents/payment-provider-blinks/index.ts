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
    spoilers: v.spoilers,
    golden: {
      perfect:
        v.mechanism === "exempt"
          ? [at(0, inspectAction("phone.mention")), at(20, ACK), at(20, "payments.timeouts"), at(50, "checkout.payment_config"), at(80, "orders.value_split"), at(110, "checkout.enable_fallback")]
          : [at(0, inspectAction("phone.mention")), at(20, ACK), at(20, "payments.timeouts"), at(50, "checkout.payment_config"), at(100, "checkout.enable_fallback")],
      masking: [at(20, ACK), at(20, "checkout.restart"), at(1500, "checkout.payment_config"), at(1550, "checkout.enable_fallback")],
      herring: [at(20, ACK), at(20, v.herring === "db" ? "postgres.cancel_report" : "checkout.rollback"), at(400, "checkout.restart"), at(900, "checkout.payment_config"), at(950, "checkout.enable_fallback")],
    },
  })),
});
