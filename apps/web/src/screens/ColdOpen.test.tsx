import { slowLeak } from "@pitwall/scenarios";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColdOpen } from "./ColdOpen";

afterEach(cleanup);

const props = (over: Partial<Parameters<typeof ColdOpen>[0]> = {}) => ({
  coldOpen: slowLeak.coldOpen,
  brand: "Kettle & Co.",
  phase: "prepage" as const,
  ticks: 0,
  escalated: false,
  onInspect: vi.fn(),
  onSkip: vi.fn(),
  onAck: vi.fn(),
  ...over,
});

describe("ColdOpen", () => {
  it("before the page, lists the hotspots that already exist", () => {
    render(<ColdOpen {...props()} />);
    expect(screen.getByRole("button", { name: "Laptop: Slack #deploys" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Poster on the wall" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Phone: new mention" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Acknowledge/ })).toBeNull();
  });

  it("opening a hotspot reveals its text once and inspects it once", () => {
    const p = props();
    render(<ColdOpen {...p} />);
    const poster = screen.getByRole("button", { name: "Poster on the wall" });
    fireEvent.click(poster);
    fireEvent.click(poster);
    expect(screen.getByText("Kettle & Co. FLASH SALE 50% today")).toBeTruthy();
    expect(poster.getAttribute("aria-expanded")).toBe("true");
    expect(p.onInspect).toHaveBeenCalledTimes(1);
    expect(p.onInspect).toHaveBeenCalledWith("wall.poster");
  });

  it("skip goes to the page", () => {
    const p = props();
    render(<ColdOpen {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(p.onSkip).toHaveBeenCalled();
  });

  it("the page is an alert dialog with the incident, the running clock and new hotspots", () => {
    render(<ColdOpen {...props({ phase: "paging", ticks: 73 })} />);
    const dialog = screen.getByRole("alertdialog", { name: "Checkout returning 5xx" });
    expect(dialog.textContent).toContain("00:07");
    expect(dialog.textContent).toContain("Checkout requests for Kettle & Co. are failing");
    expect(screen.getByRole("button", { name: "Phone: new mention" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip to the page" })).toBeNull();
  });

  it("acknowledges with the button or the A key, but not with Ctrl+A", () => {
    const p = props({ phase: "paging" });
    render(<ColdOpen {...p} />);
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    expect(p.onAck).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "a" });
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(p.onAck).toHaveBeenCalledTimes(2);
  });

  it("shows the escalation once the secondary is paged", () => {
    render(<ColdOpen {...props({ phase: "paging", escalated: true })} />);
    expect(screen.getByText(/Paging the secondary on-call/)).toBeTruthy();
  });
});
