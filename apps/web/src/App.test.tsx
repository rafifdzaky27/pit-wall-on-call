import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const online = async () => "abc1234";

describe("App", () => {
  it("shows the API version when the API is up", async () => {
    render(<App fetchVersion={online} />);
    expect(await screen.findByText("API online · abc1234")).toBeTruthy();
  });

  it("shows unreachable when the API call fails", async () => {
    render(
      <App
        fetchVersion={async () => {
          throw new Error("HTTP 502");
        }}
      />,
    );
    expect(await screen.findByText("API unreachable")).toBeTruthy();
  });

  it("landing pitches the game and offers the first scenario", async () => {
    render(<App fetchVersion={online} />);
    expect(screen.getByRole("heading", { level: 1, name: "Pit Wall On-Call" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The Slow Leak" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start shift" })).toBeTruthy();
    await screen.findByText("API online · abc1234");
  });

  it("on a small screen, explains why the console is not offered", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<App fetchVersion={online} />);
    expect(screen.queryByRole("button", { name: "Start shift" })).toBeNull();
    expect(screen.getByText(/needs a screen at least 1024 px wide/)).toBeTruthy();
    await screen.findByText("API online · abc1234");
    vi.unstubAllGlobals();
  });

  it("plays through: start, pre-page, page, ack, console, pause and resume", async () => {
    render(<App fetchVersion={online} newSeed={() => 1} />);
    await screen.findByText("API online · abc1234");
    fireEvent.click(screen.getByRole("button", { name: "Start shift" }));
    expect(screen.getByRole("heading", { name: "A quiet evening at the café" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Laptop: Slack #deploys" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(screen.getByRole("alertdialog", { name: "Checkout returning 5xx" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(screen.getByRole("region", { name: "Alerts" })).toBeTruthy();
    expect(screen.getByText(/Dimas: shipping the checkout refactor/)).toBeTruthy();

    fireEvent.keyDown(window, { key: "p" });
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Alerts" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
    expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
    expect(screen.getByRole("region", { name: "Alerts" })).toBeTruthy();
  });

  it("the pre-page ends by itself after its time", async () => {
    vi.useFakeTimers();
    render(<App fetchVersion={online} newSeed={() => 1} prepageMs={18_000} />);
    fireEvent.click(screen.getByRole("button", { name: "Start shift" }));
    act(() => vi.advanceTimersByTime(18_000));
    expect(screen.getByRole("alertdialog", { name: "Checkout returning 5xx" })).toBeTruthy();
  });
});
