import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Boom(): never {
  throw new Error("engine exploded");
}

describe("ErrorBoundary", () => {
  it("replaces a crashed run with an explanation and a way back", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alertdialog", { name: "The simulation hit an error" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to start" }));
    expect(onReset).toHaveBeenCalled();
  });
});
