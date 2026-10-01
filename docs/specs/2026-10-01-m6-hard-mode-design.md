# M6: Hard mode (design)

**Date:** 2026-10-01
**Goal:** a second difficulty for players who want no buttons: every action is a typed command in a Terminal app, with its own leaderboards. Decision D18 in the main spec: commands map to the same engine actions, so replay and scoring do not change.

## Decisions

| ID | Decision | Rejected |
|---|---|---|
| H1 | **Difficulty `normal` or `hard`** is a pref (Settings → Gameplay, "Difficulty"). It is read when a shift starts and fixed for that shift; changing it mid-shift says "applies from your next shift". Training is always normal. The status chip shows "Hard" during a hard shift. | A per-shift picker on the notice (one more choice for newcomers) |
| H2 | **In hard mode no action is a button.** The action lists in Monitoring (ActionsPanel), Logs, Deploys, DB console and Incident are replaced by one muted line: "Hard mode: run commands in Terminal". Everything that only *shows* things stays: the service map, metrics, alerts, log stream, #deploys, chat, and the outputs of commands already run. Chat `/ask` slash commands stay, because they are already typed. Acknowledge stays a button on the page notice, and is also `ack` in the terminal. | Hiding the dashboards too (that would be a different game) |
| H3 | **Terminal app**, in the dock only during a hard shift, opened automatically at the first ack. Prompt `oncall@pitwall:~$`. Monospace, scrollback, `clear`, ↑/↓ history (per shift), Ctrl+L clears, Ctrl+C cancels the current input line. It follows DESIGN.md tokens; no emoji or decorative icons. | A full xterm.js emulator (a dependency, and nothing here needs a real TTY) |
| H4 | **Every action gets a `cli` string** (content only, like `command`): a realistic command such as `kubectl rollout undo deployment/checkout`, `psql -c "SELECT pg_drop_replication_slot('reporting_cdc');"`, `redis-cli info stats`, `curl -sI https://payments.example/health`. An action that already has `command` (SQL) uses the same text inside its `cli`. Teammate questions (`ask`) have no `cli`; they stay in chat. | A made-up mini language (`rollback checkout`): not what the player would type at work |
| H5 | **Matching.** Input and `cli` are both normalised: trim, lowercase everything (SQL is case-insensitive for our purposes), collapse whitespace outside quotes, strip a trailing `;`, treat `'` and `"` alike. Exact match after normalisation, against the scenario's actions. A match whose action is **offered** (`run.offers`, the same rule that hides buttons) dispatches it. A match that is not offered yet answers like the real tool would about a thing it cannot see ("Error from server (NotFound)" style, per tool family) and dispatches nothing, so guessing a fix before finding its target gains nothing and reveals nothing. | Fuzzy matching (a near-miss that runs the wrong fix is worse than "not found") |
| H6 | **Unknown input** prints `<cmd>: command not found`. "Did you mean" suggestions come only from builtins and the **global** vocabulary (first words of every `cli` across every scenario, a constant set), never from this scenario's commands. | Suggestions from this scenario (they would list the answer) |
| H7 | **Builtins:** `help` (a fixed cheat sheet of tool families with generic examples using `<service>` placeholders, the same for every incident), `ack`, `status` (objective, budget, elapsed), `services` (the map's service names), `history`, `clear`. | `man` pages per command |
| H8 | **Tab completion** completes the first word from the global vocabulary plus builtins, and service names after a word that takes a service. It never completes a scenario-specific identifier (a slot name, a flag value). | Completing full commands (that is a button list again) |
| H9 | **Output.** A dispatched command prints `running…` with the action's duration, then the action's finding lines (`reveals`) when it completes, in the terminal, the same lines the normal tools show. A busy engine (another action running) answers "another operation is in progress" and dispatches nothing, matching the disabled buttons in normal mode. | |
| H10 | **Runs carry `difficulty`.** `POST /api/runs` takes `difficulty: "normal" \| "hard"` (default `normal` for old clients). New column `runs.difficulty text not null default 'normal'` with a check; the one-ranked-daily unique index and both board indexes include it, so a player has one ranked daily per difficulty. `GET /api/leaderboard` takes `difficulty` (default `normal`); the POST answer's board is for the run's difficulty. Migration is add-only (backward compatible, deploy.sh rule). | One board with a "hard" badge (the scores are not comparable) |
| H11 | **Leaderboard UI:** a Normal / Hard switch on both the daily and practice tabs, remembered per viewer (localStorage in try/catch). The results card and the share text say "Hard" for a hard run. | |
| H12 | **Analytics:** `shift_start` and `shift_finish` gain `difficulty`. | |
| H13 | **Engine unchanged** (`cli` is content, not read by the engine), so `ENGINE_VERSION` stays 1.1.0 and every old run still replays. | |

## Fairness and content rules

- Every non-`ask` action in every variant (and slow-leak) has a `cli`; `cli` is unique within a variant; it parses (balanced quotes); its first word is in the global vocabulary.
- A fix's `cli` may name its target (the target must be found first: H5).
- The same command family is used for the same kind of action across incidents (rollback is always `kubectl rollout undo deployment/<svc>`, restarts `kubectl rollout restart deployment/<svc>`, logs `kubectl logs deployment/<svc> --since=10m`, and so on), so learning it once pays off.
- Golden runs: for every variant, the golden player's action ids, typed as their `cli` through the terminal parser, dispatch the same actions (a test, not a new golden file).

## Out of scope

Accounts, per-command partial credit, a real shell, editing commands in other apps, mobile layout for the terminal.

## Amendments after review (2026-10-01)

Two fresh reviews changed H4, H5 and H7:

- **H5 matching is by intent, not verbatim text.**
  - A check (investigate) is matched on its whole command and is listed by the new `runbook` builtin, like normal mode's check buttons.
  - A fix or mitigation is matched on its command word plus its `cliKeys`. Keys are whole words, `a|b` alternatives, or `setting=value` pairs given exactly one value. Flags, hosts, quoting and order don't matter.
  - Two keyed matches with the same number of keys mean the input is ambiguous, and nothing runs.
  - A dry run never counts. Words inside an `incidentctl` message are free text, never keys.
- **Service names.** After `deployment/` or `app=`, either a service's map id or its label works (`deploy/` and `deployments/` too).
- **Learnability is tested.** Every key must appear, as a whole word, in what the shift shows (desktop, map, metrics, alerts, logs, check reveals) or in `help`. A pair's value must be stated next to its setting. `packages/scenarios/src/cli.learnable.test.ts` enforces this.
- **Per-run values** (a pid, an offset, a message id) are `{name}` placeholders filled from `cliVars(state)` via the engine's read-only `Run.state()`.
- **`help` lists every command family** the content uses (`CLI_HELP`, shared with the harness).
- **The same reply for any vocabulary line** while another action runs or before the ack, except an async teammate page, which runs beside other work as its button does.
- **The fairness test covers runbook commands too.**
