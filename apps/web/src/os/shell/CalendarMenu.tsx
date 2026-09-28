import { useEffect } from "react";
import { monthGrid } from "./calendar";
import { useOs } from "./OsContext";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/** GNOME's date menu: notifications on the left, the month on the right (polish spec §6). */
export function CalendarMenu({ now }: { now: Date }) {
  const { notices, markNoticesRead, clearNotices, removeNotice, setOpenMenu } = useOs();
  const weeks = monthGrid(now);
  const month = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(now);

  useEffect(() => {
    markNoticesRead();
  }, [notices, markNoticesRead]);

  return (
    <div className="menu cal" role="dialog" aria-label="Calendar and notifications">
      <section className="cal-notices" aria-label="Notifications">
        {notices.length === 0 ? (
          <p className="empty">No notifications</p>
        ) : (
          <>
            <ul>
              {notices.map((n) => (
                <li key={n.id} className="cal-notice">
                  <p className="notice-meta">
                    {n.app} · <time dateTime={new Date(n.at).toISOString()}>{time.format(n.at)}</time>
                  </p>
                  <b>{n.title}</b>
                  <p>{n.body}</p>
                  {n.actions.length > 0 && (
                    <div className="notice-actions">
                      {n.actions.map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          className={a.primary ? "btn primary" : "btn"}
                          onClick={() => {
                            setOpenMenu(null);
                            removeNotice(n.id);
                            a.run();
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" className="btn cal-clear" onClick={clearNotices}>
              Clear
            </button>
          </>
        )}
      </section>
      <section className="cal-month" aria-label={month}>
        <h2>{new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now)}</h2>
        <p>{new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(now)}</p>
        <table className="cal-grid">
          <caption className="visually-hidden">{month}</caption>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => (
              <tr key={i}>
                {week.map((d, j) => (
                  <td key={j} aria-current={d === now.getDate() ? "date" : undefined}>
                    {d ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
