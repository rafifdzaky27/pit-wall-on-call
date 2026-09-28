import { TICKS_PER_SECOND, type ScenarioDef, type Snapshot, type State } from "@pitwall/engine";
import { formatBp, formatClock } from "../game/format";

export function TopBar({ scenario, snapshot, onPause }: { scenario: ScenarioDef<State>; snapshot: Snapshot; onPause: () => void }) {
  const burned = snapshot.budgetBurnedBp;
  const level = burned >= 8000 ? "crit" : burned >= 5000 ? "warn" : "ok";
  const pct = Math.min(100, burned / 100);
  return (
    <header className="topbar">
      <span className="wordmark">Pit Wall On-Call</span>
      <span className="tag crit">{scenario.coldOpen.page.severity}</span>
      <div className="topbar-title">
        <b>{scenario.coldOpen.page.title}</b>
        <small>{scenario.title}</small>
      </div>
      <div className="spacer" />
      <div className="kv">
        <span className="k">Incident time</span>
        <span className="clock mono" aria-label="Incident time">
          {formatClock(snapshot.tick)}
          <small> / {formatClock(scenario.timeLimitS * TICKS_PER_SECOND)}</small>
        </span>
      </div>
      <div className="budget">
        <div className="budget-row">
          <span className="k">Error budget burned</span>
          <b className={`budget-value mono ${level}`}>{formatBp(burned)}</b>
        </div>
        <div className="meter" role="meter" aria-label="Error budget burned" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i className={level} style={{ width: `${pct}%` }} />
          <u style={{ left: "50%" }} />
          <u style={{ left: "80%" }} />
        </div>
      </div>
      <button type="button" className="btn" onClick={onPause}>
        Pause <kbd>P</kbd>
      </button>
    </header>
  );
}
