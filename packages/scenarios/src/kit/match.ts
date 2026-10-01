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
  return normaliseCli(input)
    .replace(/\s*=\s*/g, "=")
    .replace(/(^|[^a-z0-9_.-])(?:deploy|deployments)\//g, "$1deployment/")
    .replace(/(^|[\s"=])\.\//g, "$1")
    .replace(/(deployment\/|app=)([a-z0-9._-]+)/g, (whole, prefix: string, name: string) => {
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

/**
 * Whether a key is in the line. `a|b` accepts either. A pair `setting=v1|v2` needs the setting given
 * exactly one value, one of those listed, and no loose values stacked after it (`= 0 1 2`): so a
 * player cannot try several values in one line (review 2, I2).
 */
function hasKey(text: string, key: string): boolean {
  const eq = key.indexOf("=");
  if (eq <= 0) return key.split("|").some((alt) => hasWord(text, alt));
  const name = key.slice(0, eq);
  const values = key.slice(eq + 1).split("|");
  const given = [...text.matchAll(new RegExp(`(?:^|[^${WORD}])${escape(name)}=([^\\s"';&]+)(\\s+[^\\s"';&]+)?`, "g"))];
  if (given.length === 0) return false;
  const distinct = new Set(given.map((g) => g[1]));
  if (distinct.size !== 1 || !values.includes(given[0]![1]!)) return false;
  // A loose value after the pair (`= 0 1 2`) is a second try in the same line.
  return given.every((g) => {
    const next = g[2]?.trim();
    return next === undefined || !(values.includes(next) || /^[0-9.]+%?$/.test(next));
  });
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
  // A dry run only prints what it would do (review 2, I3).
  if (/(^|\s)--dry-run(=(client|server|true))?(\s|$)/.test(typed)) return undefined;
  const word = cliFirstWord(typed);
  // An incidentctl message is free text: words inside its quotes are never keys (review 2, I4).
  const keyText = word === "incidentctl" ? typed.replace(/"[^"]*"/g, '""') : typed;
  const keyed = actions
    .filter((a) => a.cli && a.cliKeys && a.cliKeys.length > 0 && cliFirstWord(a.cli) === word)
    .filter((a) => a.cliKeys!.every((k) => hasKey(keyText, fill(k, a, state, services))))
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
  "                                      ALTER SYSTEM SET <setting> = <value>,",
  "                                      pg_drop_replication_slot('<slot>'), UPDATE <table> SET ...",
  "  redis-cli [-h <host>] <command>     e.g. FLUSHALL, FLUSHDB, INFO",
  "  kafka-consumer-groups.sh --group <group> --reset-offsets --to-offset <offset> | --to-latest --execute",
  "  rabbitmqadmin move message ... --message-id <id>     rabbitmqctl purge_queue <queue>",
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
