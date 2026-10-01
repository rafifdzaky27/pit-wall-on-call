/**
 * Hard mode's command matching (M6 spec H5). An input and an action's `cli` match when their
 * normalised forms are equal: lowercased (SQL keywords and identifiers are case-insensitive here),
 * whitespace collapsed outside quotes, single and double quotes treated alike, trailing semicolons
 * dropped. Quoted text keeps its spacing.
 */
export function normaliseCli(input: string): string {
  let out = "";
  let quote: string | null = null;
  let space = false;
  for (const ch of input.trim()) {
    if (quote) {
      if (ch === quote) {
        // A statement's own trailing semicolon is optional: "SELECT 1;" and "SELECT 1" match.
        out = out.replace(/[\s;]+$/, "") + '"';
        quote = null;
      } else out += ch === "'" || ch === '"' ? '"' : ch.toLowerCase();
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (space) out += " ";
      space = false;
      out += '"';
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      space = out.length > 0;
      continue;
    }
    if (space) out += " ";
    space = false;
    out += ch.toLowerCase();
  }
  // Trailing semicolons (and the spaces between them) outside quotes are noise.
  return quote ? out : out.replace(/[\s;]+$/, "");
}

/** The command word, lowercased: what Tab completes and what "command not found" names. */
export function cliFirstWord(input: string): string {
  return input.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

/** Every quote that opens also closes, with the other kind allowed inside. */
export function cliIsBalanced(input: string): boolean {
  let quote: string | null = null;
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
  }
  return quote === null;
}

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

/** The `{name}` placeholders in a cli, in order. */
export function cliPlaceholders(cli: string): string[] {
  return [...cli.matchAll(PLACEHOLDER)].map((m) => m[1]!);
}

/**
 * An action's command for this run: its `cli` with `{name}` placeholders filled from `cliVars(state)`
 * (a session pid, a stuck offset). Undefined when the action has no command (a teammate question).
 */
export function cliFor<S>(action: { cli?: string; cliVars?: (s: S) => Record<string, string | number> }, state: S): string | undefined {
  if (action.cli === undefined) return undefined;
  if (!action.cliVars) return action.cli;
  const vars = action.cliVars(state);
  return action.cli.replace(PLACEHOLDER, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}
