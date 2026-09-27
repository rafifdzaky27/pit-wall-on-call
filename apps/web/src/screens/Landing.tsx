import type { ScenarioDef, State } from "@pitwall/engine";
import { ThemeToggle } from "../ThemeToggle";

interface Props {
  scenario: ScenarioDef<State>;
  apiLine: string;
  build: string;
  wide: boolean;
  onStart: () => void;
}

const DIFFICULTY = { easy: "Easy", normal: "Normal", hard: "Hard" } as const;

export function Landing({ scenario, apiLine, build, wide, onStart }: Props) {
  return (
    <div className="page">
      <header className="site-head">
        <span className="wordmark">Pit Wall On-Call</span>
        <ThemeToggle />
      </header>
      <main className="landing">
        <section className="hero">
          <h1>Pit Wall On-Call</h1>
          <p className="lede">You are on call and production is failing. Find the cause before the error budget runs out.</p>
        </section>

        <section className="scenario-card" aria-labelledby="scenario-h">
          <div className="sc-meta">
            <span className="tag info">Scenario 1</span>
            <span>
              {DIFFICULTY[scenario.difficulty]} · {scenario.timeLimitS / 60} min limit
            </span>
          </div>
          <h2 id="scenario-h">{scenario.title}</h2>
          <p>{scenario.summary}</p>
          {wide ? (
            <button type="button" className="btn primary btn-lg" onClick={onStart}>
              Start shift
            </button>
          ) : (
            <p className="note">The incident console needs a screen at least 1024 px wide. Open this page on a laptop or desktop to play.</p>
          )}
        </section>

        <section className="how" aria-labelledby="how-h">
          <h2 id="how-h">How it plays</h2>
          <ol>
            <li>
              <b>Get paged.</b> Acknowledge quickly: time before the ack burns budget too.
            </li>
            <li>
              <b>Investigate.</b> Read alerts, metrics and logs. The loudest service is not always the cause.
            </li>
            <li>
              <b>Act.</b> Every action takes time, and some make things worse.
            </li>
          </ol>
        </section>
      </main>
      <footer className="site-foot">
        <span>{apiLine}</span>
        <span>Web build · {build}</span>
      </footer>
    </div>
  );
}
