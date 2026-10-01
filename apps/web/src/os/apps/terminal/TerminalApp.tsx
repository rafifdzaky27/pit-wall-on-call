import { TICKS_PER_SECOND } from "@pitwall/engine";
import { fillWorld } from "@pitwall/world";
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { formatBp, formatClock } from "../../../game/format";
import { useIncident } from "../../incident/IncidentProvider";
import { useTeamActions } from "../../incident/useTeamActions";
import { useOs } from "../../shell/OsContext";
import { objectiveText } from "../../shell/Objective";
import { PAGE_ACTION, STATUS_ACTION } from "../chat/commands";
import { outputsOf } from "../tools/toolActions";
import { complete, runLine, statusText, type TermLine } from "./commands";
import type { TermEntry } from "./session";
import "./terminal.css";

const PROMPT = "oncall@pitwall:~$";


/** Hard mode's Terminal: every action is a typed command (M6 spec H3, H9). */
export function TerminalApp({ vocabulary }: { vocabulary?: readonly string[] } = {}) {
  const incident = useIncident();
  const { terminal, updateTerminal } = useOs();
  const team = useTeamActions();
  const { scenario, snapshot, world } = incident;
  const [value, setValue] = useState("");
  // Where Up and Down are in the history: null is a fresh line, and the draft is kept while browsing.
  const [recall, setRecall] = useState<{ index: number; draft: string } | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const ids = useMemo(() => new Set(terminal.entries.flatMap((e) => (e.kind === "run" && e.actionId ? [e.actionId] : []))), [terminal.entries]);
  const outputs = outputsOf(scenario, incident.timeline, incident.logs, ids);

  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [terminal.entries.length, outputs.length, options.length]);
  useLayoutEffect(() => inputRef.current?.focus(), []);

  const append = (entries: TermEntry[]) => updateTerminal((t) => ({ ...t, entries: [...t.entries, ...entries] }));

  const submit = (line: string) => {
    const typed = line.trim();
    setValue("");
    setRecall(null);
    setOptions([]);
    if (typed === "") {
      append([{ kind: "in", text: "" }]);
      return;
    }
    const history = [...terminal.history, typed];
    const result = runLine(typed, {
      scenario,
      phase: incident.phase,
      offers: incident.offers,
      check: incident.check,
      state: incident.runState,
      history,
      vocabulary,
      status: () => [
        objectiveText(scenario).broken,
        `Error budget: ${formatBp(Math.max(0, 10_000 - snapshot.budgetBurnedBp))} left`,
        `Elapsed: ${formatClock(snapshot.tick)}`,
      ],
    });
    if (result.clear) {
      updateTerminal(() => ({ entries: [], history }));
      return;
    }
    const entries: TermEntry[] = [{ kind: "in", text: typed }, ...result.lines.map((l: TermLine) => ({ kind: l.kind, text: l.text }) satisfies TermEntry)];
    if (result.ack) incident.acknowledge();
    if (result.dispatch) {
      // A status update and a page are also something you say: post them to Chat like the buttons did.
      const refused =
        result.dispatch === STATUS_ACTION
          ? team.postStatus(statusText(typed) ?? "We are investigating elevated errors.")
          : result.dispatch === PAGE_ACTION
            ? team.pageSecondary()
            : (incident.dispatch(result.dispatch), null);
      entries.push(refused ? { kind: "err", text: refused } : { kind: "run", text: typed, actionId: result.dispatch });
    }
    updateTerminal((t) => ({ entries: [...t.entries, ...entries], history }));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        updateTerminal((t) => ({ ...t, entries: [] }));
        setOptions([]);
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        append([{ kind: "in", text: `${value}^C` }]);
        setValue("");
        setRecall(null);
        setOptions([]);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit(value);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const past = terminal.history;
      if (past.length === 0) return;
      e.preventDefault();
      const at = recall?.index ?? past.length;
      const next = e.key === "ArrowUp" ? Math.max(0, at - 1) : at + 1;
      const draft = recall?.draft ?? value;
      if (next >= past.length) {
        setRecall(null);
        setValue(recall ? recall.draft : value);
      } else {
        setRecall({ index: next, draft });
        setValue(past[next]!);
      }
    } else if (e.key === "Tab" && !e.shiftKey && value.trim() !== "") {
      // Only a line with something to complete takes the key; an empty prompt lets Tab move on.
      e.preventDefault();
      const done = complete(value, { scenario, vocabulary });
      setValue(done.text);
      setOptions(done.options);
    }
  };

  // The nth `run` entry of an action reads the nth time it finished.
  const seen = new Map<string, number>();
  const runOf = (id: string) => snapshot.busy?.actionId === id ? snapshot.busy : snapshot.pending.find((p) => p.actionId === id);
  const lastRun = new Map<string, number>();
  terminal.entries.forEach((e, i) => e.kind === "run" && e.actionId && lastRun.set(e.actionId, i));

  return (
    <div
      className="term-app"
      onClick={() => {
        // A click anywhere focuses the prompt, unless the player is selecting text to copy.
        if (!window.getSelection()?.toString()) inputRef.current?.focus();
      }}
    >
      <div ref={logRef} className="term-log mono" role="log" aria-live="polite" aria-label="Terminal output">
        {terminal.entries.map((e, i) => {
          if (e.kind === "in") {
            return (
              <p key={i} className="term-line term-in">
                <span className="term-prompt">{PROMPT}</span> {e.text}
              </p>
            );
          }
          if (e.kind !== "run" || !e.actionId) {
            return (
              <p key={i} className={`term-line term-${e.kind}`}>
                {e.text}
              </p>
            );
          }
          const n = seen.get(e.actionId) ?? 0;
          seen.set(e.actionId, n + 1);
          const done = outputs.filter((o) => o.action.id === e.actionId)[n];
          if (done) {
            return done.lines.length > 0 ? (
              done.lines.map((l) => (
                <p key={`${i}-${l.seq}`} className="term-line term-out">
                  {fillWorld(l.text, world)}
                </p>
              ))
            ) : (
              <p key={i} className="term-line term-muted">
                done.
              </p>
            );
          }
          const running = runOf(e.actionId);
          if (!running || lastRun.get(e.actionId) !== i) return null;
          // The countdown is hidden from the live region: it changes every second and would be read out each time.
          return (
            <p key={i} className="term-line term-muted">
              running…{" "}
              <span aria-hidden="true">({Math.max(0, Math.ceil((running.endTick - snapshot.tick) / TICKS_PER_SECOND))}s)</span>
            </p>
          );
        })}
        {options.length > 0 && <p className="term-line term-muted">{options.join("  ")}</p>}
      </div>
      <div className="term-input">
        <span className="term-prompt mono" aria-hidden="true">
          {PROMPT}
        </span>
        <input
          ref={inputRef}
          className="term-field mono"
          type="text"
          aria-label="Terminal command"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setRecall(null);
            setOptions([]);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}
