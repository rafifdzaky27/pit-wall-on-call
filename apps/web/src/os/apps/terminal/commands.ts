import type { RejectReason, ScenarioDef, State } from "@pitwall/engine";
import { CLI_VOCABULARY, cliFirstWord, cliFor, normaliseCli } from "@pitwall/scenarios";
import type { IncidentPhase } from "../../incident/IncidentProvider";

/** One line of terminal output. `err` is for refusals, `muted` for hints. */
export interface TermLine {
  kind: "out" | "err" | "muted";
  text: string;
}

export interface TerminalCtx {
  scenario: ScenarioDef<State>;
  phase: IncidentPhase;
  /** Whether the action is on offer now (its target found): the same rule that hides buttons. */
  offers: (actionId: string) => boolean;
  check: (actionId: string) => RejectReason | null;
  /** The lines typed this shift, oldest first. */
  history: readonly string[];
  /** The objective, budget and clock, in words. */
  status: () => string[];
  /** The global command vocabulary (defaults to every scenario's first words). */
  vocabulary?: readonly string[];
  /** The run's current scenario state, for commands that name per-run values (`cliVars`). */
  state?: () => State;
}

export interface TerminalResult {
  lines: TermLine[];
  /** An action to dispatch, when the line was a command that is on offer. */
  dispatch?: string;
  ack?: boolean;
  clear?: boolean;
}

/** Terminal builtins (M6 spec H7). */
export const BUILTINS = ["ack", "clear", "help", "history", "services", "status"] as const;

const out = (text: string): TermLine => ({ kind: "out", text });
const err = (text: string): TermLine => ({ kind: "err", text });
const muted = (text: string): TermLine => ({ kind: "muted", text });

/** The same for every incident: tool families with placeholders, never a scenario's own commands (H7). */
export const HELP_LINES: readonly string[] = [
  "Type the commands you would run at work. The same tools work on every shift.",
  "",
  "  kubectl logs deployment/<service> --since=15m",
  "  kubectl describe deployment/<service>",
  "  kubectl top pods -l app=<service>",
  '  psql -c "<SQL>"',
  "  redis-cli <args>",
  "  curl -s <url>",
  "  flagctl <enable|disable> <flag>",
  "  incidentctl <verb> ...",
  "",
  "Names for <service> are on the service map: type services to list them.",
  "Look at the dashboards, logs and chat first. A command only works on something you have found.",
  "",
  "Builtins: help, ack, status, services, history, clear",
  "Tab completes tool names and services. Up and Down recall lines. Ctrl+L clears. Ctrl+C cancels the line.",
];

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length]!;
}

/** Close words from the builtins and the global vocabulary only, never from this shift's commands (H6). */
function suggestions(word: string, vocabulary: readonly string[]): string[] {
  const pool = [...new Set([...BUILTINS, ...vocabulary])];
  return pool
    .map((w) => [w, distance(word, w)] as const)
    .filter(([, d]) => d > 0 && d <= 2)
    .sort((x, y) => x[1] - y[1] || x[0].localeCompare(y[0]))
    .slice(0, 3)
    .map(([w]) => w);
}

const HINT = "Not sure of the syntax? Type help.";

/**
 * What the tool says about a thing it cannot see. Used for a command that is not on offer yet and for
 * one that matches nothing alike, so a guess never tells you whether a fix exists (H5). Only the tool
 * family (the word typed) and a deployment name the player typed themselves ever appear in it.
 */
function notFound(line: string, word: string): TermLine[] {
  switch (word) {
    case "kubectl": {
      const name = /\bdeployments?(?:\.apps)?\/([\w.-]+)/i.exec(line)?.[1];
      return [err(name ? `Error from server (NotFound): deployments.apps "${name.toLowerCase()}" not found` : "Error from server (NotFound): the server could not find the requested resource"), muted(HINT)];
    }
    case "psql":
      return [err("ERROR: the object this statement refers to does not exist"), muted(HINT)];
    case "redis-cli":
      return [err("(error) ERR no such key or command"), muted(HINT)];
    case "curl":
      return [err("curl: (6) Could not resolve host"), muted(HINT)];
    case "openssl":
      return [err("connect: Connection refused"), muted(HINT)];
    default:
      return [err(`${word}: no such target`), muted(HINT)];
  }
}

