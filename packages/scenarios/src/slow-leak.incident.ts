import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident } from "./kit/incident";
import { slowLeak } from "./slow-leak";
import { slowLeakDesktop } from "./slow-leak.desktop";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** A deploy leaks database connections; the loud database is a victim (M1, M4 research A1). */
export const slowLeakIncident = defineIncident({
  id: "db-pool-exhaustion",
  title: "The Slow Leak",
  family: "deploys",
  difficulty: 3,
  from: "2026-10-01",
  variants: [
    {
      key: "",
      scenario: slowLeak,
      desktop: slowLeakDesktop,
      spoilers: ["leak", "connection pool"],
      golden: {
        perfect: [at(0, inspectAction("laptop.slack.deploys")), at(20, ACK), at(20, "checkout.pool_stats"), at(60, "checkout.deploys"), at(90, "checkout.rollback")],
        masking: [at(20, ACK), at(20, "checkout.restart"), at(3200, "checkout.rollback")],
        herring: [at(20, ACK), at(20, "postgres.connections"), at(50, "postgres.raise_max_conns"), at(250, "postgres.failover"), at(550, "checkout.restart"), at(700, "checkout.rollback")],
      },
    },
  ],
});
