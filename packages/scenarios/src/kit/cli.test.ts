import { describe, expect, it } from "vitest";
import { cliFirstWord, cliFor, cliIsBalanced, cliPlaceholders, normaliseCli } from "./cli";

describe("normaliseCli (M6 spec H5)", () => {
  it("trims, collapses whitespace and lowercases outside quotes", () => {
    expect(normaliseCli("  Kubectl   ROLLOUT undo\tdeployment/Checkout ")).toBe("kubectl rollout undo deployment/checkout");
  });

  it("keeps spacing inside quotes, ignores case everywhere, and treats single and double quotes alike", () => {
    expect(normaliseCli(`psql -c "SELECT pg_drop_replication_slot('Reporting_CDC');"`)).toBe(normaliseCli(`PSQL -c 'SELECT pg_drop_replication_slot("Reporting_CDC");'`));
    expect(normaliseCli(`grep "Timeout  X"`)).toBe(`grep "timeout  x"`);
    expect(normaliseCli(`psql -c "select 1"`)).toBe(normaliseCli(`psql -c "SELECT 1"`));
  });

  it("strips trailing semicolons outside quotes", () => {
    expect(normaliseCli("redis-cli info stats;")).toBe("redis-cli info stats");
    expect(normaliseCli("redis-cli info stats ; ;")).toBe("redis-cli info stats");
    // SQL inside quotes may end with or without its own semicolon.
    expect(normaliseCli(`psql -c "SELECT 1;"`)).toBe(normaliseCli(`psql -c "SELECT 1"`));
  });
});

describe("cli helpers", () => {
  it("finds the first word", () => {
    expect(cliFirstWord("  kubectl get pods")).toBe("kubectl");
    expect(cliFirstWord("")).toBe("");
  });

  it("checks quotes are balanced", () => {
    expect(cliIsBalanced(`psql -c "SELECT 1;"`)).toBe(true);
    expect(cliIsBalanced(`psql -c "SELECT 'a';"`)).toBe(true);
    expect(cliIsBalanced(`psql -c "SELECT 1;`)).toBe(false);
  });
});

describe("cliFor (per-run values)", () => {
  it("fills {name} placeholders from cliVars with the run's state", () => {
    const action = { cli: `psql -c "SELECT pg_terminate_backend({pid});"`, cliVars: (s: { pid: number }) => ({ pid: s.pid }) };
    expect(cliFor(action, { pid: 24117 })).toBe(`psql -c "SELECT pg_terminate_backend(24117);"`);
  });

  it("returns a plain cli unchanged, and undefined when there is none", () => {
    expect(cliFor({ cli: "kubectl rollout undo deployment/checkout" }, {})).toBe("kubectl rollout undo deployment/checkout");
    expect(cliFor({}, {})).toBeUndefined();
  });

  it("lists the placeholders a cli needs", () => {
    expect(cliPlaceholders("kafka --offset {offset} --to {next}")).toEqual(["offset", "next"]);
    expect(cliPlaceholders("kubectl get pods")).toEqual([]);
  });
});
