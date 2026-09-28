import { resolveWorld } from "@pitwall/world";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderOs } from "../testing";
import { Desktop } from "./Desktop";

afterEach(cleanup);
const world = resolveWorld(1);

describe("Desktop", () => {
  it("greets with the shift notification, wallpaper, widgets and dock", () => {
    const { container } = renderOs(<Desktop />);
    expect(screen.getByRole("heading", { name: `Shift ready · ${world.city.name}` })).toBeTruthy();
    expect(container.querySelector(`svg.wallpaper[data-city="${world.city.id}"]`)).toBeTruthy();
    expect(screen.getByRole("region", { name: "fortune" })).toBeTruthy();
    const dock = screen.getByRole("navigation", { name: "Dock" });
    expect(dock.querySelectorAll("button")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Chat, 5 unread" })).toBeTruthy();
  });

  it("the dock opens, focuses and minimizes apps", async () => {
    const { os } = renderOs(<Desktop />);
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(await screen.findByRole("region", { name: "Files" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(os().wm.windows[0]!.minimized).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Files" }));
    expect(os().wm.windows[0]!.minimized).toBe(false);
  });

  it("O opens the overview, Esc closes it, and it explains an empty desktop", () => {
    renderOs(<Desktop />);
    fireEvent.keyDown(window, { key: "o" });
    const overview = screen.getByRole("dialog", { name: "Overview" });
    expect(overview.textContent).toContain("No windows open. Pick an app from the dock.");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Overview" })).toBeNull();
  });

  it("window shortcuts act on the focused window but not while typing", async () => {
    const { os } = renderOs(<Desktop />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByRole("region", { name: "Settings" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Sticky note" }), { key: "x" });
    expect(os().wm.windows).toHaveLength(1);
    fireEvent.keyDown(window, { key: "[" });
    expect(os().wm.windows[0]!.mode).toBe("left");
    fireEvent.keyDown(window, { key: "m" });
    expect(os().wm.windows[0]!.mode).toBe("maximized");
    fireEvent.keyDown(window, { key: "x" });
    expect(os().wm.windows).toHaveLength(0);
  });

  it("Start shift opens the Browser, and the page is a critical notification acknowledged with A", async () => {
    const { incident, os } = renderOs(<Desktop />);
    fireEvent.click(screen.getByRole("button", { name: "Start shift" }));
    expect(await screen.findByRole("region", { name: "Browser" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(screen.getByRole("alertdialog", { name: "Checkout returning 5xx" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "a" });
    expect(incident().phase).toBe("active");
    expect(os().wm.windows.find((w) => w.appId === "monitoring")?.mode).toBe("maximized");
  });

  it("P pauses a running incident behind an opaque overlay", () => {
    const { incident } = renderOs(<Desktop />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    fireEvent.keyDown(window, { key: "p" });
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
    expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
  });

  it("the System menu locks the screen, and Unlock returns", () => {
    renderOs(<Desktop />);
    fireEvent.click(screen.getByRole("button", { name: "System" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock" }));
    expect(screen.getByRole("main", { name: "Lock screen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.getByRole("main", { name: "Desktop" })).toBeTruthy();
  });
});
