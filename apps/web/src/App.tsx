import { IncidentProvider } from "./os/incident/IncidentProvider";
import { PrefsProvider } from "./os/PrefsProvider";
import { Desktop } from "./os/shell/Desktop";
import { Lockscreen } from "./os/shell/Lockscreen";
import { OsProvider } from "./os/shell/OsContext";
import { useMediaQuery } from "./useMediaQuery";

export function App({ newSeed, prepageMs }: { newSeed?: () => number; prepageMs?: number }) {
  const wide = useMediaQuery("(min-width: 1024px)");
  return (
    <PrefsProvider>
      <IncidentProvider newSeed={newSeed} prepageMs={prepageMs}>
        <OsProvider>{wide ? <Desktop /> : <Lockscreen />}</OsProvider>
      </IncidentProvider>
    </PrefsProvider>
  );
}
