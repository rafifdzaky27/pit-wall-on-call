import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident, type Golden } from "../../kit/incident";
import { confirmationsDesktop, reservationsDesktop } from "./desktop";
import { poisonPill } from "./scenario";
import { confirmations, reservations } from "./variants";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** The same players for both variants: only the hotspot the perfect player reads first differs in name, not in id. */
const golden: Golden = {
  perfect: [at(0, inspectAction("laptop.slack.infra")), at(20, ACK), at(20, "queue.depth"), at(70, "consumer.crash_query"), at(120, "queue.dlq_move")],
  masking: [at(20, ACK), at(20, "consumer.restart"), at(3000, "consumer.crash_query"), at(3050, "queue.dlq_move")],
  herring: [at(20, ACK), at(20, "consumer.deploys"), at(60, "partner.status"), at(100, "consumer.scale"), at(300, "queue.purge"), at(2000, "consumer.crash_query"), at(2050, "queue.dlq_move")],
};

/** One malformed message blocks a queue's consumers; the queue backs up and customers see an error (M4 research G1). */
export const poisonPillIncident = defineIncident({
  id: "poison-pill",
  title: "The Poison Pill",
  family: "queues",
  difficulty: 3,
  from: "2026-10-03",
  variants: [
    { key: confirmations.key, scenario: poisonPill(confirmations), desktop: confirmationsDesktop, golden },
    { key: reservations.key, scenario: poisonPill(reservations), desktop: reservationsDesktop, golden },
  ],
});
