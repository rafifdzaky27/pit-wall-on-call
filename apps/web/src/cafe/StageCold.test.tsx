import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.resetModules();
});

describe("Stage with the café not loaded yet", () => {
  it("holds the camera at the laptop until the café has loaded, so the zoom-out never shows an empty café (M2.5 follow-up)", async () => {
    vi.resetModules();
    const { Stage } = await import("./Stage");
    const { renderOs } = await import("../os/testing");
    const { laptopFit } = await import("./camera");
    const { incident } = renderOs(
      <Stage>
        <p>laptop screen</p>
      </Stage>,
    );
    const world = document.querySelector<HTMLElement>(".stage-world")!;
    act(() => incident().start());
    // Still at the laptop: the whole world zoomed in, the desktop filling the view.
    expect(world.style.transform).toBe(`scale(${1 / laptopFit(window.innerWidth, window.innerHeight).k})`);
    // Once the café is in, the camera pulls back. The chunk's import is slow under a busy parallel run.
    await waitFor(() => expect(world.style.transform).toBe(""), { timeout: 5000 });
    expect(document.querySelector(".stage-cafe .cafe")).not.toBeNull();
  });

  it("holds the camera at the laptop while the window goes full screen, then pulls back once it has its size (M2.5 follow-up)", async () => {
    const { Stage, loadCafe } = await import("./Stage");
    const { renderOs } = await import("../os/testing");
    const { laptopFit } = await import("./camera");
    const { enterFullscreen } = await import("../os/fullscreen");
    await loadCafe();
    const root = document.documentElement as HTMLElement & { requestFullscreen: () => Promise<void> };
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    root.requestFullscreen = () => new Promise(() => undefined);
    try {
      const { incident } = renderOs(
        <Stage>
          <p>laptop screen</p>
        </Stage>,
      );
      const world = document.querySelector<HTMLElement>(".stage-world")!;
      void enterFullscreen();
      act(() => incident().start());
      expect(world.style.transform).toBe(`scale(${1 / laptopFit(window.innerWidth, window.innerHeight).k})`);
      // Nothing of the café shows or takes clicks over the desktop while the camera holds.
      expect(document.querySelector(".stage-cafe")!.classList.contains("off")).toBe(true);
      expect(document.querySelector(".stage-cafe")!.hasAttribute("inert")).toBe(true);
      act(() => {
        Object.assign(window, { innerWidth: 1440, innerHeight: 900 });
        window.dispatchEvent(new Event("resize"));
      });
      // The hold follows the new size at once, so the desktop never shows framed for the old one (PR 29 review I1).
      expect(world.style.transform).toBe(`scale(${1 / laptopFit(1440, 900).k})`);
      await waitFor(() => expect(world.style.transform).toBe(""));
    } finally {
      delete (root as { requestFullscreen?: unknown }).requestFullscreen;
      Object.assign(window, { innerWidth: 1024, innerHeight: 768 });
    }
  });

  it("when the café cannot load, still pulls back, onto the plain café (cold-open spec §9)", async () => {
    vi.doMock("./CafeView", () => {
      throw new Error("chunk failed");
    });
    try {
      const { Stage } = await import("./Stage");
      const { renderOs } = await import("../os/testing");
      const { incident } = renderOs(
        <Stage>
          <p>laptop screen</p>
        </Stage>,
      );
      const world = document.querySelector<HTMLElement>(".stage-world")!;
      act(() => incident().start());
      await waitFor(() => expect(world.style.transform).toBe(""));
      expect(document.querySelector(".cafe-fallback")).not.toBeNull();
    } finally {
      vi.doUnmock("./CafeView");
    }
  });

  it("never holds longer than PULL_BACK_WAIT_MS, even when the café's chunk hangs (PR 29 review I2)", async () => {
    vi.doMock("./CafeView", () => new Promise(() => undefined));
    try {
      const { Stage, PULL_BACK_WAIT_MS } = await import("./Stage");
      const { renderOs } = await import("../os/testing");
      const { incident } = renderOs(
        <Stage>
          <p>laptop screen</p>
        </Stage>,
      );
      const world = document.querySelector<HTMLElement>(".stage-world")!;
      act(() => incident().start());
      expect(world.style.transform).not.toBe("");
      await waitFor(() => expect(world.style.transform).toBe(""), { timeout: PULL_BACK_WAIT_MS + 1000 });
    } finally {
      vi.doUnmock("./CafeView");
    }
  });
});
