import { TICKS_PER_SECOND, type ScenarioDef, type Snapshot, type State } from "@pitwall/engine";
import { formatBp, formatClock } from "../../game/format";
import "./objective.css";

const ERRORS: Record<number, string> = { 500: "500 errors", 502: "502 gateway errors", 503: "503 errors", 504: "504 timeouts" };

/** The objective in words, from scenario data only: it never names the cause (M4.5 spec N1). */
export function objectiveText(scenario: ScenarioDef<State>): { broken: string; goal: string } {
  const { symptom } = scenario.coldOpen;
  const code = Number(symptom.kind.replace(/^http_/, ""));
  const what = ERRORS[code] ?? (Number.isInteger(code) ? `${code} errors` : "errors");
  const where = symptom.surface === "checkout" ? "at checkout" : `on ${symptom.surface}`;
  return {
    broken: `Customers get ${what} ${where}.`,
    goal: "Find the cause and fix it before the error budget runs out. A fix that only hides the symptom does not count.",
  };
}

/** "Your job": what is broken, what winning means, and where the clock is. */
export function Objective({ scenario, snapshot, compact = false }: { scenario: ScenarioDef<State>; snapshot?: Snapshot; compact?: boolean }) {
  const { broken, goal } = objectiveText(scenario);
  // In the top bar's own format, so "99.9% left" and "0.1% burned" agree.
  const left = snapshot ? formatBp(Math.max(0, 10_000 - snapshot.budgetBurnedBp)) : null;
  const timeLeft = snapshot ? Math.max(0, scenario.timeLimitS * TICKS_PER_SECOND - snapshot.tick) : null;
  return (
    <section className={compact ? "objective compact" : "objective"} aria-label="Your job">
      <h3>Your job</h3>
      <p>
        <b>{broken}</b> {goal}
      </p>
      {left !== null && timeLeft !== null && (
        <p className="objective-clock muted">
          <span className="mono">{left}</span> of the error budget left · <span className="mono">{formatClock(timeLeft)}</span> on the clock
        </p>
      )}
    </section>
  );
}
