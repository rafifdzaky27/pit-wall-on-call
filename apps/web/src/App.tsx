import type { ReactNode } from "react";
import { Stage } from "./cafe/Stage";
import { DailyProvider } from "./net/daily";
import { SubmissionProvider } from "./net/SubmissionProvider";
import { IncidentProvider, ShiftScope, useIncident } from "./os/incident/IncidentProvider";
import { PrefsProvider } from "./os/PrefsProvider";
import { Desktop } from "./os/shell/Desktop";
import { Lockscreen } from "./os/shell/Lockscreen";
import { OsBridge, OsProvider } from "./os/shell/OsContext";
import { ErrorBoundary } from "./screens/ErrorBoundary";
import { useMediaQuery } from "./useMediaQuery";

/** A crash in any app shows an explanation instead of a blank page; recovering starts a new shift. */
function CrashGuard({ children }: { children: ReactNode }) {
  const { newShift } = useIncident();
  return <ErrorBoundary onReset={newShift}>{children}</ErrorBoundary>;
}

export function App({ newSeed, prepageMs }: { newSeed?: () => number; prepageMs?: number }) {
  const wide = useMediaQuery("(min-width: 1024px)");
  return (
    <PrefsProvider>
      <DailyProvider>
        <IncidentProvider newSeed={newSeed} prepageMs={prepageMs}>
          <SubmissionProvider>
            <CrashGuard>
              {wide ? (
                <OsBridge>
                  <Stage>
                    <ShiftScope>
                      <OsProvider>
                        <Desktop />
                      </OsProvider>
                    </ShiftScope>
                  </Stage>
                </OsBridge>
              ) : (
                <ShiftScope>
                  <OsProvider>
                    <Lockscreen />
                  </OsProvider>
                </ShiftScope>
              )}
            </CrashGuard>
          </SubmissionProvider>
        </IncidentProvider>
      </DailyProvider>
    </PrefsProvider>
  );
}
