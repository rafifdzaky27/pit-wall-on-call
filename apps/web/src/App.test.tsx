import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

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
    fireEvent.click(screen.getByRole("button", { name: "Start shift" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    const monitoring = await screen.findByRole("region", { name: "Monitoring" });
    expect(monitoring.querySelector('[aria-labelledby="alerts-h"]')).toBeTruthy();
  });
});
