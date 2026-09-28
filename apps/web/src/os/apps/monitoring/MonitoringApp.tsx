import { Console } from "../../../console/Console";
import { useIncident } from "../../incident/IncidentProvider";
import { usePrefs } from "../../PrefsProvider";
import { useOs } from "../../shell/OsContext";

function CalmView() {
  const incident = useIncident();
  const idle = incident.phase === "idle";
  return (
    <div className="app-pad mon-calm">
      <div className="mon-calm-head">
        <span className="tag ok">All systems normal</span>
        <h2>{incident.world.brand.name} production</h2>
        <p className="muted">
          {idle
            ? "You are the primary on-call. Start a practice shift when you are ready."
            : "Shift started. Nothing is firing yet. The incident clock starts when the pager goes off."}
        </p>
      </div>
      <ul className="mon-services">
        {incident.scenario.services.map((s) => (
          <li key={s.id}>
            <span>{s.label}</span>
            <span className="tag ok">Healthy</span>
          </li>
        ))}
      </ul>
      {idle ? (
        <button type="button" className="btn primary btn-lg" onClick={incident.start}>
          Start shift
        </button>
      ) : (
        <button type="button" className="btn" onClick={incident.skipPrepage}>
          Skip to the page
        </button>
      )}
    </div>
  );
}

export function MonitoringApp() {
  const incident = useIncident();
  const { prefs } = usePrefs();
  const { openApp } = useOs();

  if (incident.phase === "idle" || incident.phase === "prepage") return <CalmView />;
  if (incident.phase === "ended") {
    return (
      <div className="app-pad mon-ended">
        <h2>Incident closed</h2>
        <p className="muted">The postmortem is open in its own window.</p>
        <button type="button" className="btn primary" onClick={() => openApp("postmortem")}>
          Open postmortem
        </button>
      </div>
    );
  }
  const page = incident.scenario.coldOpen.page;
  return (
    <div className="mon">
      {incident.phase === "paging" && (
        <div className="mon-paging" role="alert">
          <span className="tag crit">{page.severity}</span>
          <span>
            <b>{page.title}.</b> Acknowledge the page to start working.
          </span>
          <button type="button" className="btn primary" onClick={incident.acknowledge}>
            Acknowledge <kbd>A</kbd>
          </button>
        </div>
      )}
      <Console
        scenario={incident.scenario}
        snapshot={incident.snapshot}
        logs={incident.logs}
        history={incident.history}
        world={incident.world}
        check={incident.check}
        onAction={incident.dispatch}
        onPause={incident.pause}
        shortcuts={prefs.singleKeyShortcuts}
      />
    </div>
  );
}
