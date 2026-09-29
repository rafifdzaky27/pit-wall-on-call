import { useState } from "react";
import { GLOSSARY } from "../../../content/glossary";
import { checklist } from "../../../game/checklist";
import { useIncident } from "../../incident/IncidentProvider";
import { useOs } from "../../shell/OsContext";
import { SHORTCUTS } from "../../shortcutList";
import "./help.css";

type HelpPageId = "how" | "checklist" | "glossary" | "tools";

const PAGES: { id: HelpPageId; label: string }[] = [
  { id: "how", label: "How to play" },
  { id: "checklist", label: "Checklist" },
  { id: "glossary", label: "Glossary" },
  { id: "tools", label: "Tools" },
];

/** The loop in six lines (M2.5 spec §4). It explains the job, never this incident's answer. */
const LOOP = [
  "The pager goes off. Acknowledge it with A, from the page or your phone.",
  "See what customers see, then open Monitoring: alerts, the service map, metrics and logs.",
  "Investigate before you change anything. Every action takes time, and the clock keeps running.",
  "Stop the bleeding with a mitigation, then remove the cause with a fix.",
  "The incident is resolved once the fix holds for 10 s. Failed requests burn the error budget.",
  "Keep people posted, then read the postmortem to see what to do next time.",
];

const TOOLS: [name: string, what: string][] = [
  ["Monitoring", "Alerts, the service map, metrics, logs and the actions you can take on each service."],
  ["Browser", "The store as customers see it, and the leaderboard."],
  ["Chat", "Your team: the incident channel and direct messages."],
  ["Files", "Notes on this machine, such as the on-call handover."],
  ["Settings", "Appearance, sound, accessibility and keyboard shortcuts."],
  ["postmortem.md", "What happened in your run and what to learn from it. It opens when the incident ends."],
  ["Help", "This app: how to play, the incident checklist, the glossary and the tools."],
];

function Checklist() {
  const incident = useIncident();
  const { seenApps } = useOs();
  const items = checklist(incident.scenario, incident.timeline, incident.snapshot, {
    browserOpened: seenApps.has("browser"),
    postmortemOpened: seenApps.has("postmortem"),
  });
  return (
    <>
      <p className="muted">Real incident response in seven steps. It ticks itself as you play.</p>
      <ol className="help-box help-checklist" aria-label="Incident checklist">
        {items.map((item) => (
          <li key={item.id} className="help-row">
            <span className="help-row-text">
              <span className="help-row-title">{item.label}</span>
              <span className="help-row-sub">{item.hint}</span>
            </span>
            {/* A word first; the colour only repeats it. */}
            <span className={item.done ? "tag ok" : "tag"}>{item.done ? "Done" : "To do"}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Help: how to play, the live incident checklist, the glossary and the tools (M2.5 spec §4). */
export function HelpApp() {
  const { phase } = useIncident();
  const [page, setPage] = useState<HelpPageId>(() => (phase === "idle" || phase === "prepage" ? "how" : "checklist"));
  const label = PAGES.find((p) => p.id === page)!.label;

  return (
    <div className="help">
      <nav className="help-nav" aria-label="Help pages">
        {PAGES.map((p) => (
          <button key={p.id} type="button" aria-current={page === p.id ? "page" : undefined} onClick={() => setPage(p.id)}>
            {p.label}
          </button>
        ))}
      </nav>
      <div className="help-page">
        <h2 className="help-title">{label}</h2>

        {page === "how" && (
          <>
            <ol className="help-box help-loop" aria-label="The loop">
              {LOOP.map((line) => (
                <li key={line} className="help-row">
                  {line}
                </li>
              ))}
            </ol>
            <section className="help-group" aria-label="Keyboard">
              <h3 className="help-group-title">Keyboard</h3>
              <table className="help-box help-keys" aria-label="Keyboard shortcuts">
                <tbody>
                  {SHORTCUTS.map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">
                        <kbd>{k}</kbd>
                      </th>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        {page === "checklist" && <Checklist />}

        {page === "glossary" && (
          <dl className="help-box help-terms" aria-label="Glossary">
            {GLOSSARY.map((e) => (
              <div key={e.id} className="help-row">
                <dt className="help-row-title">{e.term}</dt>
                <dd className="help-row-sub">{e.definition}</dd>
              </div>
            ))}
          </dl>
        )}

        {page === "tools" && (
          <dl className="help-box help-terms" aria-label="Tools">
            {TOOLS.map(([name, what]) => (
              <div key={name} className="help-row">
                <dt className="help-row-title">{name}</dt>
                <dd className="help-row-sub">{what}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
