import type { ScenarioDef, State } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";

/** The commands the unit tests give Slow Leak's actions, so they do not depend on real content. */
export const FIXTURE_CLI: Record<string, string> = {
  "edge.error_log": "kubectl logs deployment/edge --since=15m",
  "checkout.pool_stats": "kubectl top pods -l app=checkout",
  "checkout.deploys": "kubectl rollout history deployment/checkout",
  "checkout.rollback": "kubectl rollout undo deployment/checkout",
  "checkout.restart": "kubectl rollout restart deployment/checkout",
  "postgres.connections": "psql -c \"SELECT pg_drop_replication_slot('reporting_cdc');\"",
  "postgres.raise_max_conns": "flagctl disable zz_secret_flag",
  "global.status_update": 'incidentctl status-page "Investigating checkout errors"',
  "global.ask_secondary": "incidentctl page secondary",
};

/** Words that only this scenario's commands contain: the terminal must never print one. */
export const FIXTURE_SECRETS = ["reporting_cdc", "pg_drop_replication_slot", "zz_secret_flag", "status-page"];

export const fixtureScenario: ScenarioDef<State> = {
  ...slowLeak,
  actions: slowLeak.actions.map((a) => (FIXTURE_CLI[a.id] ? { ...a, cli: FIXTURE_CLI[a.id] } : a)),
};

/** What the global vocabulary would hold for these commands. */
export const FIXTURE_VOCAB = ["flagctl", "incidentctl", "kafka-consumer-groups", "kubectl", "psql", "redis-cli"];
