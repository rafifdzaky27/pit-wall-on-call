import { defineScenario } from "../define";

type Fx = { level: number; fixed: number; patched: number };

/**
 * A tiny scenario with round numbers: 1 request per tick, a 1000-request budget and a
 * 10% error rate until fixed, so one unfixed tick burns exactly 1 bp.
 */
export const fixture = defineScenario<Fx>({
  id: "fixture",
  title: "Fixture",
  summary: "Engine test scenario",
  difficulty: "easy",
  timeLimitS: 90,
  parBp: 0,
  slo: { availability: 99.9, budgetRequests: 1000 },
  trafficPerTick: 1,
  services: [{ id: "svc", label: "svc", x: 50, y: 50, detail: (s) => `level ${s.level}` }],
  edges: [],
  setup: () => ({ level: 0, fixed: 0, patched: 0 }),
  dynamics: (s) => ({ ...s, level: s.level + 1 }),
  errorRateBp: (s) => (s.fixed ? 0 : 1000),
  health: (s) => ({ svc: s.fixed ? "ok" : "crit" }),
  mitigated: (s) => s.patched === 1 && s.fixed === 0,
  resolvedWhen: (s) => s.fixed === 1,
  metrics: [
    { id: "svc.level", serviceId: "svc", label: "Level", unit: "", max: 1000, value: (s, noise) => s.level + noise.next() },
  ],
  logs: [{ id: "svc.tick", serviceId: "svc", level: "INFO", everyTicks: 10, text: (s) => `level ${s.level}` }],
  alerts: [
    { id: "svc.down", serviceId: "svc", severity: "crit", title: "SvcDown", description: "svc failing", when: (s) => s.fixed === 0 },
  ],
  actions: [
    { id: "svc.poke", label: "Poke", serviceId: "svc", category: "investigate", durationS: 2, verdict: "useful", reveals: (s) => [`poked at level ${s.level}`] },
    { id: "svc.fix", label: "Fix", serviceId: "svc", category: "fix", durationS: 1, verdict: "useful", effect: (s) => ({ ...s, fixed: 1 }), available: (s) => s.fixed === 0 },
    { id: "svc.break", label: "Break", serviceId: "svc", category: "mitigate", durationS: 1, verdict: "harmful", sideEffectBp: 5000 },
    { id: "svc.patch", label: "Patch", serviceId: "svc", category: "mitigate", durationS: 1, verdict: "wasted", effect: (s) => ({ ...s, patched: 1 }) },
    { id: "status", label: "Post status", serviceId: null, category: "communicate", durationS: 1, verdict: "useful", reveals: () => ["status posted"] },
  ],
  rootCauseActionIds: ["svc.fix"],
  coldOpen: {
    scene: "cafe",
    symptom: { kind: "http_502", surface: "checkout" },
    page: { severity: "SEV2", title: "Svc down", body: "svc is failing" },
    hotspots: {
      "a.clue": { kind: "clue", label: "A", text: "clue text" },
      "b.herring": { kind: "herring", label: "B", text: "herring text" },
      "c.late": { kind: "clue", label: "C", text: "late clue", appearsAt: "incident_start" },
    },
  },
  lessons: [
    { id: "dnf", when: (r) => r.outcome === "dnf", text: "dnf lesson" },
    { id: "default", when: () => true, text: "default lesson" },
  ],
});

/** Step until the run ends; returns the number of steps taken. */
export function runToEnd(run: { outcome: string; step(): void }): number {
  let steps = 0;
  while (run.outcome === "running") {
    run.step();
    steps++;
  }
  return steps;
}
