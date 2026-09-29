import { useEffect, useState } from "react";
import { fetchApiVersion } from "../../api";
import { reloader } from "../../chunks";
import { useIncident } from "../incident/IncidentProvider";
import { useOs } from "./OsContext";

export const VERSION_POLL_MS = 5 * 60_000;

/**
 * Tells a long-open tab that a new version was deployed (M2.5 spec §10). It asks only between shifts:
 * reloading mid-incident would throw the run away.
 */
export function useUpdateNotice(fetchVersion: () => Promise<string> = fetchApiVersion, build: string = import.meta.env.VITE_GIT_SHA ?? "dev"): void {
  const { phase } = useIncident();
  const { pushNotice, removeNotice } = useOs();
  const [newer, setNewer] = useState(false);

  useEffect(() => {
    if (build === "dev") return;
    let live = true;
    const check = () =>
      fetchVersion().then(
        (deployed) => {
          if (live && deployed !== build && deployed !== "dev") setNewer(true);
        },
        () => undefined,
      );
    void check();
    const id = window.setInterval(check, VERSION_POLL_MS);
    window.addEventListener("focus", check);
    return () => {
      live = false;
      window.clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [fetchVersion, build]);

  useEffect(() => {
    if (newer && (phase === "idle" || phase === "ended")) {
      pushNotice({
        id: "update",
        app: "System",
        title: "A new version is out",
        body: "Reload to play the new version of Pit Wall On-Call.",
        actions: [{ label: "Reload", run: () => reloader.reload(), primary: true }],
      });
    } else removeNotice("update");
  }, [newer, phase, pushNotice, removeNotice]);
}
