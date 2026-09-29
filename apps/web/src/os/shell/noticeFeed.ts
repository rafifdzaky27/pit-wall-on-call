import { messageAuthor, messageText } from "@pitwall/scenarios";
import { fillWorld, resolveWorld } from "@pitwall/world";
import { useDaily } from "../../net/daily";
import { useEffect, useRef } from "react";
import { authorName, visibleFor } from "../apps/chat/unread";
import { useIncident } from "../incident/IncidentProvider";
import { usePrefs } from "../PrefsProvider";
import { useStartDaily, useStartTraining } from "../useStartShift";
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
  const startDaily = useStartDaily();
  const { daily, played } = useDaily();

  useEffect(() => {
    if (phase === "idle") {
      // Today's daily leads (M3 spec Y8); newcomers see the guided training first (M2.5 spec §5).
      const city = resolveWorld(daily.seed).city.name;
      const drill = { label: "Training shift (about 3 min)", run: startTraining, primary: !prefs.trainingDone };
      if (played) {
        const practice = { label: "Practice shift", run: startShift, primary: true };
        const again = { label: "Daily again (practice)", run: startDaily };
        pushNotice({
          id: "shift",
          app: "Shift",
          title: played.rank === null ? `Daily #${daily.number} done` : `Daily #${daily.number} done · #${played.rank} of ${played.total}`,
          body: "Your ranked attempt for today is in. Anything you play now is practice. The next daily is at 00:00 UTC.",
          actions: [practice, again, drill],
        });
      } else {
        const today = { label: "Start daily", run: startDaily, primary: prefs.trainingDone };
        const practice = { label: "Practice shift", run: startShift };
        pushNotice({
          id: "shift",
          app: "Shift",
          title: `Daily #${daily.number} · ${city}`,
          body: prefs.trainingDone
            ? "Today's incident, the same for everyone. Your first attempt counts on the daily board."
            : "New here? Start with the training shift: a coach walks you through it. Then try today's daily.",
          actions: prefs.trainingDone ? [today, practice, drill] : [drill, today, practice],
        });
      }
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

    // The ack leaves you on your own desktop (M2.5 follow-up): a pointer, not a window opening itself.
    if (phase === "active") {
      pushNotice({
        id: "acked",
        app: "Shift",
        title: "You're on it",
        body: "The pager is quiet. Start where you would at work: the dashboards, or the incident itself. The dock has every tool.",
        actions: [
          { label: "Open Monitoring", run: () => openApp("monitoring"), primary: true },
          { label: "Open Incident", run: () => openApp("incident") },
        ],
      });
    } else removeNotice("acked");

    if (phase === "ended" && result) {
      pushNotice({
        id: "ended",
        app: "Monitoring",
        title: result.outcome === "resolved" ? "Incident resolved" : "Error budget exhausted",
        body: "The postmortem is open in its own window.",
        actions: [{ label: "Open postmortem", run: () => openApp("postmortem") }],
      });
    }
  }, [phase, result, prefs.trainingDone, daily, played]);

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
