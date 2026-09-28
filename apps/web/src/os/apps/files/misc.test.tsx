import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPrefs } from "../../prefs";
import { StickyNote, WorldClock } from "../../shell/Widgets";
import { renderOs } from "../../testing";
import { SettingsApp } from "../settings/SettingsApp";
import { FilesApp } from "./FilesApp";
import { TrashApp } from "./TrashApp";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("FilesApp", () => {
  it("opens on README.md with how to play, and holds no personal facts", () => {
    renderOs(<FilesApp />);
    expect(screen.getByRole("article", { name: "README.md" }).textContent).toContain("How to play");
    expect(screen.queryByRole("button", { name: /about-rafif/ })).toBeNull();
  });
});

describe("TrashApp", () => {
  it("shows its files and refuses to be emptied, with a reason", () => {
    renderOs(<TrashApp />);
    expect(screen.getByRole("button", { name: /final_final_v3\.yaml/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /rackets/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /prod-backup\.sql/ }));
    expect(screen.getByText(/0 bytes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Empty Trash" }));
    expect(screen.getByRole("status").textContent).toMatch(/refused/i);
  });
});

describe("SettingsApp", () => {
  it("changes the theme and accessibility preferences", () => {
    renderOs(<SettingsApp fetchVersion={async () => "abc1234"} />);
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: "Accessibility" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Single-key shortcuts/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Use system cursor/ }));
    expect(loadPrefs()).toMatchObject({ theme: "light", singleKeyShortcuts: false, systemCursor: true });
  });

  it("About shows the build, the API version and the shortcuts", async () => {
    renderOs(<SettingsApp fetchVersion={async () => "abc1234"} />);
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    expect(await screen.findByText("API online · abc1234")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Keyboard shortcuts" })).toBeTruthy();
  });

  it("About reports an unreachable API plainly", async () => {
    renderOs(
      <SettingsApp
        fetchVersion={async () => {
          throw new Error("down");
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    expect(await screen.findByText("API unreachable")).toBeTruthy();
  });
});

describe("widgets", () => {
  it("the world clock lists the four cities", () => {
    renderOs(<WorldClock />);
    for (const city of ["Jakarta", "Yogyakarta", "Tokyo", "Melbourne"]) expect(screen.getByText(city)).toBeTruthy();
  });

  it("the sticky note saves what you type", () => {
    renderOs(<StickyNote />);
    fireEvent.change(screen.getByRole("textbox", { name: "Sticky note" }), { target: { value: "check deploys first" } });
    expect(loadPrefs().sticky).toBe("check deploys first");
  });
});
