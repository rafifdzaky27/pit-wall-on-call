import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPrefs } from "../../prefs";
import { audio } from "../../audio/engine";
import { renderOs } from "../../testing";
import { SettingsApp } from "./SettingsApp";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const ok = async () => "abc1234";
const nav = () => screen.getByRole("navigation", { name: "Settings pages" });
const open = (page: string) => fireEvent.click(within(nav()).getByRole("button", { name: page }));

describe("SettingsApp", () => {
  it("changes the style and accessibility preferences", () => {
    renderOs(<SettingsApp fetchVersion={ok} />);
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    open("Accessibility");
    fireEvent.click(screen.getByRole("switch", { name: /Single-key shortcuts/ }));
    fireEvent.click(screen.getByRole("switch", { name: /Use system cursor/ }));
    expect(loadPrefs()).toMatchObject({ theme: "light", singleKeyShortcuts: false, systemCursor: true });
  });

  it("Sound sets the volume and mute, and plays each alert sound on demand", () => {
    const play = vi.spyOn(audio, "play").mockImplementation(() => {});
    vi.spyOn(audio, "unlock").mockImplementation(() => {});
    renderOs(<SettingsApp fetchVersion={ok} />);
    open("Sound");
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "30" } });
    expect(loadPrefs().volume).toBe(30);
    fireEvent.click(screen.getByRole("button", { name: "Play Pager" }));
    expect(play).toHaveBeenCalledWith("pager");
    for (const [name, key] of [["Ambience volume", "ambience"], ["Music volume", "music"], ["Alerts volume", "alerts"]] as const) {
      fireEvent.change(screen.getByRole("slider", { name }), { target: { value: "20" } });
      expect(loadPrefs()[key]).toBe(20);
    }
    fireEvent.click(screen.getByRole("switch", { name: "Reduce audio intensity" }));
    expect(loadPrefs().reduceAudio).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Play Phone vibration" }));
    expect(play).toHaveBeenCalledWith("vibrate");
    fireEvent.click(screen.getByRole("switch", { name: "Mute" }));
    expect(loadPrefs().muted).toBe(true);
    expect((screen.getByRole("button", { name: "Play Pager" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Display turns full screen on Start shift off, and offers Full screen now only where supported", () => {
    renderOs(<SettingsApp fetchVersion={ok} />);
    open("Display");
    fireEvent.click(screen.getByRole("switch", { name: "Full screen on Start shift" }));
    expect(loadPrefs().fullscreenOnStart).toBe(false);
    expect(screen.queryByRole("switch", { name: "Full screen now" })).toBeNull();
  });

  it("Keyboard lists the shortcuts", () => {
    renderOs(<SettingsApp fetchVersion={ok} />);
    open("Keyboard");
    expect(screen.getByRole("table", { name: "Keyboard shortcuts" }).textContent).toContain("Acknowledge");
  });

  it("About shows the build, the API version and the photo credits", async () => {
    renderOs(<SettingsApp fetchVersion={ok} />);
    open("About");
    expect(await screen.findByText("API online · abc1234")).toBeTruthy();
    const credits = screen.getByRole("region", { name: "Photo credits" });
    expect(credits.textContent).toContain("Europeana");
    expect(within(credits).getAllByRole("link")[0]!.getAttribute("href")).toMatch(/^https:\/\/unsplash\.com\/photos\//);
  });

  it("About reports an unreachable API plainly", async () => {
    renderOs(
      <SettingsApp
        fetchVersion={async () => {
          throw new Error("down");
        }}
      />,
    );
    open("About");
    expect(await screen.findByText("API unreachable")).toBeTruthy();
  });

  it("search filters the pages", () => {
    renderOs(<SettingsApp fetchVersion={ok} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search settings" }), { target: { value: "volume" } });
    expect(within(nav()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Sound"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search settings" }), { target: { value: "zzz" } });
    expect(within(nav()).getByText("No results")).toBeTruthy();
  });

  it("opens on the page another part of PitOS asked for", () => {
    const { os } = renderOs(<SettingsApp fetchVersion={ok} />);
    act(() => os().openSettings("about"));
    expect(screen.getByRole("heading", { level: 2, name: "About" })).toBeTruthy();
  });
});
