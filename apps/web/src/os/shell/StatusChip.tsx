import { STABLE_TICKS_TO_RESOLVE, TICKS_PER_SECOND, type IncidentStatus, type Snapshot } from "@pitwall/engine";
import { useIncident, type IncidentPhase } from "../incident/IncidentProvider";
import { useOs } from "./OsContext";

const TONE: Record<IncidentStatus, string> = {
  paging: "crit",
  investigating: "warn",
  mitigated: "warn",
  holding: "info",
  resolved: "ok",
  dnf: "crit",
};

/** Where the incident stands, in words (M2.5 spec §3). Before the page it is the on-call badge. */
export function statusLabel(phase: IncidentPhase, snapshot: Snapshot): { text: string; tone: string } {
  if (phase === "idle" || phase === "prepage") return { text: "On call · Primary", tone: "" };
  switch (snapshot.status) {
    case "paging":
      return { text: "Paged · acknowledge", tone: TONE.paging };
    case "investigating":
      return { text: "Investigating", tone: TONE.investigating };
    case "mitigated":
      return { text: "Mitigated · cause still active", tone: TONE.mitigated };
    case "holding": {
      const held = snapshot.tick - (snapshot.stableSinceTick ?? snapshot.tick);
      const left = Math.max(0, Math.ceil((STABLE_TICKS_TO_RESOLVE - held) / TICKS_PER_SECOND));
      return { text: `Fix holding · ${left} s`, tone: TONE.holding };
    }
    case "resolved":
      return { text: "Resolved", tone: TONE.resolved };
    case "dnf":
      return { text: "Out of time", tone: TONE.dnf };
  }
}

export function StatusChip() {
  const { phase, snapshot } = useIncident();
  const { openApp } = useOs();
  const { text, tone } = statusLabel(phase, snapshot);
  return (
    <button type="button" className={tone ? `oncall status-${tone}` : "oncall"} aria-label={`Incident status: ${text}`} onClick={() => openApp("incident")}>
      {text}
    </button>
  );
}
