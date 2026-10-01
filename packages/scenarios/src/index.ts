import { slowLeak } from "./slow-leak";
import { training } from "./training";

export { slowLeak, training };
export { CLI_VOCABULARY, desktopFor, getScenario, INCIDENTS, SCENARIOS } from "./registry";
export { cliFirstWord, cliFor, cliIsBalanced, cliPlaceholders, normaliseCli } from "./kit/cli";
export { canonicalCli, CLI_HELP, matchCli, type MatchableAction, type ServiceName } from "./kit/match";
export { practiceFor } from "./practice";
export { defineIncident, type Family, type Golden, type Incident, type IncidentVariant } from "./kit/incident";
export * from "./desktop";
export { DUCK, DUCK_DONE, duckAction } from "./duck";
export { DAILY_EPOCH, DAY_MS, ROTATION_FROM, dailyFor, dailyNumber, dayStartMs, isDailyDate, utcDate, type Daily } from "./daily";
