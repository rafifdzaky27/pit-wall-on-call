import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

export type Metrics = ReturnType<typeof createMetrics>;

/** One registry per app, so tests can build many apps (M2 plan P4). Names follow parent spec §10. */
export function createMetrics({ defaults = false }: { defaults?: boolean } = {}) {
  const registry = new Registry();
  if (defaults) collectDefaultMetrics({ register: registry });
  return {
    registry,
    runsSubmitted: new Counter({ name: "runs_submitted_total", help: "Runs accepted, by mode and outcome", labelNames: ["mode", "outcome"], registers: [registry] }),
    rejections: new Counter({ name: "run_rejections_total", help: "Requests refused, by reason", labelNames: ["reason"], registers: [registry] }),
    versionMismatch: new Counter({ name: "version_mismatch_total", help: "Runs from a client on another engine version", registers: [registry] }),
    replaySeconds: new Histogram({
      name: "replay_duration_seconds",
      help: "Server-side replay time",
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [registry],
    }),
    httpSeconds: new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration",
      labelNames: ["method", "route", "status"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [registry],
    }),
  };
}
