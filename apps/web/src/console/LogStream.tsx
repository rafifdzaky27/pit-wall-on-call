import type { LogEntry, ScenarioDef, State } from "@pitwall/engine";
import { useLayoutEffect, useRef } from "react";
import { formatClock } from "../game/format";

const VISIBLE = 200;

interface Props {
  scenario: ScenarioDef<State>;
  logs: readonly LogEntry[];
  filter: string | null;
  onClearFilter: () => void;
}

export function LogStream({ scenario, logs, filter, onClearFilter }: Props) {
  const labels = new Map(scenario.services.map((s) => [s.id, s.label]));
  const visible = (filter ? logs.filter((l) => l.serviceId === filter || l.serviceId === "global") : logs).slice(-VISIBLE);
  const listRef = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  });

  return (
    <section className="panel logs" aria-labelledby="logs-h">
      <div className="ph">
        <h2 id="logs-h">Logs</h2>
        {filter ? (
          <button type="button" className="chip" onClick={onClearFilter}>
            Clear filter: {labels.get(filter)} <kbd>Esc</kbd>
          </button>
        ) : (
          <span className="hint">All services</span>
        )}
      </div>
      <ol
        className="log-lines mono"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {visible.length === 0 && <li className="empty">No log lines from {filter ? labels.get(filter) : "any service"} yet.</li>}
        {visible.map((l) => (
          <li key={l.seq} className={l.finding ? "ll finding" : "ll"}>
            <time>{formatClock(l.tick)}</time>
            <span className={`lvl ${l.finding ? "FOUND" : l.level}`}>{l.finding ? "FOUND" : l.level}</span>
            <span className="svc" data-testid="log-service">
              {labels.get(l.serviceId) ?? "you"}
            </span>
            <span className="msg">{l.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