function refusal(reason: RejectReason): string {
  switch (reason) {
    case "busy":
      return "another operation is in progress";
    case "not_acknowledged":
      return "the page is not acknowledged yet: type ack";
    case "pending":
      return "that is already running";
    case "finished":
      return "the incident is over";
    default:
      return "that cannot run right now";
  }
}

/** Reads one typed line (M6 spec H5 to H9). The caller dispatches, acknowledges or clears as asked. */
export function runLine(line: string, ctx: TerminalCtx): TerminalResult {
  const typed = line.trim();
  if (typed === "") return { lines: [] };
  const word = cliFirstWord(typed);
  const vocabulary = ctx.vocabulary ?? CLI_VOCABULARY;

  switch (typed.toLowerCase()) {
    case "help":
      return { lines: HELP_LINES.map(out) };
    case "ack":
      return ctx.phase === "paging" ? { lines: [out("Page acknowledged.")], ack: true } : { lines: [muted(ctx.phase === "active" ? "Nothing to acknowledge: you already have the page." : "Nothing to acknowledge yet.")] };
    case "status":
      return { lines: ctx.status().map(out) };
    case "services":
      return {
        lines: ctx.scenario.services.map((s) => out(s.id === s.label ? s.label : `${s.id.padEnd(14)}${s.label}`)),
      };
    case "history":
      return { lines: ctx.history.length === 0 ? [muted("No commands yet this shift.")] : ctx.history.map((h, i) => out(`${i + 1}  ${h}`)) };
    case "clear":
      return { lines: [], clear: true };
  }

  const wanted = normaliseCli(typed);
  const state = ctx.state?.() ?? ({} as State);
  const action = ctx.scenario.actions.find((a) => {
    const cli = a.cliVars && !ctx.state ? undefined : cliFor(a, state);
    return cli !== undefined && normaliseCli(cli) === wanted;
  });
  if (action && ctx.offers(action.id)) {
    const reason = ctx.check(action.id);
    return reason ? { lines: [err(refusal(reason))] } : { lines: [], dispatch: action.id };
  }
  if (vocabulary.includes(word) || action) return { lines: notFound(typed, word) };

  const close = suggestions(word, vocabulary);
  return { lines: [err(`${word}: command not found`), ...(close.length > 0 ? [muted(`Did you mean: ${close.join(", ")}?`)] : [])] };
}

/** The longest prefix every option starts with. */
function commonPrefix(options: readonly string[]): string {
  let prefix = options[0] ?? "";
  for (const o of options) while (!o.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix;
}

export interface Completion {
  /** The whole line after completing. Unchanged when there is nothing to add. */
  text: string;
  /** The candidates, when more than one fits. */
  options: string[];
}

/**
 * Tab (M6 spec H8): the first word from the builtins and the global vocabulary; a service name after
 * `deployment/` or `app=`. Nothing else completes: a slot, a flag or a value is for the player to find.
 */
export function complete(input: string, ctx: Pick<TerminalCtx, "scenario" | "vocabulary">): Completion {
  const vocabulary = ctx.vocabulary ?? CLI_VOCABULARY;
  const none: Completion = { text: input, options: [] };
  const apply = (head: string, prefix: string, pool: readonly string[], tail: string): Completion => {
    const options = [...new Set(pool.filter((w) => w.toLowerCase().startsWith(prefix.toLowerCase())))].sort();
    if (options.length === 0) return none;
    const common = options.length === 1 ? options[0]! : commonPrefix(options);
    return { text: `${head}${common}${options.length === 1 ? tail : ""}`, options: options.length > 1 ? options : [] };
  };

  if (!/\s/.test(input)) return apply("", input, [...BUILTINS, ...vocabulary], " ");

  const services = ctx.scenario.services.flatMap((s) => [s.id, s.label]);
  const match = /^(.*(?:\bdeployments?\/|\bapp=))([\w.-]*)$/i.exec(input);
  return match ? apply(match[1]!, match[2]!, services, "") : none;
}
