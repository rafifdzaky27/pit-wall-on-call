import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
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
    // The first import of the café chunk is transformed on demand; under a full parallel `pnpm test`
    // (API tests on Postgres included) that can take longer than findBy's default 1 s.
    expect(await screen.findByRole("img", { name: /^A café in / }, { timeout: 5000 })).toBeTruthy();
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
    await waitFor(() => expect(document.querySelector(".cafe-fallback")).not.toBeNull());
    expect(screen.queryByRole("img", { name: /^A café in / })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the page" }));
    expect(incident().phase).toBe("paging");
    fireEvent.click(await screen.findByRole("button", { name: /Acknowledge/ }));
    expect(incident().phase).toBe("active");
  });
});
