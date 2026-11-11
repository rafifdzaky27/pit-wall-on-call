import type { ScenarioDef, State } from "@pitwall/engine";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { DailyProvider } from "../net/daily";
import { dailyFor, dayStartMs, slowLeak, utcDate } from "@pitwall/scenarios";
import { vi } from "vitest";
import { SubmissionProvider } from "../net/SubmissionProvider";
import { IncidentProvider, ShiftScope, useIncident, type IncidentApi } from "./incident/IncidentProvider";
import { DEFAULT_PREFS, type Prefs } from "./prefs";
import { PrefsProvider } from "./PrefsProvider";
import { OsProvider, useOs, type OsApi } from "./shell/OsContext";

/** Renders `ui` inside every PitOS provider and exposes the incident and OS APIs to the test. */
export function renderOs(
  ui: ReactNode,
  { seeds = [1, 2, 3], prefs = {}, scenario = slowLeak }: { seeds?: number[]; prefs?: Partial<Prefs>; scenario?: ScenarioDef<State> } = {},
): RenderResult & { incident: () => IncidentApi; os: () => OsApi } {
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
        <IncidentProvider scenario={scenario} newSeed={() => queue.shift() ?? 99} now={() => Date.now()}>
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

/**
 * Moves the (fake) clock to midday on the next day whose daily is the Slow Leak, the incident these tests play.
 * The daily rotates through every incident, so a test that plays "today's daily" otherwise breaks on most days.
 */
export function pinToSlowLeakDaily(): void {
  let ms = dayStartMs(utcDate(Date.now())) + 12 * 3_600_000;
  for (let i = 0; i < 400 && dailyFor(utcDate(ms)).scenarioId !== slowLeak.id; i++) ms += 86_400_000;
  vi.setSystemTime(ms);
}
