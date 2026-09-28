import { EXPLAIN, formatBytes, formatMs, REASON, statusClass } from "./http";
import type { NetRow } from "./network";

interface Props {
  rows: NetRow[];
  selected: number | null;
  onSelect: (id: number) => void;
}

export function NetworkPanel({ rows, selected, onSelect }: Props) {
  const row = rows.find((r) => r.id === selected);
  return (
    <section className="netpanel" aria-label="Network">
      {rows.length === 0 ? (
        <p className="empty">No requests recorded yet. They appear once the incident clock is running.</p>
      ) : (
        <div className="net-scroll">
          <table aria-label="Network requests">
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Method</th>
                <th scope="col">Path</th>
                <th scope="col">Time</th>
                <th scope="col">Size</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.id} className={r.id === selected ? "selected" : undefined}>
                  <td>
                    <button type="button" className={`net-status ${statusClass(r.status)}`} aria-pressed={r.id === selected} onClick={() => onSelect(r.id)}>
                      {r.status} {REASON[r.status]}
                    </button>
                  </td>
                  <td>{r.method}</td>
                  <td className="mono">{r.path}</td>
                  <td className="mono">{formatMs(r.ms)}</td>
                  <td className="mono">{formatBytes(r.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
