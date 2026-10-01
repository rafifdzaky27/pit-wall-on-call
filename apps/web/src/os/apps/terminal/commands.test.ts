import { describe, expect, it } from "vitest";
import { CLI_HELP } from "@pitwall/scenarios";
import { complete, HELP_EXTRA, runLine, type TerminalCtx } from "./commands";
import { FIXTURE_CLI, FIXTURE_SECRETS, FIXTURE_VOCAB, fixtureScenario } from "./testFixture";

function ctx(over: Partial<TerminalCtx> = {}): TerminalCtx {
  return {
    scenario: fixtureScenario,
    phase: "active",
    offers: () => true,
    check: () => null,
    history: [],
    status: () => ["Objective: stop the errors", "Budget left: 99%", "Elapsed: 0:20"],
    vocabulary: FIXTURE_VOCAB,
    ...over,
  };
}
const text = (r: ReturnType<typeof runLine>) => r.lines.map((l) => l.text).join("\n");

describe("runLine: matching an action (M6 spec H5)", () => {
  it("dispatches the action whose cli matches, ignoring case, spacing and a trailing semicolon", () => {
    expect(runLine("kubectl rollout undo deployment/checkout", ctx()).dispatch).toBe("checkout.rollback");
    expect(runLine("  KUBECTL   rollout undo   deployment/checkout ; ", ctx()).dispatch).toBe("checkout.rollback");
    expect(runLine("psql -c 'select pg_drop_replication_slot(\"reporting_cdc\")'", ctx()).dispatch).toBe("postgres.connections");
  });

  it("a match that is not offered answers like the tool would, and dispatches nothing", () => {
    const r = runLine("kubectl rollout undo deployment/checkout", ctx({ offers: (id) => id !== "checkout.rollback" }));
    expect(r.dispatch).toBeUndefined();
    expect(text(r)).toBe("Error from server: the request could not be completed\nNot sure of the syntax? Type help.");
    const p = runLine("psql -c \"SELECT pg_drop_replication_slot('reporting_cdc');\"", ctx({ offers: () => false }));
    expect(p.dispatch).toBeUndefined();
    expect(text(p)).toMatch(/^ERROR: .*does not exist/);
    const g = runLine("flagctl disable zz_secret_flag", ctx({ offers: () => false }));
    expect(g.dispatch).toBeUndefined();
    expect(text(g)).toMatch(/^flagctl: /);
  });

  it("a line that matches nothing reads the same as one that is not offered yet", () => {
    const notOffered = runLine("kubectl rollout undo deployment/checkout", ctx({ offers: () => false }));
    const nothing = runLine("kubectl rollout undo deployment/ghost", ctx());
    expect(nothing.dispatch).toBeUndefined();
    expect(text(nothing)).toBe(text(notOffered));
    expect(text(nothing)).not.toContain("not found");
    expect(notOffered.lines.map((l) => l.kind)).toEqual(nothing.lines.map((l) => l.kind));
    // A real service on the map is never named as missing (review I2).
    expect(text(runLine("kubectl rollout undo deployment/checkout --bogus", ctx({ offers: () => false })))).not.toMatch(/deployments\.apps|"checkout"/);
  });

  it("says another operation is in progress while the engine is busy, and dispatches nothing", () => {
    const r = runLine("kubectl rollout undo deployment/checkout", ctx({ check: () => "busy" }));
    expect(r.dispatch).toBeUndefined();
    expect(text(r)).toBe("another operation is in progress");
  });

  it("while busy or before the ack, a wrong command in the vocabulary answers like a valid one (review I4)", () => {
    const busy = ctx({ check: () => "busy" });
    expect(text(runLine("kubectl nonsense --foo", busy))).toBe(text(runLine("kubectl rollout undo deployment/checkout", busy)));
    expect(text(runLine("kubectl nonsense --foo", busy))).toBe("another operation is in progress");
    const paging = ctx({ phase: "paging", check: () => "not_acknowledged" });
    expect(text(runLine("kubectl nonsense --foo", paging))).toBe(text(runLine("kubectl rollout undo deployment/checkout", paging)));
    expect(text(runLine("kubectl nonsense --foo", paging))).toMatch(/ack/);
    // a word outside the vocabulary is still command not found
    expect(text(runLine("ls", busy))).toBe("ls: command not found");
  });

  it("tells you to acknowledge first when the page is not acknowledged", () => {
    const r = runLine("kubectl rollout undo deployment/checkout", ctx({ phase: "paging", check: () => "not_acknowledged" }));
    expect(r.dispatch).toBeUndefined();
    expect(text(r)).toMatch(/ack/);
  });

  it("a keyed fix matches with extra flags, a host, a service label or other quoting", () => {
    const d = (line: string) => runLine(line, ctx()).dispatch;
    expect(d("kubectl rollout undo deployment/checkout --dry-run=false -n prod")).toBe("checkout.rollback");
    expect(d("kubectl -n prod rollout undo deployment/checkout")).toBe("checkout.rollback");
    expect(d("kubectl rollout undo deployment/Checkout API")).toBe("checkout.rollback");
    expect(d(`psql -h db1 -c "SELECT pg_drop_replication_slot('reporting_cdc')"`)).toBe("postgres.connections");
    expect(d(`psql -c 'select pg_drop_replication_slot("reporting_cdc")'`)).toBe("postgres.connections");
  });

  it("a keyed fix with a missing key does not match", () => {
    expect(runLine("kubectl rollout undo deployment/payments", ctx()).dispatch).toBeUndefined();
    expect(runLine("kubectl rollout restart", ctx()).dispatch).toBeUndefined();
    expect(runLine(`psql -c "SELECT pg_drop_replication_slot('other')"`, ctx()).dispatch).toBeUndefined();
  });

  it("an ambiguous input matches nothing", () => {
    expect(runLine("kubectl rollout undo restart deployment/checkout", ctx()).dispatch).toBeUndefined();
  });

  it("never matches a teammate question (no cli)", () => {
    expect(runLine("ask.deployer.changes", ctx()).dispatch).toBeUndefined();
  });
});

