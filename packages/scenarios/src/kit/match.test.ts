import { describe, expect, it } from "vitest";
import { canonicalCli, matchCli, type MatchableAction } from "./match";

const services = [
  { id: "checkout", label: "checkout-api" },
  { id: "postgres", label: "postgres" },
];
const actions: MatchableAction[] = [
  { id: "pg.slots", cli: `psql -c "SELECT slot_name, active FROM pg_replication_slots;"` },
  { id: "pg.drop", cli: `psql -c "SELECT pg_drop_replication_slot('reporting_cdc');"`, cliKeys: ["pg_drop_replication_slot", "reporting_cdc"] },
  { id: "pg.drop_other", cli: `psql -c "SELECT pg_drop_replication_slot('analytics');"`, cliKeys: ["pg_drop_replication_slot", "analytics"] },
  { id: "co.undo", cli: "kubectl rollout undo deployment/checkout", cliKeys: ["rollout", "undo", "deployment/checkout"] },
  { id: "co.restart", cli: "kubectl rollout restart deployment/checkout", cliKeys: ["rollout", "restart", "deployment/checkout"] },
  { id: "pg.kill", cli: `psql -c "SELECT pg_terminate_backend({pid});"`, cliVars: () => ({ pid: 24117 }), cliKeys: ["pg_terminate_backend", "{pid}"] },
];
const match = (input: string) => matchCli(actions, input, {}, services)?.id;

describe("canonicalCli", () => {
  it("maps a service label to its id after deployment/ and app=", () => {
    expect(canonicalCli("kubectl rollout undo deployment/checkout-api", services)).toBe("kubectl rollout undo deployment/checkout");
    expect(canonicalCli("kubectl top pods -l app=Checkout-API", services)).toBe("kubectl top pods -l app=checkout");
  });
});

describe("matchCli (M6 review C1)", () => {
  it("matches an action without keys only on its whole command", () => {
    expect(match(`psql -c "select slot_name, active from pg_replication_slots"`)).toBe("pg.slots");
    expect(match(`psql -c "select * from pg_replication_slots"`)).toBeUndefined();
  });

  it("matches a keyed action on its command word and every key, whatever else is typed", () => {
    expect(match(`psql -c "select pg_drop_replication_slot('reporting_cdc')"`)).toBe("pg.drop");
    expect(match(`psql -h postgres -c 'SELECT pg_drop_replication_slot( "reporting_cdc" );'`)).toBe("pg.drop");
    expect(match(`psql -c "select pg_drop_replication_slot('analytics')"`)).toBe("pg.drop_other");
  });

  it("needs every key, as a whole word", () => {
    expect(match(`psql -c "select pg_drop_replication_slot('reporting')"`)).toBeUndefined();
    expect(match(`psql -c "select pg_drop_replication_slot('reporting_cdc_old')"`)).toBeUndefined();
    expect(match("kubectl rollout undo deployment/checkout2")).toBeUndefined();
  });

  it("needs the same command word", () => {
    expect(match(`redis-cli pg_drop_replication_slot reporting_cdc`)).toBeUndefined();
  });

  it("accepts the service's label and extra flags", () => {
    expect(match("kubectl rollout undo deployment/checkout-api -n shop")).toBe("co.undo");
    expect(match("kubectl -n shop rollout restart deployment/checkout")).toBe("co.restart");
  });

  it("fills per-run keys from the state", () => {
    expect(match(`psql -c "select pg_terminate_backend(24117)"`)).toBe("pg.kill");
    expect(match(`psql -c "select pg_terminate_backend(24118)"`)).toBeUndefined();
  });

  it("refuses an input that would match two keyed actions equally", () => {
    const both = matchCli(actions, `psql -c "select pg_drop_replication_slot('reporting_cdc'), pg_drop_replication_slot('analytics')"`, {}, services);
    expect(both).toBeUndefined();
  });
});

describe("a key with a value", () => {
  it("matches only that value, so the safe setting never triggers the unsafe action", () => {
    const tls: MatchableAction[] = [{ id: "bypass", cli: "kubectl set env deployment/checkout TLS_VERIFY=off", cliKeys: ["set", "env", "deployment/checkout", "tls_verify=off"] }];
    expect(matchCli(tls, "kubectl set env deployment/checkout TLS_VERIFY=off", {}, services)?.id).toBe("bypass");
    expect(matchCli(tls, "kubectl set env deployment/checkout TLS_VERIFY=on", {}, services)).toBeUndefined();
  });
});

