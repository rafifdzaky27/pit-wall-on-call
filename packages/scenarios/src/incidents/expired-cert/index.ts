import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident } from "../../kit/incident";
import { expiredCertMeshDesktop, expiredCertPaymentsDesktop } from "./desktop";
import { makeScenario, VARIANTS } from "./scenario";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

const [paymentsVariant, meshVariant] = VARIANTS as [(typeof VARIANTS)[number], (typeof VARIANTS)[number]];

/** A certificate expires and every handshake on one hop fails: which hop, and where it is renewed, changes per variant (M4 research C4). */
export const expiredCertIncident = defineIncident({
  id: "expired-cert",
  title: "The Expired Cert",
  family: "dependencies",
  difficulty: 3,
  from: "2026-10-03",
  variants: [
    {
      key: "",
      scenario: makeScenario(paymentsVariant),
      desktop: expiredCertPaymentsDesktop,
      golden: {
        perfect: [at(0, inspectAction("laptop.slack.infra")), at(20, ACK), at(20, "checkout.tls_errors"), at(55, "checkout.deploys"), at(85, "checkout.rollout_cert")],
        masking: [at(20, ACK), at(20, "edge.restart"), at(3400, "checkout.rollout_cert")],
        herring: [at(20, ACK), at(20, "checkout.rollback_deploy"), at(330, "checkout.raise_retries"), at(490, "checkout.disable_verify"), at(650, "checkout.tls_errors"), at(700, "checkout.rollout_cert")],
      },
    },
    {
      key: meshVariant.key,
      scenario: makeScenario(meshVariant),
      desktop: expiredCertMeshDesktop,
      golden: {
        perfect: [at(0, inspectAction("laptop.slack.infra")), at(20, ACK), at(20, "checkout.tls_errors"), at(55, "stock.deploys"), at(85, "stock.reissue_cert")],
        masking: [at(20, ACK), at(20, "checkout.restart"), at(3400, "stock.reissue_cert")],
        herring: [at(20, ACK), at(20, "stock.rollback_deploy"), at(330, "postgres.status"), at(370, "checkout.disable_verify"), at(530, "checkout.tls_errors"), at(580, "stock.reissue_cert")],
      },
    },
  ],
});
