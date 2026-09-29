import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { DailyProvider } from "../net/daily";
import { SubmissionProvider } from "../net/SubmissionProvider";
import { IncidentProvider, ShiftScope, useIncident, type IncidentApi } from "./incident/IncidentProvider";
import { DEFAULT_PREFS, type Prefs } from "./prefs";
import { PrefsProvider } from "./PrefsProvider";
import { OsProvider, useOs, type OsApi } from "./shell/OsContext";

/** Renders `ui` inside every PitOS provider and exposes the incident and OS APIs to the test. */
export function renderOs(ui: ReactNode, { seeds = [1, 2, 3], prefs = {} }: { seeds?: number[]; prefs?: Partial<Prefs> } = {}): RenderResult & { incident: () => IncidentApi; os: () => OsApi } {
  const refs: { incident: IncidentApi | null; os: OsApi | null } = { incident: null, os: null };
  function Capture() {
    refs.incident = useIncident();
    refs.os = useOs();
    return null;
  }
  const queue = [...seeds];
  const result = render(
    <PrefsProvider initial={{ ...DEFAULT_PREFS, ...prefs }}>
      <DailyProvider fetchDaily={() => new Promise(() => {})}>
        <IncidentProvider newSeed={() => queue.shift() ?? 99} now={() => Date.now()}>
          <SubmissionProvider>
            <ShiftScope>
              <OsProvider>
                <Capture />
                {ui}
              </OsProvider>
            </ShiftScope>
          </SubmissionProvider>
        </IncidentProvider>
      </DailyProvider>
    </PrefsProvider>,
  );
  return { ...result, incident: () => refs.incident!, os: () => refs.os! };
}