describe("runLine: unknown input (M6 spec H6)", () => {
  it("prints command not found, with a did-you-mean from builtins and the global vocabulary", () => {
    const r = runLine("kubctl get pods", ctx());
    expect(r.lines[0]!.text).toBe("kubctl: command not found");
    expect(text(r)).toContain("kubectl");
    expect(text(runLine("hlep", ctx()))).toContain("help");
  });

  it("gives no suggestion when nothing is close", () => {
    expect(runLine("zzzzzz", ctx()).lines.map((l) => l.text)).toEqual(["zzzzzz: command not found"]);
  });

  it("an empty line does nothing", () => {
    expect(runLine("   ", ctx()).lines).toEqual([]);
  });

  it("no output ever contains a word that only this scenario's commands have", () => {
    const inputs = [
      ...Object.values(FIXTURE_CLI),
      "kubectl",
      "kubectl rollout",
      "psql",
      "psql -c",
      "flagctl",
      "flagctl disable",
      "flagctl disabel zz",
      "psql -c 'SELECT 1'",
      "kubctl rollout undo",
      "incidentctl",
      "help",
      "services",
      "history",
      "status",
      "ack",
      "foo",
    ];
    for (const offers of [() => true, () => false]) {
      for (const phase of ["paging", "active"] as const) {
        for (const line of inputs) {
          const out = text(runLine(line, ctx({ offers, phase, history: ["help"] })));
          for (const secret of FIXTURE_SECRETS) expect(out, `${line} -> ${out}`).not.toContain(secret);
        }
      }
    }
  });
});

