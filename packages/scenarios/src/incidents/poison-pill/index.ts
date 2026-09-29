import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident, type Golden } from "../../kit/incident";
import { confirmationsDesktop, reservationsDesktop } from "./desktop";
import { poisonPill } from "./scenario";
import { confirmations, reservations } from "./variants";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** RabbitMQ: the crash log names the message, and it is moved to the dead-letter queue. */
const confirmationsGolden: Golden = {
  perfect: [at(0, inspectAction("laptop.slack.infra")), at(20, ACK), at(20, "queue.depth"), at(70, "consumer.crash_query"), at(120, "queue.dlq_move")],
  masking: [at(20, ACK), at(20, "consumer.restart"), at(3000, "consumer.crash_query"), at(3050, "queue.dlq_move")],
  herring: [at(20, ACK), at(20, "consumer.deploys"), at(60, "partner.status"), at(100, "consumer.scale"), at(300, "queue.purge"), at(2000, "consumer.crash_query"), at(2050, "queue.dlq_move")],
};

/**
 * Kafka: the crash log names no partition, so the player describes the consumer group in the DB console,
 * reads the record at the stuck offset, and skips that one offset.
 */
const reservationsGolden: Golden = {
  perfect: [at(0, inspectAction("laptop.slack.infra")), at(20, ACK), at(20, "queue.depth"), at(65, "queue.describe"), at(110, "queue.read_record"), at(155, "queue.skip_offset")],
  masking: [at(20, ACK), at(20, "consumer.restart"), at(3000, "queue.describe"), at(3050, "queue.read_record"), at(3100, "queue.skip_offset")],
  herring: [at(20, ACK), at(20, "consumer.deploys"), at(60, "partner.status"), at(100, "consumer.scale"), at(300, "queue.reset_group"), at(2000, "queue.describe"), at(2050, "queue.read_record"), at(2100, "queue.skip_offset")],
};

/** One malformed message blocks a queue's consumers; the queue backs up and customers see an error (M4 research G1). */
export const poisonPillIncident = defineIncident({
  id: "poison-pill",
  title: "The Poison Pill",
  family: "queues",
  difficulty: 3,
  from: "2026-10-03",
  variants: [
    { key: confirmations.key, scenario: poisonPill(confirmations), desktop: confirmationsDesktop, golden: confirmationsGolden, spoilers: ["dead-letter", "dead letter", "poison", "bad message", "dlq"] },
    { key: reservations.key, scenario: poisonPill(reservations), desktop: reservationsDesktop, golden: reservationsGolden, spoilers: ["skip", "offset", "stuck", "bad record", "partition 3", "reset-offsets", "--to-offset"] },
  ],
});