describe("second review fixes", () => {
  const cfg: MatchableAction[] = [
    { id: "fix", cli: `kubectl exec deployment/checkout -- config set inventory.client.max_retries = 1`, cliKeys: ["config", "set", "inventory.client.max_retries=0|1|2"] },
    { id: "status", cli: `incidentctl status-page "Investigating"`, cliKeys: ["status-page"] },
    { id: "page", cli: "incidentctl page secondary", cliKeys: ["page", "secondary"] },
    { id: "skip", cli: "kafka-consumer-groups.sh --group g --reset-offsets --to-offset 5 --execute", cliKeys: ["--reset-offsets", "--to-offset", "5"] },
  ];
  const m = (input: string) => matchCli(cfg, input, {}, services)?.id;

  it("a key=value pair matches with or without spaces around =, and any listed value", () => {
    expect(m("kubectl exec deployment/checkout -- config set inventory.client.max_retries=0")).toBe("fix");
    expect(m("kubectl exec deployment/checkout -- config set inventory.client.max_retries = 2")).toBe("fix");
    expect(m("kubectl exec deployment/checkout -- config set inventory.client.max_retries = 5")).toBeUndefined();
  });

  it("refuses a line that gives a pair's setting more than one value", () => {
    expect(m("kubectl exec deployment/checkout -- config set inventory.client.max_retries = 0 1 2")).toBeUndefined();
    expect(m("kubectl exec deployment/checkout -- config set inventory.client.max_retries=5 inventory.client.max_retries=1")).toBeUndefined();
  });

  it("free text in an incidentctl message never counts as keys", () => {
    expect(m(`incidentctl status-page "Investigating, will page secondary"`)).toBe("status");
    expect(m("incidentctl page secondary")).toBe("page");
  });

  it("a dry run never counts as the change", () => {
    expect(m("kubectl --dry-run=client exec deployment/checkout -- config set inventory.client.max_retries=1")).toBeUndefined();
    expect(m("kubectl --dry-run exec deployment/checkout -- config set inventory.client.max_retries=1")).toBeUndefined();
    // --dry-run=none (or the old =false) means "really do it".
    expect(m("kubectl --dry-run=none exec deployment/checkout -- config set inventory.client.max_retries=1")).toBe("fix");
    expect(m("kubectl --dry-run=false exec deployment/checkout -- config set inventory.client.max_retries=1")).toBe("fix");
  });

  it("accepts deploy/ and deployments/ for deployment/, and ./ before a file", () => {
    const k: MatchableAction[] = [
      { id: "undo", cli: "kubectl rollout undo deployment/checkout", cliKeys: ["rollout", "undo", "deployment/checkout"] },
      { id: "apply", cli: "kubectl apply -f checkout-mtls-client.yaml", cliKeys: ["apply", "checkout-mtls-client.yaml"] },
    ];
    expect(matchCli(k, "kubectl rollout undo deploy/checkout-api", {}, services)?.id).toBe("undo");
    expect(matchCli(k, "kubectl rollout undo deployments/checkout", {}, services)?.id).toBe("undo");
    expect(matchCli(k, "kubectl apply -f ./checkout-mtls-client.yaml", {}, services)?.id).toBe("apply");
  });
});

/** A test-only clock (this package has no DOM or Node types, and its game code never reads time). */
const clock = (globalThis as unknown as { performance: { now(): number } }).performance;

describe("long hostile input (CodeQL js/polynomial-redos)", () => {
  it("normalises 50k spaces, tabs and semicolons quickly", () => {
    const junk = `psql -c "${" \t".repeat(25_000)}x${" ;".repeat(25_000)}`;
    const started = clock.now();
    canonicalCli(junk + " a" + " ".repeat(50_000) + "b", services);
    canonicalCli(`kubectl ${"\t".repeat(50_000)}x`, services);
    expect(clock.now() - started).toBeLessThan(200);
  });
});