describe("runLine: builtins (M6 spec H7)", () => {
  it("help prints the shared CLI_HELP", () => {
    expect(runLine("help", ctx()).lines.map((l) => l.text)).toEqual([...CLI_HELP, ...HELP_EXTRA]);
  });

  it("runbook lists the offered investigations by their resolved command, never fixes or unoffered checks", () => {
    const r = text(runLine("runbook", ctx({ offers: (id) => id !== "checkout.deploys" })));
    expect(r).toContain("kubectl logs deployment/edge --since=15m");
    expect(r).toContain("kubectl top pods -l app=checkout");
    expect(r).not.toContain("rollout history");
    for (const fix of ["undo", "restart", "zz_secret_flag", "status-page", "page secondary"]) expect(r).not.toContain(fix);
    expect(text(runLine("runbook", ctx({ offers: () => false })))).toMatch(/nothing/i);
  });

  it("runbook fills per-run values", () => {
    const sc = { ...fixtureScenario, actions: [{ id: "x.check", label: "x", serviceId: null, category: "investigate", durationS: 5, verdict: "useful", cli: "psql -c \"select {pid}\"", cliVars: () => ({ pid: 42 }) }] } as unknown as TerminalCtx["scenario"];
    expect(text(runLine("runbook", ctx({ scenario: sc, state: () => ({}) as never })))).toContain('psql -c "select 42"');
  });

  it("help is the same cheat sheet for every incident and names no scenario command", () => {
    const a = text(runLine("help", ctx()));
    expect(a).toMatch(/<service>/);
    expect(a).toBe(text(runLine("help", ctx({ scenario: { ...fixtureScenario, actions: [] } }))));
  });

  it("ack acknowledges only a page that is waiting", () => {
    expect(runLine("ack", ctx({ phase: "paging" })).ack).toBe(true);
    const r = runLine("ack", ctx({ phase: "active" }));
    expect(r.ack).toBeUndefined();
    expect(text(r)).toMatch(/nothing to acknowledge/i);
  });

  it("status prints what the app gives it", () => {
    expect(runLine("status", ctx()).lines.map((l) => l.text)).toEqual(["Objective: stop the errors", "Budget left: 99%", "Elapsed: 0:20"]);
  });

  it("services lists the map's services by id and name", () => {
    const out = text(runLine("services", ctx()));
    for (const s of fixtureScenario.services) expect(out).toContain(s.label);
  });

  it("history numbers the lines typed this shift", () => {
    expect(text(runLine("history", ctx({ history: ["help", "services"] })))).toBe("1  help\n2  services");
    expect(text(runLine("history", ctx()))).toMatch(/no commands yet/i);
  });

  it("clear asks the terminal to clear", () => {
    expect(runLine("clear", ctx()).clear).toBe(true);
  });
});

describe("complete (M6 spec H8)", () => {
  const c = ctx();
  it("completes the first word from builtins and the vocabulary", () => {
    expect(complete("kub", c)).toEqual({ text: "kubectl ", options: [] });
    expect(complete("ac", c)).toEqual({ text: "ack ", options: [] });
  });

  it("lists the options when the word is ambiguous", () => {
    const r = complete("k", c);
    expect(r.text).toBe("k");
    expect(r.options).toEqual(["kafka-consumer-groups", "kubectl"]);
  });

  it("completes service names after deployment/ and app=", () => {
    expect(complete("kubectl logs deployment/pay", c).text).toBe("kubectl logs deployment/payments");
    expect(complete("kubectl top pods -l app=po", c).text).toBe("kubectl top pods -l app=postgres");
    const r = complete("kubectl logs deployment/ch", c);
    expect(r.text).toBe("kubectl logs deployment/checkout");
    expect(r.options).toEqual(["checkout", "checkout-api"]);
  });

  it("never completes a slot, flag or other scenario identifier", () => {
    for (const line of ["flagctl disable zz", "flagctl disable ", 'psql -c "SELECT pg_drop_rep', "kubectl rollout un", "kubectl logs deployment/checkout --si"]) {
      const r = complete(line, c);
      expect(r.text, line).toBe(line);
      expect(r.options, line).toEqual([]);
    }
  });
});

describe("runLine: per-run values (cliVars)", () => {
  const withPid = {
    ...fixtureScenario,
    actions: [
      ...fixtureScenario.actions,
      { id: "db.kill", label: "Kill it", serviceId: null, category: "fix", durationS: 5, verdict: "useful", cli: `psql -c "SELECT pg_terminate_backend({pid});"`, cliVars: () => ({ pid: 24117 }) },
    ],
  } as TerminalCtx["scenario"];
  const state = { pid: 24117 };

  it("matches the command with this run's value filled in", () => {
    expect(runLine(`psql -c "select pg_terminate_backend(24117)"`, ctx({ scenario: withPid, state: () => state })).dispatch).toBe("db.kill");
  });

  it("does not match the placeholder or another value", () => {
    expect(runLine(`psql -c "SELECT pg_terminate_backend({pid});"`, ctx({ scenario: withPid, state: () => state })).dispatch).toBeUndefined();
    expect(runLine(`psql -c "SELECT pg_terminate_backend(24118);"`, ctx({ scenario: withPid, state: () => state })).dispatch).toBeUndefined();
  });
});
