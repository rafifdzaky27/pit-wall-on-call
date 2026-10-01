import { cliFirstWord, cliFor, normaliseCli } from "./cli";

/** What the matcher needs from an action (a subset of ActionDef). */
export interface MatchableAction {
  id: string;
  cli?: string;
  cliVars?: (s: never) => Record<string, string | number>;
  cliKeys?: string[];
}

export interface ServiceName {
  id: string;
  label: string;
}

/**
 * A typed command in canonical form: normalised (see normaliseCli), and a service's map label after
 * `deployment/` or `app=` replaced by its id, so either name works everywhere (M6 review C2).
 */
export function canonicalCli(input: string, services: readonly ServiceName[]): string {
  const byName = new Map<string, string>();
  for (const s of services) {
    byName.set(s.label.toLowerCase(), s.id.toLowerCase());
    byName.set(s.id.toLowerCase(), s.id.toLowerCase());
  }
  return normaliseCli(input).replace(/(deployment\/|app=)([a-z0-9._-]+)/g, (whole, prefix: string, name: string) => {
    const id = byName.get(name);
    return id ? prefix + id : whole;
  });
}

const WORD = "a-z0-9_./-";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether `key` appears in `text` as a whole word (letters, digits and `_./-` belong to a word). */
function hasWord(text: string, key: string): boolean {
  return new RegExp(`(^|[^${WORD}])${escape(key)}($|[^${WORD}])`).test(text);
}

function fill(key: string, action: MatchableAction, state: unknown, services: readonly ServiceName[]): string {
  const filled = cliFor({ cli: key, cliVars: action.cliVars as ((s: unknown) => Record<string, string | number>) | undefined }, state) ?? key;
  return canonicalCli(filled, services).replace(/^"|"$/g, "");
}

/**
 * The action a typed command means, or undefined (M6 review C1). An action without `cliKeys` matches
 * only its whole command; a keyed action matches any command with the same command word that contains
 * every key as a whole word, whatever else is typed (flags, quoting, a host). When two keyed actions
 * match, the one with more keys wins; a tie means the input is ambiguous and matches nothing.
 */
export function matchCli<A extends MatchableAction>(actions: readonly A[], input: string, state: unknown, services: readonly ServiceName[]): A | undefined {
  const typed = canonicalCli(input, services);
  if (typed === "") return undefined;
  const exact = actions.find((a) => {
    const cli = cliFor(a as { cli?: string; cliVars?: (s: unknown) => Record<string, string | number> }, state);
    return cli !== undefined && canonicalCli(cli, services) === typed;
  });
  if (exact) return exact;
  const word = cliFirstWord(typed);
  const keyed = actions
    .filter((a) => a.cli && a.cliKeys && a.cliKeys.length > 0 && cliFirstWord(a.cli) === word)
    .filter((a) => a.cliKeys!.every((k) => hasWord(typed, fill(k, a, state, services))))
    .sort((x, y) => y.cliKeys!.length - x.cliKeys!.length);
  if (keyed.length === 0) return undefined;
  if (keyed.length > 1 && keyed[0]!.cliKeys!.length === keyed[1]!.cliKeys!.length) return undefined;
  return keyed[0];
}

/**
 * Hard mode's `help` (M6 spec H7, review C1): every command family the content uses, with generic
 * placeholders, and the Postgres functions a fix may call. The same on every shift, so it gives no
 * incident away; a word here counts as something the player can learn.
 */
export const CLI_HELP: readonly string[] = [
  "Type the commands you would run at work. The same tools work on every shift.",
  "",
  "Look around:",
  "  runbook                                     the checks you can run right now",
  "  kubectl logs deployment/<service> --since=15m [| grep -i <word>]",
  "  kubectl describe deployment/<service>",
  "  kubectl top pods -l app=<service>",
  "  kubectl rollout history deployment/<service>",
  "",
  "Change things:",
  "  kubectl rollout undo deployment/<service>",
  "  kubectl rollout restart deployment/<service>",
  "  kubectl scale deployment/<service> --replicas=<n>",
  "  kubectl set env deployment/<service> <KEY>=<value>",
  "  kubectl exec deployment/<service> -- config set <key> = <value>",
  "  kubectl patch pvc <volume> ...      kubectl apply -f <file>",
  "  flagctl enable|disable <flag>",
  "  patronictl failover --candidate <replica>",
  "  logrotate -f <config>               rm -rf <path>",
  "",
  "Data stores:",
  '  psql [-h <host>] -c "<SQL>"         e.g. pg_terminate_backend(<pid>), pg_cancel_backend(<pid>),',
  "                                      pg_drop_replication_slot('<slot>'), UPDATE <table> SET ...",
  "  redis-cli [-h <host>] <command>     e.g. FLUSHALL, FLUSHDB, INFO",
  "  kafka-consumer-groups.sh --group <group> --reset-offsets --to-offset <offset> --execute",
  "  rabbitmqadmin ... --message-id <id>     rabbitmqctl purge_queue <queue>",
  "",
  "Incident process:",
  '  incidentctl status-page "<message>"     incidentctl page secondary     incidentctl rubber-duck',
  "",
  "<service> is a name on the service map (type services). Values like a slot, a pid, an offset or a",
  "config key come from what you find: logs, findings, chat. A command only works on something you have found.",
  "",
  "Builtins: help, runbook, ack, status, services, history, clear",
  "Tab completes tool names and services. Up and Down recall lines. Ctrl+L clears the screen. Ctrl+C cancels the line.",
];
