import type { LogEntry, LogLevel } from "@pitwall/engine";
import { fillWorld } from "@pitwall/world";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ActionButton } from "../../../console/ActionButton";
import { formatClock } from "../../../game/format";
import { useIncident } from "../../incident/IncidentProvider";
import { useOs } from "../../shell/OsContext";
import { visibleFor } from "../chat/unread";
import { actionsIn, offered } from "./toolActions";
import { ToolIdle } from "./ToolIdle";
import { useToolFocus } from "./useToolFocus";
import "./tools.css";

const LEVELS: (LogLevel | "FOUND")[] = ["ERROR", "WARN", "INFO", "FOUND"];
const VISIBLE = 300;
const VERSION = /\b(v\d+)\b/g;

/** Logs: search every service's log lines; saved queries are the log actions (M2.5 plan B4). */
export function LogsApp() {
  const incident = useIncident();
  const { openTool } = useOs();
  const { scenario, world, logs, snapshot } = incident;
  const [current, choose] = useToolFocus("logs");
  const [query, setQuery] = useState("");
  const [levels, setLevels] = useState<ReadonlySet<string>>(() => new Set(LEVELS));
  const listRef = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });

  if (incident.phase === "idle" || incident.phase === "prepage") return <ToolIdle name="Logs" />;

  const labels = new Map(scenario.services.map((s) => [s.id, s.label]));
  const saved = offered(actionsIn(scenario, "logs", current), incident.offers);
  const q = query.trim().toLowerCase();
  const shown = logs
    .filter((l) => !current || l.serviceId === current || l.serviceId === "global")
    .filter((l) => levels.has(l.finding ? "FOUND" : l.level))
    .filter((l) => !q || fillWorld(l.text, world).toLowerCase().includes(q))
    .slice(-VISIBLE);
  const pinned = logs.filter((l) => l.finding).slice(-3).reverse();

  const toggle = (level: string) =>
    setLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });

  // The versions each service really has: its deploy history and what it runs now (review I2).
  const versions = new Map<string, Set<string>>();
  const cards = visibleFor(incident).flatMap((m) => (m.card ? [m.card] : []));
  for (const s of scenario.services) {
    const known = [snapshot.details[s.id] ?? "", ...cards.filter((c) => c.service === s.label).map((c) => c.version)];
    const found = new Set(known.flatMap((t) => t.match(VERSION) ?? []));
    if (found.size > 0) versions.set(s.id, found);
  }

  /** A version in a log line links to that service's deploys, when the service has that version. */
  const message = (l: LogEntry): ReactNode => {
    const text = fillWorld(l.text, world);
    const known = versions.get(l.serviceId);
    if (!known) return text;
    const parts = text.split(VERSION);
    return parts.map((part, i) =>
      i % 2 === 1 && known.has(part) ? (
        <button key={i} type="button" className="tool-link mono" aria-label={`${part}, open in Deploys`} onClick={() => openTool("deploys", l.serviceId)}>
          {part}
        </button>
      ) : (
        part
      ),
    );
  };

  return (
    <div className="tool logs-app">
      <div className="tool-bar" role="search">
        <input type="search" className="tool-search mono" aria-label="Search logs" placeholder="Search log lines" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="Service" value={current ?? ""} onChange={(e) => choose(e.target.value || null)}>
          <option value="">All services</option>
          {scenario.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="tool-levels" role="group" aria-label="Levels">
          {LEVELS.map((level) => (
            <button key={level} type="button" className={`tool-level lvl ${level}`} aria-pressed={levels.has(level)} onClick={() => toggle(level)}>
              {level}
            </button>
          ))}
        </div>
      </div>
      <div className="tool-body">
        <aside className="tool-side">
          <h3 className="group-h">Saved queries</h3>
          {saved.length === 0 ? (
            <p className="empty">No saved queries for {current ? labels.get(current) : "any service"}.</p>
          ) : (
            <ul className="tool-actions" role="group" aria-label="Saved queries">
              {saved.map((a) => (
                <li key={a.id}>
                  <ActionButton action={a} snapshot={snapshot} check={incident.check} onAction={incident.dispatch} />
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="tool-main" aria-label="Results">
          {pinned.length > 0 && (
            <ul className="log-pinned mono" aria-label="Pinned findings">
              {pinned.map((l) => (
                <li key={l.seq} className="ll finding">
                  <time>{formatClock(l.tick)}</time>
                  <span className="lvl FOUND">FOUND</span>
                  <span className="svc">{labels.get(l.serviceId) ?? "you"}</span>
                  <span className="msg">{fillWorld(l.text, world)}</span>
                </li>
              ))}
            </ul>
          )}
          <ol
            ref={listRef}
            className="log-lines mono"
            aria-label="Log lines"
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
          >
            {shown.length === 0 && <li className="empty">No log lines match.</li>}
            {shown.map((l) => (
              <li key={l.seq} className={l.finding ? "ll finding" : "ll"}>
                <time>{formatClock(l.tick)}</time>
                <span className={`lvl ${l.finding ? "FOUND" : l.level}`}>{l.finding ? "FOUND" : l.level}</span>
                <span className="svc" data-testid="log-service">
                  {labels.get(l.serviceId) ?? "you"}
                </span>
                <span className="msg">{message(l)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
