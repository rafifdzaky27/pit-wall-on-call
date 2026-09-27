import { useEffect, useState } from "react";
import { fetchApiVersion } from "./api";

type ApiStatus =
  | { state: "checking" }
  | { state: "online"; version: string }
  | { state: "unreachable" };

export function App({ fetchVersion = fetchApiVersion }: { fetchVersion?: () => Promise<string> }) {
  const [status, setStatus] = useState<ApiStatus>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    fetchVersion().then(
      (version) => {
        if (!cancelled) setStatus({ state: "online", version });
      },
      () => {
        if (!cancelled) setStatus({ state: "unreachable" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchVersion]);

  const apiLine =
    status.state === "checking"
      ? "Checking API…"
      : status.state === "online"
        ? `API online · ${status.version}`
        : "API unreachable";

  return (
    <main>
      <h1>Pit Wall On-Call</h1>
      <p>Pit lane open. The first incident is on its way.</p>
      <p>{apiLine}</p>
      <p>Web build · {import.meta.env.VITE_GIT_SHA ?? "dev"}</p>
    </main>
  );
}
