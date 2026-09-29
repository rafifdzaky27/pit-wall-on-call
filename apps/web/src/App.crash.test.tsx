import { slowLeak } from "@pitwall/scenarios";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let crash = true;
vi.mock("./os/shell/Desktop", () => ({
  Desktop: () => {
    if (crash) throw new Error("engine exploded");
    return <p>desktop back</p>;
  },
}));

const { App } = await import("./App");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App crash handling", () => {
  it("replaces a crashed desktop with an explanation, and New shift recovers", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App practice={slowLeak} newSeed={() => 1} />);
    expect(screen.getByRole("alertdialog", { name: "The simulation hit an error" })).toBeTruthy();
    crash = false;
    fireEvent.click(screen.getByRole("button", { name: "Back to start" }));
    expect(screen.getByText("desktop back")).toBeTruthy();
  });
});
