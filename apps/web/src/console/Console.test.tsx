import { ACK, Run, type State } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Console } from "./Console";

afterEach(cleanup);

function setup({ steps = 50, acked = true, inspect = [] as string[] } = {}) {
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
      brand="Northbound"
      check={(id) => run.check(id)}
      onAction={onAction}
      onPause={onPause}
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

  it("shows what the player noticed before the page, with the brand filled in", () => {
    setup({ inspect: ["wall.poster"] });
    expect(screen.getByText("Northbound FLASH SALE 50% today")).toBeTruthy();
  });

  it("explains empty states", () => {
    setup({ steps: 0 });
    expect(screen.getByText("You went straight to the page. Nothing noted.")).toBeTruthy();
    expect(screen.getByText("No log lines from any service yet.")).toBeTruthy();
  });
});
