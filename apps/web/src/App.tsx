import type { RunResult } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { useEffect, useState } from "react";
import { fetchApiVersion } from "./api";
import { M15_SURFACES, reachableClueCount } from "./os/surfaces";
import { Debrief } from "./screens/Debrief";
import { ErrorBoundary } from "./screens/ErrorBoundary";
import { Incident } from "./screens/Incident";
import { Landing } from "./screens/Landing";
import { useMediaQuery } from "./useMediaQuery";

type ApiStatus = { state: "checking" } | { state: "online"; version: string } | { state: "unreachable" };

type Screen = { name: "landing" } | { name: "incident"; seed: number } | { name: "debrief"; result: RunResult };

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

interface AppProps {
  fetchVersion?: () => Promise<string>;
  newSeed?: () => number;
  prepageMs?: number;
}

export function App({ fetchVersion = fetchApiVersion, newSeed = randomSeed, prepageMs }: AppProps) {
  const [status, setStatus] = useState<ApiStatus>({ state: "checking" });
  const [screen, setScreen] = useState<Screen>({ name: "landing" });
  const wide = useMediaQuery("(min-width: 1024px)");

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

  const home = () => setScreen({ name: "landing" });
  const start = () => setScreen({ name: "incident", seed: newSeed() });

  if (screen.name === "incident") {
    return (
      <ErrorBoundary onReset={home}>
        <Incident
          key={screen.seed}
          scenario={slowLeak}
          seed={screen.seed}
          prepageMs={prepageMs}
          onFinish={(result) => setScreen({ name: "debrief", result })}
        />
      </ErrorBoundary>
    );
  }
  if (screen.name === "debrief") {
    return <Debrief scenario={slowLeak} result={screen.result} clueTotal={reachableClueCount(slowLeak, M15_SURFACES)} onPlayAgain={start} onHome={home} />;
  }

  const apiLine =
    status.state === "checking" ? "Checking API…" : status.state === "online" ? `API online · ${status.version}` : "API unreachable";
  return <Landing scenario={slowLeak} apiLine={apiLine} build={import.meta.env.VITE_GIT_SHA ?? "dev"} wide={wide} onStart={start} />;
}
