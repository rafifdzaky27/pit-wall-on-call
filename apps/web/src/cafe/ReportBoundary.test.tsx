import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportBoundary } from "./ReportBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Throws(): never {
  throw new TypeError("Failed to fetch dynamically imported module: /assets/ResultsCard-old.js");
}

describe("the shift report's own boundary (M2.5 review I4)", () => {
  it("if the report cannot load, the café still leads to the postmortem, and nothing reloads", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onRead = vi.fn();
    render(
      <ReportBoundary onRead={onRead}>
        <Throws />
      </ReportBoundary>,
    );
    expect(screen.getByText("The shift report didn't load.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Read the postmortem" }));
    expect(onRead).toHaveBeenCalled();
  });
});
