import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../../testing";
import { PostmortemApp } from "../postmortem/PostmortemApp";
import { MonitoringApp } from "./MonitoringApp";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MonitoringApp", () => {
  it("is calm before the shift and starts it", () => {
    const { incident } = renderOs(<MonitoringApp />);
    expect(screen.getByText("All systems normal")).toBeTruthy();
    expect(screen.getAllByText("Healthy")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Practice shift" }));
    expect(incident().phase).toBe("prepage");
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(incident().phase).toBe("paging");
  });

  it("while paging, shows the console with actions locked until the ack", () => {
    const { incident } = renderOs(<MonitoringApp />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    expect(screen.getByRole("alert").textContent).toContain("Acknowledge the page");
    expect(screen.getByRole("region", { name: "Alerts" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^checkout-api/ }));
    expect((screen.getByRole("button", { name: /Check connection pool/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(incident().phase).toBe("active");
    expect((screen.getByRole("button", { name: /Check connection pool/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("after the incident, points to the postmortem", () => {
    const { incident, os } = renderOs(
      <>
        <MonitoringApp />
        <PostmortemApp />
      </>,
    );
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("checkout.rollback"));
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("heading", { name: "Incident closed" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open postmortem" }));
    expect(os().wm.windows.map((w) => w.appId)).toContain("postmortem");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Resolved in/);
    expect(screen.getByText(/\/3$/)).toBeTruthy();
  });

  it("the postmortem's New shift starts a fresh shift", () => {
    const { incident } = renderOs(<PostmortemApp />);
    expect(screen.getByText("No incident has finished yet.")).toBeTruthy();
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("checkout.rollback"));
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.click(screen.getByRole("button", { name: "New shift" }));
    expect(incident().phase).toBe("idle");
    expect(incident().seed).toBe(2);
  });
});
