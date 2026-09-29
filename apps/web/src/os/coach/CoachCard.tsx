import { useEffect, useRef } from "react";
import { useIncident } from "../incident/IncidentProvider";
import { usePrefs } from "../PrefsProvider";
import { useOsOpener } from "../shell/OsContext";
import { currentStep } from "./steps";
import "./coach.css";

export const HIGHLIGHT_MS = 3000;

/** How long Show me looks for a control whose app is still loading. */
const FIND_MS = 2000;
const RETRY_MS = 100;

const visible = (el: Element) => el.getClientRects().length > 0;

/** Outlines the first visible match of `selector` for a few seconds, waiting for it to render. */
function showMe(selector: string, waited = 0): void {
  const matches = [...document.querySelectorAll(selector)];
  const el = matches.find(visible) ?? matches[0];
  if (!el) {
    if (waited < FIND_MS) window.setTimeout(() => showMe(selector, waited + RETRY_MS), RETRY_MS);
    return;
  }
  el.classList.add("coach-highlight");
  window.setTimeout(() => el.classList.remove("coach-highlight"), HIGHLIGHT_MS);
}

/** The secondary's coaching card on the training shift (M2.5 spec §5). */
export function CoachCard() {
  const incident = useIncident();
  const { prefs, update } = usePrefs();
  const training = incident.scenario.training === true;
  const step = training ? currentStep(incident) : null;
  const saved = useRef(false);
  const open = useOsOpener();

  // Finishing the training once is remembered, so the landing puts the real shift first.
  useEffect(() => {
    if (!training || saved.current || prefs.trainingDone) return;
    if (incident.phase === "ended" && incident.result?.outcome === "resolved") {
      saved.current = true;
      update({ trainingDone: true });
    }
  }, [training, incident.phase, incident.result, prefs.trainingDone, update]);

  if (!training || incident.phase === "idle" || !step) return null;
  return (
    <section className="coach" aria-label="Training coach">
      <p className="coach-who">{incident.world.colleagues.secondary} · coaching</p>
      <p role="status" className="coach-step">
        {step.text}
      </p>
      <button type="button" className="btn" onClick={() => {
          if (step.open) open(step.open);
          showMe(step.target);
        }}>
        Show me
      </button>
    </section>
  );
}
