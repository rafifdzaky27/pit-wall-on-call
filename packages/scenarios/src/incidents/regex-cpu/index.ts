import { ACK, inspectAction, type ActionRecord } from "@pitwall/engine";
import { defineIncident } from "../../kit/incident";
import { regexCpuDesktop } from "./desktop";
import { REGEX_VARIANTS, regexCpu } from "./scenario";

const at = (tick: number, actionId: string): ActionRecord => ({ tick, actionId });

/** A config change ships a backtracking regex, and one layer's CPU pegs (M4 research A2). */
export const regexCpuIncident = defineIncident({
  id: "regex-cpu",
  title: "The Regex That Ate the CPU",
  family: "deploys",
  difficulty: 3,
  from: "2026-10-03",
  variants: REGEX_VARIANTS.map((v) => ({
    key: v.key,
    scenario: regexCpu(v),
    desktop: regexCpuDesktop(v),
    golden: {
      perfect: [at(0, inspectAction("laptop.slack.deploys")), at(20, ACK), at(20, "rule.cpu"), at(60, "rule.logs"), at(90, "rule.config_history"), at(120, "rule.config_rollback")],
      masking: [at(20, ACK), at(20, "rule.scale_out"), at(3400, "rule.config_rollback")],
      herring: [at(20, ACK), at(20, "traffic.compare"), at(60, "job.report"), at(100, "shop.deploys"), at(140, "rule.scale_out"), at(350, "rule.restart"), at(700, "rule.config_history"), at(740, "rule.config_rollback")],
    },
  })),
});
