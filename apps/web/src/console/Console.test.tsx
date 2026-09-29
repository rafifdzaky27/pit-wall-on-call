import { ACK, Run, type State } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { resolveWorld } from "@pitwall/world";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Console } from "./Console";

afterEach(cleanup);

const world = resolveWorld(1);

function setup({ steps = 50, acked = true, inspect = [] as string[], active = true } = {}) {
  const run = new Run<State>(slowLeak, 1);
  for (const id of inspect) run.dispatch(`inspect:${id}`);
  if (acked) run.dispatch(ACK);
  for (let i = 0; i < steps; i++) run.step();
  const onAction = vi.fn();
  const onPause = vi.fn();
  const view = () => (
    <Console
      scenario={slowLeak}
      snapshot={run.snapshot()}
      logs={run.logs}
      history={{}}
      world={world}
      check={(id) => run.check(id)}
      onAction={onAction}
      onPause={onPause}
      active={active}
    />
  );
  const utils = render(view());
  return { run, onAction, onPause, rerender: () => utils.rerender(view()) };
}

describe("Console", () => {
  it("shows the page title, the clock and the budget burned", () => {
    setup();
    expect(screen.getByText("Checkout returning 5xx")).toBeTruthy();
    expect(screen.getByLabelText("Incident time").textContent).toContain("00:05");
    expect(screen.getByRole("meter", { name: "Error budget burned" })).toBeTruthy();
  });

  it("explains the error budget, 5xx, p99 and the pool with glossary terms", async () => {
    setup();
    const described = async (word: string) => {
      const term = screen.getByText(word, { selector: ".term" });
      fireEvent.focus(term);
      const tip = (await screen.findByRole("tooltip")).textContent;
      fireEvent.blur(term);
      return tip;
    };
    expect(await described("Error budget")).toContain("fail");
    expect(screen.getByRole("heading", { name: "5xx rate" })).toBeTruthy();
    expect(await described("5xx")).toContain("server failed");
    fireEvent.click(screen.getByRole("button", { name: /^checkout-api/ }));
    expect(screen.getByRole("heading", { name: "p99 latency" })).toBeTruthy();
    expect(await described("p99")).toContain("1 in 100");
    expect(await described("Pool")).toContain("database connections");
  });

  it("lists firing alerts with a text severity", () => {
    setup();
    const alerts = screen.getByRole("region", { name: "Alerts" });
    expect(within(alerts).getByText("PostgresConnectionsHigh")).toBeTruthy();
    expect(within(alerts).getAllByText("Crit").length).toBeGreaterThan(0);
  });

  it("renders services as buttons that name their health", () => {
    setup();
    expect(screen.getByRole("button", { name: /postgres.*Critical/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /payments.*Healthy/ })).toBeTruthy();
  });

  it("selecting a node focuses metrics, actions and the log filter on it", () => {
    setup({ steps: 200 });
    fireEvent.click(screen.getByRole("button", { name: /^postgres/ }));
    expect(screen.getByRole("button", { name: /^postgres/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "postgres" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Inspect active connections/ })).toBeTruthy();
    expect(screen.getByLabelText("Connections metric")).toBeTruthy();
    const logs = screen.getByRole("region", { name: "Logs" });
    expect(within(logs).getByRole("button", { name: /Clear filter/ })).toBeTruthy();
    const services = within(logs).getAllByTestId("log-service").map((el) => el.textContent);
    expect(services.length).toBeGreaterThan(0);
    expect(services.every((s) => s === "postgres")).toBe(true);
  });

  it("ignores number keys while Monitoring is not the active window", () => {
    setup({ active: false });
    fireEvent.keyDown(window, { key: "2" });
    expect(screen.getByRole("button", { name: /^checkout-api/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("number keys select services and Esc clears the log filter", () => {
    setup();
    fireEvent.keyDown(window, { key: "2" });
    expect(screen.getByRole("button", { name: /^checkout-api/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Clear filter/ })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: /Clear filter/ })).toBeNull();
    fireEvent.keyDown(window, { key: "3", ctrlKey: true });
    expect(screen.getByRole("button", { name: /^checkout-api/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("dispatches actions and shows the running one with its time left", () => {
    const { run, onAction, rerender } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^checkout-api/ }));
    fireEvent.click(screen.getByRole("button", { name: /Check connection pool/ }));
    expect(onAction).toHaveBeenCalledWith("checkout.pool_stats");
    run.dispatch("checkout.pool_stats");
    rerender();
    expect(screen.getByRole("status").textContent).toContain("Running: Check connection pool");
    expect((screen.getByRole("button", { name: /Roll back to v141/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("the pause button calls onPause", () => {
    const { onPause } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    expect(onPause).toHaveBeenCalled();
  });

  it("shows what the player noticed before the page, with names filled in", () => {
    setup({ inspect: ["wall.poster", "laptop.slack.deploys"] });
    expect(screen.getByText(`${world.brand.name} FLASH SALE 50% today`)).toBeTruthy();
    expect(screen.getByText(`${world.colleagues.deployer}: shipping the checkout refactor (v142), heading home`)).toBeTruthy();
  });

  it("ignores number keys typed into a text field", () => {
    setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "3" });
    expect(screen.getByRole("button", { name: /^postgres/ }).getAttribute("aria-pressed")).toBe("false");
    input.remove();
  });

  it("digits do nothing when single-key shortcuts are off", () => {
    const run = new Run<State>(slowLeak, 1);
    run.dispatch(ACK);
    render(
      <Console scenario={slowLeak} snapshot={run.snapshot()} logs={run.logs} history={{}} world={world} check={(id) => run.check(id)} onAction={vi.fn()} onPause={vi.fn()} shortcuts={false} />,
    );
    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByRole("button", { name: /^postgres/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("explains empty states", () => {
    setup({ steps: 0 });
    expect(screen.getByText("You went straight to the page. Nothing noted.")).toBeTruthy();
    expect(screen.getByText("No log lines from any service yet.")).toBeTruthy();
  });
});
