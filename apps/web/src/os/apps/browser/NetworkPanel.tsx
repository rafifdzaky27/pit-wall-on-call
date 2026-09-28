import { useState } from "react";
import { EXPLAIN, formatBytes, formatMs, REASON, statusClass } from "./http";
import { matchesFilter, summarize, type NetFilter, type NetRow } from "./network";

const CHIPS: [NetFilter, string][] = [
  ["all", "All"],
  ["fetch", "Fetch/XHR"],
  ["document", "Doc"],
  ["script", "JS"],
  ["stylesheet", "CSS"],
  ["img", "Img"],
];
const COLUMNS = ["Name", "Status", "Type", "Initiator", "Size", "Time", "Waterfall"];

interface Props {
  rows: NetRow[];
  host: string;
  selected: number | null;
  onSelect: (id: number) => void;
  onClear: () => void;
  preserve: boolean;
  onPreserve: (on: boolean) => void;
}

/** A DevTools-style Network panel (polish spec §8). Status always shows the number and the reason. */
export function NetworkPanel({ rows, host, selected, onSelect, onClear, preserve, onPreserve }: Props) {
  const [filter, setFilter] = useState<NetFilter>("all");
  const [text, setText] = useState("");
  const [noCache, setNoCache] = useState(false);
  // With the cache disabled, assets are fetched in full instead of revalidated (304).
  const shown = rows.map((r) => (noCache && r.status === 304 ? { ...r, status: 200, bytes: 18_000 + ((r.id * 7919) % 30_000) } : r)).filter((r) => matchesFilter(r, filter, text));
  const sum = summarize(shown);
  const start = shown.length > 0 ? Math.min(...shown.map((r) => r.tick * 100)) : 0;
  const span = Math.max(1, sum.finishMs);
  const row = shown.find((r) => r.id === selected);
  const nameOf = (r: NetRow) => (r.path === "/" ? host : (r.path.split("/").filter(Boolean).at(-1) ?? r.path));

  return (
    <section className="devtools" aria-label="Network">
      <div className="dt-bar">
        <span className="dt-title">Network</span>
        <button type="button" className="dt-btn" onClick={onClear}>
          Clear
        </button>
        <input type="search" className="dt-filter" aria-label="Filter" placeholder="Filter" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="dt-chips" role="group" aria-label="Request types">
          {CHIPS.map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
        <label className="dt-check">
          <input type="checkbox" checked={preserve} onChange={(e) => onPreserve(e.target.checked)} /> Preserve log
        </label>
        <label className="dt-check">
          <input type="checkbox" checked={noCache} onChange={(e) => setNoCache(e.target.checked)} /> Disable cache
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="empty dt-empty">No requests recorded yet. They appear once the incident clock is running.</p>
      ) : (
        <div className="net-scroll">
          <table aria-label="Network requests">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...shown].reverse().map((r) => (
                <tr key={r.id} className={r.id === selected ? "selected" : undefined}>
                  <td className="mono dt-name" title={`${r.method} ${r.path}`}>
                    {nameOf(r)}
                  </td>
                  <td>
                    <button type="button" className={`net-status ${statusClass(r.status)}`} aria-pressed={r.id === selected} onClick={() => onSelect(r.id)}>
                      {r.status} {REASON[r.status]}
                    </button>
                  </td>
                  <td>{r.type}</td>
                  <td className="muted">{r.initiator}</td>
                  <td className="mono">{formatBytes(r.bytes)}</td>
                  <td className="mono">{formatMs(r.ms)}</td>
                  <td className="wf-cell" aria-hidden="true">
                    <span className={`wf ${statusClass(r.status)}`} style={{ left: `${((r.tick * 100 - start) / span) * 100}%`, width: `${Math.max(0.6, (r.ms / span) * 100)}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="dt-summary mono">
        {sum.count} requests · {formatBytes(sum.bytes)} transferred · Finish: {formatMs(sum.finishMs)}
      </p>
      {row && (
        <p className="net-detail" role="status">
          <b>
            {row.status} {REASON[row.status]}
          </b>
          : {EXPLAIN[row.status]}
        </p>
      )}
    </section>
  );
}
