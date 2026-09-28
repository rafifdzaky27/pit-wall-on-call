import { TICKS_PER_SECOND, type Snapshot } from "@pitwall/engine";
import { useEffect, useRef, useState } from "react";
import { PAGER_EVERY_MS } from "./audio/cues";
import { audio } from "./audio/engine";
import { useIncident, type IncidentPhase } from "./incident/IncidentProvider";
import { usePrefs } from "./PrefsProvider";

/** The pager grows a step louder every 10 s until the ack (cold-open spec §7). */
export const PAGER_STEP_MS = 10_000;
const PAGER_STEP_GAIN = 0.25;
const PAGER_MAX_GAIN = 2;
/** Error budget thresholds that pulse, in basis points. */
export const BUDGET_PULSES = [5000, 8000];

/** How many budget thresholds a change from `before` to `after` crosses. */
export function pulsesBetween(before: number, after: number): number {
  return BUDGET_PULSES.filter((t) => before < t && after >= t).length;
}

const activeAlerts = (s: Snapshot) => s.alerts.filter((a) => a.clearedAtTick === null).length;
const heldSeconds = (s: Snapshot) => (s.stableSinceTick === null ? -1 : Math.floor((s.tick - s.stableSinceTick) / TICKS_PER_SECOND));

/** Maps the incident to sounds (polish spec §7, cold-open spec §7). Chat and banner sounds are played by Notifications. */
export function useSoundCues(locked: boolean): void {
  const { phase, paused, result, snapshot } = useIncident();
  const { prefs } = usePrefs();
  const [hidden, setHidden] = useState(() => document.hidden);
  const calm = prefs.reduceAudio;

  useEffect(() => {
    audio.setLevels({ master: prefs.volume / 100, ambience: prefs.ambience / 100, music: prefs.music / 100, alerts: prefs.alerts / 100, muted: prefs.muted });
    if (prefs.muted) audio.stop();
  }, [prefs.volume, prefs.ambience, prefs.music, prefs.alerts, prefs.muted]);

  useEffect(() => {
    const unlock = () => audio.unlock();
    const onVisibility = () => setHidden(document.hidden);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Pause, lock and a hidden tab freeze everything, the café and the radio included.
  const frozen = paused || locked || hidden;
  useEffect(() => {
    if (frozen) audio.suspend();
    else audio.resume();
  }, [frozen]);

  const ringing = phase === "paging" && !frozen;
  useEffect(() => {
    if (!ringing) return;
    const began = Date.now();
    const ring = () => {
      const steps = Math.floor((Date.now() - began) / PAGER_STEP_MS);
      audio.play("pager", { gain: Math.min(PAGER_MAX_GAIN, 1 + PAGER_STEP_GAIN * steps) });
      // The phone on the table buzzes with every ring, wherever the camera is (cold-open spec C10).
      audio.play("vibrate");
    };
    ring();
    const id = window.setInterval(ring, PAGER_EVERY_MS);
    return () => {
      window.clearInterval(id);
      audio.stop("sfx");
    };
  }, [ringing]);

  const before = useRef({ phase, snapshot });
  useEffect(() => {
    const was = before.current;
    before.current = { phase, snapshot };
    const a = was.snapshot;
    const b = snapshot;
    if (was.phase === "paging" && phase === "active") audio.play("ack");
    cues(was.phase, phase, a, b, calm);
    if (was.phase !== "ended" && phase === "ended" && result) audio.play(result.outcome === "resolved" ? "resolved" : "dnf");
  }, [phase, result, snapshot, calm]);
}

/** Console cues, judged against the phase before this render (the last one can end the run). */
function cues(was: IncidentPhase, phase: IncidentPhase, a: Snapshot, b: Snapshot, calm: boolean): void {
  if (was !== "paging" && was !== "active") return;
  if (!calm && !a.escalated && b.escalated) audio.play("escalation");
  if (!calm) for (let i = pulsesBetween(a.budgetBurnedBp, b.budgetBurnedBp); i > 0; i--) audio.play("pulse");
  if (phase !== "active") return;
  const busyA = a.busy?.actionId ?? null;
  const busyB = b.busy?.actionId ?? null;
  if (busyB && busyB !== busyA) audio.play("actionStart");
  else if (busyA && !busyB) audio.play("actionDone");
  if (activeAlerts(b) > activeAlerts(a)) audio.play("alertFired");
  else if (activeAlerts(b) < activeAlerts(a)) audio.play("alertCleared");
  const held = heldSeconds(b);
  if (!calm && held >= 0 && held !== (a.stableSinceTick === b.stableSinceTick ? heldSeconds(a) : -1)) audio.play("tick");
}
