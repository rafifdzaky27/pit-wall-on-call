import { messageAuthor, messageText } from "@pitwall/scenarios";
import { fillWorld } from "@pitwall/world";
import { useEffect, useRef } from "react";
import { authorName, visibleFor } from "../apps/chat/unread";
import { useIncident } from "../incident/IncidentProvider";
import { usePrefs } from "../PrefsProvider";
import { useStartTraining } from "../useStartShift";
import { useOs } from "./OsContext";

/**
 * Feeds the notification list:
 * - the shift notices follow the phase
 * - human DMs and #incidents messages after the page arrive as Chat banners while Chat is not focused
 */
export function useNoticeFeed(startShift: () => void): void {
  const incident = useIncident();
  const { pushNotice, removeNotice, openApp, wm, recordArrivals } = useOs();
  const { phase, world, scenario, result } = incident;
  const { prefs } = usePrefs();
  const startTraining = useStartTraining();

  useEffect(() => {
    if (phase === "idle") {
      // Newcomers see the guided training first (M2.5 spec §5); afterwards the real shift leads.
      const real = { label: "Start shift", run: startShift, primary: prefs.trainingDone };
      const drill = { label: "Training shift (about 3 min)", run: startTraining, primary: !prefs.trainingDone };
      pushNotice({
        id: "shift",
        app: "Shift",
        title: `Shift ready · ${world.city.name}`,
        body: prefs.trainingDone
          ? `${world.brand.name} is quiet. Start a practice incident whenever you are ready.`
          : `${world.brand.name} is quiet. New here? Start with the training shift: a coach walks you through it.`,
        actions: prefs.trainingDone ? [real, drill] : [drill, real],
      });
    } else removeNotice("shift");

    if (phase === "prepage") {
      pushNotice({
        id: "prepage",
        app: "Shift",
        title: "Shift started",
        body: "Nothing is broken yet. The pager can go off at any moment.",
        actions: [{ label: "Skip to the page", run: incident.skipPrepage }],
        sound: "notify",
      });
    } else removeNotice("prepage");

    if (phase === "ended" && result) {
      pushNotice({
        id: "ended",
        app: "Monitoring",
        title: result.outcome === "resolved" ? "Incident resolved" : "Error budget exhausted",
        body: "The postmortem is open in its own window.",
        actions: [{ label: "Open postmortem", run: () => openApp("postmortem") }],
      });
    }
  }, [phase, result, prefs.trainingDone]);

  // Symptoms down but the cause still active: say the incident is open (M2.5 spec §3, finding F1).
  const status = incident.snapshot.status;
  useEffect(() => {
    if (phase !== "active") return;
    if (status === "mitigated") {
      pushNotice({
        id: "mitigated",
        app: "Monitoring",
        title: "Incident still open",
        body: "Symptoms are down, but the incident is still open. Is the cause fixed, or only its effect?",
        actions: [{ label: "Open Monitoring", run: () => openApp("monitoring") }],
        sound: "notify",
      });
    } else removeNotice("mitigated");
  }, [status, phase]);

  const visible = visibleFor(incident);
  const ids = visible.map((m) => m.id).join(",");
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    recordArrivals(
      visible.map((m) => m.id),
      Date.now(),
    );
    // The backlog that is already there when the desktop opens is not news.
    if (seen.current === null) {
      seen.current = new Set(visible.map((m) => m.id));
      return;
    }
    const chatFocused = wm.windows.find((w) => w.id === wm.focusedId)?.appId === "chat";
    for (const m of visible) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      const author = messageAuthor(m, scenario);
      const loud = m.channel.startsWith("dm:") || m.channel === "incidents";
      if (!loud || chatFocused || author === "bot" || author === "deploybot") continue;
      const name = authorName(author, world);
      pushNotice({
        id: `chat:${m.id}`,
        app: "Chat",
        title: m.channel.startsWith("dm:") ? name : `${name} in #${m.channel}`,
        body: fillWorld(messageText(m, scenario), world),
        actions: [{ label: "Open Chat", run: () => openApp("chat") }],
        sound: "message",
      });
    }
  }, [ids]);
}
