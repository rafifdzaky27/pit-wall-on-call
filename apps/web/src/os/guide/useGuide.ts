import { TICKS_PER_SECOND, type Health } from "@pitwall/engine";
import { useEffect, useReducer, useRef } from "react";
import type { AppId } from "../apps/ids";
import { useIncident } from "../incident/IncidentProvider";
import { usePrefs } from "../PrefsProvider";
import { useOs } from "../shell/OsContext";
import { INCIDENTS } from "@pitwall/scenarios";
import { track } from "../../analytics/analytics";
import { hintFor } from "./hints";
import { due, markHinted, nextMilestone, observe, startGuide, type Facts, type GuideState, type Milestone } from "./milestones";

type Action = { type: "observe"; facts: Facts; at: number } | { type: "hinted"; milestone: Milestone };
const reduce = (state: GuideState, a: Action): GuideState => (a.type === "observe" ? observe(state, a.facts, a.at) : markHinted(state, a.milestone));

export const GUIDE_NOTICE = "guide";

const VETERAN_SHIFTS = 3;

const criticalIds = (health: Record<string, Health>) =>
  Object.entries(health)
    .filter(([, h]) => h === "crit")
    .map(([id]) => id);

/**
 * The next-step guide for first shifts (M4.5 spec N3). It watches what the player has done and, after a
 * quiet spell, posts one notice pointing at the next place to look. Apart from the training coach and the duck.
 */
export function useGuide(): void {
  const incident = useIncident();
  const { prefs, update } = usePrefs();
  const { wm, signals, pushNotice, removeNotice, openApp, openTool } = useOs();
  const { phase, snapshot, scenario, timeline, result } = incident;
  const training = scenario.training === true;
  // Quiet time is game time: it stands still while the shift is paused, or the tab hidden (PR 31 review).
  const gameMs = Math.floor((snapshot.tick * 1000) / TICKS_PER_SECOND);
  const [state, dispatch] = useReducer(reduce, undefined, () => startGuide(0));
  // Once the player acts, the guide has said enough.
  const active = phase === "active" && !training && prefs.nextStepHints && !incident.paused && !state.done.includes("fix");

  // Windows the player brought forward while the incident was on.
  const focusedApp = wm.windows.find((w) => w.id === wm.focusedId)?.appId as AppId | undefined;
  const opened = useRef<Set<string>>(new Set());
  if (phase === "active" && focusedApp) opened.current.add(focusedApp);

  // A selection on the map counts when the service was critical as it was picked, or none was.
  const picked = useRef(false);
  const readDeploys = useRef(false);
  const seenSignals = useRef<Set<string>>(new Set());
  for (const s of signals) {
    if (seenSignals.current.has(s)) continue;
    seenSignals.current.add(s);
    if (phase !== "active") continue;
    // #deploys read during the incident, not before the page (PR 31 review).
    if (s === "chat:deploys") readDeploys.current = true;
    if (!s.startsWith("service:")) continue;
    const crit = criticalIds(snapshot.health);
    if (crit.length === 0 || crit.includes(s.slice("service:".length))) picked.current = true;
  }

  const did = (categories: string[]) =>
    timeline.some((e) => e.kind === "action_start" && categories.includes(scenario.actions.find((a) => a.id === e.actionId)?.category ?? ""));
  const facts: Facts = {
    acked: snapshot.acked,
    monitoring: opened.current.has("monitoring"),
    service: picked.current,
    evidence: opened.current.has("logs") || did(["investigate"]),
    changes: opened.current.has("deploys") || readDeploys.current,
    fix: did(["mitigate", "fix"]),
  };
  const key = JSON.stringify(facts);
  const hintTracked = useRef(false);

  useEffect(() => {
    if (phase === "active") dispatch({ type: "observe", facts, at: gameMs });
  }, [key, phase]);

  // A new milestone answers the last hint.
  const total = state.done.length;
  useEffect(() => {
    removeNotice(GUIDE_NOTICE);
  }, [total]);

  useEffect(() => {
    if (!active) {
      removeNotice(GUIDE_NOTICE);
      return;
    }
    const next = nextMilestone(state);
    if (next === null || state.hinted.includes(next)) return;
    const m = due(state, gameMs);
    if (m === null) return;
    {
      const crit = criticalIds(snapshot.health);
      const spoilers = INCIDENTS.flatMap((i) => i.variants).find((v) => v.scenario.id === scenario.id)?.spoilers ?? [];
      const hint = hintFor(m, scenario.services.find((s) => crit.includes(s.id))?.label ?? null, spoilers);
      dispatch({ type: "hinted", milestone: m });
      if (!hint) return;
      const run = () => (hint.open === "monitoring" ? openApp("monitoring") : openTool(hint.open, crit[0] ?? null));
      pushNotice({ id: GUIDE_NOTICE, app: "Guide", title: hint.title, body: hint.body, actions: [{ label: hint.cta, run, primary: true }] });
      if (!hintTracked.current) {
        hintTracked.current = true;
        track("hint_shown");
      }
    }
  }, [active, state, gameMs]);

  // The first resolved real shift ends the hints; turning them back on is the player's call.
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current || training || phase !== "ended" || result?.outcome !== "resolved" || prefs.resolvedOnce) return;
    recorded.current = true;
    update({ resolvedOnce: true, nextStepHints: false });
  }, [phase, result, training, prefs.resolvedOnce, update]);

  // Three finished real shifts, resolved or not, make a veteran: the hints step aside once, at the third.
  const counted = useRef(false);
  useEffect(() => {
    if (phase !== "ended") {
      counted.current = false;
      return;
    }
    if (counted.current || training) return;
    counted.current = true;
    const shiftsDone = prefs.shiftsDone + 1;
    update(shiftsDone === VETERAN_SHIFTS ? { shiftsDone, nextStepHints: false } : { shiftsDone });
  }, [phase, training]);
}
