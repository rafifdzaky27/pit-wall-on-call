import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident } from "../../kit/incident";
import { diskFullLogsDesktop, diskFullWalDesktop } from "./desktop";
import { makeScenario, VARIANTS } from "./scenario";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

const [logsVariant, walVariant] = VARIANTS as [(typeof VARIANTS)[number], (typeof VARIANTS)[number]];

/** A volume fills and writes fail: which one, and so which tool finds it, changes with the variant (M4 research B1). */
export const diskFullIncident = defineIncident({
  id: "disk-full",
  title: "Disk Full at 3AM",
  family: "capacity",
  difficulty: 2,
  from: "2026-10-03",
  variants: [
    {
      key: "",
      scenario: makeScenario(logsVariant),
      desktop: diskFullLogsDesktop,
      spoilers: ["log_level", "log level", "debug", "config"],
      golden: {
        perfect: [at(0, inspectAction("laptop.slack.infra")), at(20, ACK), at(20, "checkout.write_errors"), at(60, "checkout.deploys"), at(90, "checkout.rollback_config"), at(340, "checkout.rotate_logs")],
        masking: [at(20, ACK), at(20, "checkout.rotate_logs"), at(3300, "checkout.deploys"), at(3400, "checkout.rollback_config"), at(3700, "checkout.rotate_logs")],
        herring: [at(20, ACK), at(20, "checkout.clear_tmp"), at(120, "checkout.restart"), at(300, "checkout.delete_logs"), at(480, "checkout.deploys"), at(520, "checkout.rollback_config"), at(800, "checkout.rotate_logs")],
      },
    },
    {
      key: walVariant.key,
      scenario: makeScenario(walVariant),
      desktop: diskFullWalDesktop,
      spoilers: ["replication slot", "slot", "wal", "pg_wal", "cdc"],
      golden: {
        perfect: [at(0, inspectAction("laptop.slack.infra")), at(20, ACK), at(20, "postgres.disk_errors"), at(60, "postgres.slots"), at(90, "postgres.drop_slot")],
        masking: [at(20, ACK), at(20, "postgres.grow_wal"), at(3900, "postgres.slots"), at(4000, "postgres.drop_slot")],
        herring: [at(20, ACK), at(20, "checkout.restart"), at(200, "checkout.rollback"), at(520, "postgres.delete_wal"), at(740, "postgres.slots"), at(800, "postgres.drop_slot")],
      },
    },
  ],
});
