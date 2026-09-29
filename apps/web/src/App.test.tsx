import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { loadCafe } from "./cafe/Stage";

// The café chunk is in, as after the desktop's idle warm-up.
beforeAll(() => loadCafe());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("App", () => {
  it("on a wide screen, opens straight onto the PitOS desktop", () => {
    render(<App newSeed={() => 1} />);
    expect(screen.getByRole("main", { name: "Desktop" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Pit Wall On-Call" })).toBeTruthy();
  });

  it("below 1024 px, shows the on-call lockscreen", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    render(<App newSeed={() => 1} />);
    expect(screen.getByRole("main", { name: "Lock screen" })).toBeTruthy();
  });

  it("plays from the desktop to an acknowledged incident in Monitoring", async () => {
    render(<App newSeed={() => 1} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice shift" }));
    // Start shift pulls back to the café; its own controls skip ahead, and A acknowledges from anywhere.
    fireEvent.click(within(screen.getByRole("group", { name: "Café controls" })).getByRole("button", { name: "Skip to the page" }));
    fireEvent.keyDown(window, { key: "a" });
    // The ack leaves you on the desktop; its notice points to Monitoring.
    fireEvent.click(await screen.findByRole("button", { name: "Open Monitoring" }));
    const monitoring = await screen.findByRole("region", { name: "Monitoring" });
    expect(monitoring.querySelector('[aria-labelledby="alerts-h"]')).toBeTruthy();
  });
});
