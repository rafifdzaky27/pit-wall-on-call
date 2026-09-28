import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../os/testing";

afterEach(() => {
  cleanup();
  vi.doUnmock("./CafeView");
  vi.resetModules();
});

describe("loading the café", () => {
  it("draws the café once its chunk loads", async () => {
    const { Stage } = await import("./Stage");
    const { incident } = renderOs(
      <Stage>
        <p>laptop screen</p>
      </Stage>,
    );
    act(() => incident().start());
    expect(await screen.findByRole("img", { name: /^A café in / })).toBeTruthy();
  });

  it("keeps the game playable on a plain backdrop when the café cannot load (Review Focus 5)", async () => {
    vi.doMock("./CafeView", () => {
      throw new Error("chunk failed to load");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { Stage } = await import("./Stage");
    const { renderOs: render } = await import("../os/testing");
    const { incident } = render(
      <Stage>
        <p>laptop screen</p>
      </Stage>,
    );
    act(() => incident().start());
    expect(await screen.findByRole("region", { name: "Café" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(incident().phase).toBe("paging");
    fireEvent.click(await screen.findByRole("button", { name: /Acknowledge/ }));
    expect(incident().phase).toBe("active");
  });
});
