import { messageAuthor, messageText } from "@pitwall/scenarios";
import { fillWorld } from "@pitwall/world";
import { useEffect, useRef } from "react";
import { authorName, visibleFor } from "../apps/chat/unread";
import { useIncident } from "../incident/IncidentProvider";
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

  useEffect(() => {
    if (phase === "idle") {
      pushNotice({
        id: "shift",
        app: "Shift",
        title: `Shift ready · ${world.city.name}`,
        body: `${world.brand.name} is quiet. Start a practice incident whenever you are ready.`,
        actions: [{ label: "Start shift", run: startShift, primary: true }],
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
  }, [phase, result]);

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
