import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { IncidentProvider, useIncident, type IncidentApi } from "./incident/IncidentProvider";
import { DEFAULT_PREFS } from "./prefs";
import { PrefsProvider } from "./PrefsProvider";
import { OsProvider, useOs, type OsApi } from "./shell/OsContext";

/** Renders `ui` inside every PitOS provider and exposes the incident and OS APIs to the test. */
export function renderOs(ui: ReactNode, { seeds = [1, 2, 3] }: { seeds?: number[] } = {}): RenderResult & { incident: () => IncidentApi; os: () => OsApi } {
  const refs: { incident: IncidentApi | null; os: OsApi | null } = { incident: null, os: null };
  function Capture() {
    refs.incident = useIncident();
    refs.os = useOs();
    return null;
  }
  const queue = [...seeds];
  const result = render(
    <PrefsProvider initial={DEFAULT_PREFS}>
      <IncidentProvider newSeed={() => queue.shift() ?? 99} now={() => Date.now()}>
        <OsProvider>
          <Capture />
          {ui}
        </OsProvider>
      </IncidentProvider>
    </PrefsProvider>,
  );
  return { ...result, incident: () => refs.incident!, os: () => refs.os! };
}
