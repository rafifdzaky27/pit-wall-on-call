import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMetrics } from "./http/metrics";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "infra", "observability");

interface Panel {
  title: string;
  type: string;
  targets: { expr: string }[];
}
interface Dashboard {
  title: string;
  uid: string;
  panels: Panel[];
}

const dashboard = JSON.parse(readFileSync(join(DIR, "grafana-dashboard.json"), "utf8")) as Dashboard;

/** Every metric name the API can export, with the suffixes prom-client adds to histograms. */
function exportedNames(): Set<string> {
  const names = new Set<string>();
  for (const m of createMetrics({ defaults: true }).registry.getMetricsAsArray()) {
    const { name, type } = m as unknown as { name: string; type: string };
    names.add(name);
    if (type === "histogram") for (const suffix of ["_bucket", "_count", "_sum"]) names.add(name + suffix);
  }
  return names;
}

describe("infra/observability", () => {
  it("the Grafana dashboard parses and has the panels the spec asks for", () => {
    expect(dashboard.title).toBeTruthy();
    expect(dashboard.uid).toBeTruthy();
    const titles = dashboard.panels.map((p) => p.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Request rate by route",
        "5xx rate",
        "p95 latency",
        "Runs submitted by outcome",
        "Run rejections by reason",
        "SLO: POST /api/runs good ratio (28d)",
        "SLO: error budget burn rate",
      ]),
    );
    for (const panel of dashboard.panels) {
      expect(panel.targets.length, panel.title).toBeGreaterThan(0);
      for (const t of panel.targets) expect(t.expr, panel.title).toBeTruthy();
    }
  });

  it("every metric in the dashboard queries is one the API exports", () => {
    const exported = exportedNames();
    const used = new Set<string>();
    for (const panel of dashboard.panels) {
      for (const t of panel.targets) {
        for (const m of t.expr.matchAll(/\b([a-z][a-z0-9_]*)\s*(?:\{|\[)/g)) used.add(m[1]!);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) expect(exported.has(name), `${name} is not exported by apps/api/src/http/metrics.ts`).toBe(true);
  });

  it("the Prometheus scrape snippet targets /metrics with a placeholder, not a real address", () => {
    const yml = readFileSync(join(DIR, "prometheus-scrape.yml"), "utf8");
    expect(yml).toContain("job_name: pitwall-api");
    expect(yml).toContain("metrics_path: /metrics");
    expect(yml).toContain("<TAILNET_IP_OF_SRV_PITWALL_01>");
  });
});
