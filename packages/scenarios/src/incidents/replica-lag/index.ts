import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident, type Golden } from "../../kit/incident";
import { analyticsDesktop, migrationDesktop } from "./desktop";
import { replicaLag } from "./scenario";
import { analytics, migration } from "./variants";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

const golden: Golden = {
  perfect: [at(0, inspectAction("laptop.slack.infra")), at(20, ACK), at(20, "replica.lag"), at(70, "db.long_running"), at(120, "db.stop_job")],
  masking: [at(20, ACK), at(20, "db.cache_flush"), at(3000, "db.long_running"), at(3050, "db.stop_job")],
  herring: [at(20, ACK), at(20, "api.deploys"), at(60, "cache.stats"), at(100, "api.route_primary"), at(300, "db.failover"), at(2000, "db.long_running"), at(2050, "db.stop_job")],
};

/** A long job on the primary floods the replica, which the site reads from; customers see stale data and an error (M4 research D1). */
export const replicaLagIncident = defineIncident({
  id: "replica-lag",
  title: "Replica Lag Shows Old Carts",
  family: "data",
  difficulty: 4,
  from: "2026-10-03",
  variants: [
    { key: analytics.key, scenario: replicaLag(analytics), desktop: analyticsDesktop, golden },
    { key: migration.key, scenario: replicaLag(migration), desktop: migrationDesktop, golden },
  ],
});
