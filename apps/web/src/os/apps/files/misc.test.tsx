import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPrefs } from "../../prefs";
import { StickyNote, WorldClock } from "../../shell/Widgets";
import { renderOs } from "../../testing";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
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
