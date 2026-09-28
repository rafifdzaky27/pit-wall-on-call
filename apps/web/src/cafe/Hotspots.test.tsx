import { slowLeak } from "@pitwall/scenarios";
import { fillWorld, resolveWorld } from "@pitwall/world";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPrefs } from "../os/prefs";
import { renderOs } from "../os/testing";
import { CafeControls } from "./CafeControls";
import { CameraContext, type CameraApi } from "./CameraContext";
import { Hotspots } from "./Hotspots";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const world = resolveWorld(1);
const EGG_NAMES = ["Sleeping café cat", "Days since last incident", "HUG OPS poster", "Clock stopped at 3:00", "The coder at the window seat"];

function setup(camera: Partial<CameraApi> = {}) {
  const api: CameraApi = { view: "cafe", started: true, closing: false, lookUp: vi.fn(), enterLaptop: vi.fn(), ...camera };
  const view = renderOs(
    <CameraContext.Provider value={api}>
      <Hotspots />
      <CafeControls />
    </CameraContext.Provider>,
  );
  return { ...view, api };
}

describe("café hotspots", () => {
  it("are real buttons, in reading order, followed by the café controls", () => {
    const { incident } = setup();
    act(() => incident().start());
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(names).toEqual([
      "Laptop",
      "Phone",
      "The next table",
      "Poster on the wall",
      "Radio, off",
      // The easter eggs come after the clues, so the clues keep their reading order (M2.5 spec §12).
      ...EGG_NAMES,
      "Skip to the page",
      "Back to laptop (L)",
    ]);
  });

  it("the easter eggs are named buttons that answer, but never count as clues or actions", () => {
    const { incident } = setup();
    act(() => incident().start());
    const before = { inspected: [...incident().snapshot.inspected], logs: incident().logs.length };
    fireEvent.click(screen.getByRole("button", { name: "Sleeping café cat" }));
    expect(screen.getByRole("status").textContent).toContain("The cat purrs. It has seen worse outages.");
    for (const name of EGG_NAMES) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(screen.getByRole("status").textContent!.length).toBeGreaterThan(10);
    }
    expect(incident().snapshot.inspected).toEqual(before.inspected);
    expect(incident().logs.length).toBe(before.logs);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("the days-since sign owns up once the page has fired", () => {
    const { incident } = setup();
    act(() => incident().start());
    fireEvent.click(screen.getByRole("button", { name: "Days since last incident" }));
    expect(screen.getByRole("status").textContent).not.toMatch(/(^|\D)0 days\b/);
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => incident().skipPrepage());
    fireEvent.click(screen.getByRole("button", { name: "Days since last incident" }));
    expect(screen.getByRole("status").textContent).toMatch(/(^|\D)0 days\b/);
  });

  it("the phone's island becomes a live pager activity while it rings, over a lock screen of notifications", () => {
    const { incident } = setup();
    act(() => incident().start());
    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    let phone = screen.getByRole("dialog", { name: "Phone" });
    expect(phone.querySelector(".phone-island")).not.toBeNull();
    expect(phone.querySelector(".phone-island.live")).toBeNull();
    fireEvent.click(within(phone).getByRole("button", { name: "Close" }));
    act(() => incident().skipPrepage());
    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    phone = screen.getByRole("dialog", { name: "Phone" });
    expect(phone.querySelector(".phone-island.live")?.textContent).toBe("SEV2 · Checkout 5xx · 00:00");
    expect(phone.querySelector(".phone-lock-time")?.textContent).toMatch(/^\d\d:\d\d$/);
    fireEvent.click(within(phone).getByRole("button", { name: /Acknowledge/ }));
    // After the ack the page stays in the stack, next to the mention.
    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    phone = screen.getByRole("dialog", { name: "Phone" });
    expect(phone.querySelectorAll(".phone-card")).toHaveLength(2);
    expect(phone.textContent).toContain("Checkout returning 5xx");
    expect(within(phone).queryByRole("button", { name: /Acknowledge/ })).toBeNull();
  });

  it("the next table is overheard: it counts as inspected and shows what they said", () => {
    const { incident } = setup();
    fireEvent.click(screen.getByRole("button", { name: "The next table" }));
    expect(incident().snapshot.inspected).toContain("table.neighbours");
    const caption = screen.getByRole("status");
    expect(caption.textContent).toContain(fillWorld(slowLeak.coldOpen.hotspots["table.neighbours"]!.text, world));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("the laptop takes you back into PitOS", () => {
    const { api } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Laptop" }));
    expect(api.enterLaptop).toHaveBeenCalled();
  });

  it("the phone shows its notifications, and while it rings it can acknowledge the page", () => {
    const { incident } = setup();
    act(() => incident().start());
    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    let phone = screen.getByRole("dialog", { name: "Phone" });
    expect(phone.textContent).toContain("No notifications");
    fireEvent.click(within(phone).getByRole("button", { name: "Close" }));
    act(() => incident().skipPrepage());
    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    phone = screen.getByRole("dialog", { name: "Phone" });
    expect(phone.textContent).toContain("SEV2");
    expect(phone.textContent).toContain(fillWorld(slowLeak.coldOpen.hotspots["phone.mention"]!.text, world));
    expect(incident().snapshot.inspected).toContain("phone.mention");
    fireEvent.click(within(phone).getByRole("button", { name: /Acknowledge/ }));
    expect(incident().phase).toBe("active");
  });

  it("the radio on the counter switches the lo-fi radio", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Radio, off" }));
    expect(loadPrefs().radio).toBe(true);
    expect(screen.getByRole("button", { name: "Radio, playing" })).toBeTruthy();
  });

  it("offers Skip only before the page, and Back to laptop always", () => {
    const { incident, api } = setup();
    act(() => incident().start());
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(incident().phase).toBe("paging");
    expect(screen.queryByRole("button", { name: "Skip to the page" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to laptop (L)" }));
    expect(api.enterLaptop).toHaveBeenCalled();
  });
});
