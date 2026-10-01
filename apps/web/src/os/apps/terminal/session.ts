/** One line in the terminal's scrollback. A `run` entry is a dispatched command: its output is read from the run. */
export interface TermEntry {
  kind: "in" | "out" | "err" | "muted" | "run";
  text: string;
  actionId?: string;
}

/**
 * What the Terminal keeps for one shift (M6 spec H3): the scrollback and the lines typed. It lives in the
 * OS, which starts over with every shift, so closing the window keeps it and a new shift clears it.
 */
export interface TerminalSession {
  entries: TermEntry[];
  history: string[];
}

export const NEW_TERMINAL_SESSION: TerminalSession = {
  entries: [{ kind: "muted", text: "Type help for the tools, or ack to take the page." }],
  history: [],
};
