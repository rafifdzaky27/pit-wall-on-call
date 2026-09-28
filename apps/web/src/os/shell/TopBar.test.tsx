import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Stage } from "../../cafe/Stage";
import { radio } from "../audio/lofi";
import { loadPrefs } from "../prefs";
import { renderOs } from "../testing";
import { TopBar } from "./TopBar";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete (document.documentElement as { requestFullscreen?: unknown }).requestFullscreen;
});

const setup = (onLock = vi.fn()) => ({ onLock, ...renderOs(<TopBar overview={false} onActivities={() => {}} onLock={onLock} />) });

/** The System menu loads on its first open (M1.6 main-chunk budget), so tests wait for it. */
const openSystem = async () => {
  fireEvent.click(screen.getByRole("button", { name: "System" }));
  await screen.findByRole("group", { name: "Quick settings" });
};

describe("TopBar", () => {
  it("opens one menu at a time", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    expect(screen.getByRole("dialog", { name: "Phone notifications" })).toBeTruthy();
    await openSystem();
    expect(screen.getByRole("group", { name: "Quick settings" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Phone notifications" })).toBeNull();
  });

  it("closes the menu with Esc or a click outside the top bar", async () => {
    setup();
    await openSystem();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Quick settings" })).toBeNull();
    await openSystem();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("group", { name: "Quick settings" })).toBeNull();
  });

  it("quick settings change the volume, mute and theme", async () => {
    setup();
    await openSystem();
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "40" } });
    expect(loadPrefs().volume).toBe(40);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(loadPrefs().muted).toBe(true);
    expect((screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement).value).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("offers Look up only once the shift has started", () => {
    const view = renderOs(
      <Stage>
        <TopBar overview={false} onActivities={() => {}} onLock={() => {}} />
      </Stage>,
    );
    expect(screen.queryByRole("button", { name: /^Look up/ })).toBeNull();
    act(() => view.incident().start());
    // The bar is a three-column grid; Look up lives in the tray, never as a fourth column.
    expect(document.querySelector(".os-topbar")!.children).toHaveLength(3);
    expect(screen.getByRole("button", { name: /^Look up/ }).closest(".os-tray")).not.toBeNull();
    act(() => fireEvent.keyDown(window, { key: "l" }));
    fireEvent.click(screen.getByRole("button", { name: /^Look up/ }));
    expect(document.querySelector("[data-testid=stage-screen]")!.hasAttribute("inert")).toBe(true);
  });

  it("quick settings play the lo-fi radio and skip to the next progression", async () => {
    const next = vi.spyOn(radio, "next").mockImplementation(() => {});
    setup();
    await openSystem();
    expect(screen.queryByRole("button", { name: "Next track" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play lo-fi radio" }));
    expect(loadPrefs().radio).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Pause lo-fi radio" }));
    expect(loadPrefs().radio).toBe(false);
    next.mockRestore();
  });

  it("offers Full screen only where the browser supports it", async () => {
    setup();
    await openSystem();
    expect(screen.queryByRole("button", { name: /Full screen/ })).toBeNull();
    cleanup();
    const request = vi.fn(async () => undefined);
    Object.assign(document.documentElement, { requestFullscreen: request });
    setup();
    await openSystem();
    fireEvent.click(screen.getByRole("button", { name: /Full screen/ }));
    expect(request).toHaveBeenCalled();
  });

  it("About PitOS opens Settings on its About page, and Lock locks", async () => {
    const { os, onLock } = setup();
    await openSystem();
    fireEvent.click(screen.getByRole("button", { name: "About PitOS" }));
    expect(os().settingsPage).toBe("about");
    expect(os().wm.windows.map((w) => w.appId)).toEqual(["settings"]);
    await openSystem();
    fireEvent.click(screen.getByRole("button", { name: "Lock" }));
    expect(onLock).toHaveBeenCalled();
  });

  it("the clock shows unread notifications and opens the calendar, which marks them read and can clear them", async () => {
    const { os } = setup();
    act(() => os().pushNotice({ id: "n", app: "Chat", title: "Laras", body: "check v142?", actions: [] }));
    const clock = screen.getByRole("button", { name: /unread notifications/ });
    fireEvent.click(clock);
    const cal = await screen.findByRole("dialog", { name: "Calendar and notifications" });
    expect(cal.textContent).toContain("check v142?");
    expect(cal.querySelector('[aria-current="date"]')).toBeTruthy();
    await vi.waitFor(() => expect(screen.queryByRole("button", { name: /unread notifications/ })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(cal.textContent).toContain("No notifications");
  });
});
