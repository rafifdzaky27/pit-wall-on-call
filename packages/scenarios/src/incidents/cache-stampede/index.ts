import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident } from "../../kit/incident";
import { cacheStampedeDesktop } from "./desktop";
import { CACHE_VARIANTS, cacheStampede } from "./scenario";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** The cache goes cold at once and the database is hammered; the loud database is a victim (M4 research F1). */
export const cacheStampedeIncident = defineIncident({
  id: "cache-stampede",
  title: "Cache Stampede After Restart",
  family: "caching",
  difficulty: 3,
  from: "2026-10-03",
  variants: CACHE_VARIANTS.map((v) => {
    const prefix = v.trigger === "prefix";
    const fix = prefix ? "cache.rollback" : "cache.coalesce";
    return {
      key: v.key,
      scenario: cacheStampede(v),
      desktop: cacheStampedeDesktop(v),
      golden: {
        perfect: [
          at(0, inspectAction(prefix ? "laptop.slack.deploys" : "laptop.slack.infra")),
          at(20, ACK),
          at(20, "redis.stats"),
          at(50, prefix ? "api.deploys" : "redis.maintenance"),
          at(80, fix),
        ],
        masking: [at(20, ACK), at(20, "db.raise_conns"), at(2700, fix)],
        herring: [at(20, ACK), at(20, "db.connections"), at(60, "db.slow_log"), at(100, "db.raise_conns"), at(320, "db.failover"), at(600, "redis.restart"), at(780, "redis.stats"), at(820, fix)],
      },
    };
  }),
});
