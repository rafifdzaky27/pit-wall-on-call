import { afterEach, describe, expect, it, vi } from "vitest";
import { enterFullscreen, exitFullscreen, fullscreenSupported } from "./fullscreen";

const root = document.documentElement;

afterEach(() => {
  delete (root as { requestFullscreen?: unknown }).requestFullscreen;
  delete (document as { fullscreenElement?: unknown }).fullscreenElement;
  delete (document as { exitFullscreen?: unknown }).exitFullscreen;
});

describe("fullscreen", () => {
  it("is a quiet no-op where the API is missing", async () => {
    expect(fullscreenSupported()).toBe(false);
    await expect(enterFullscreen()).resolves.toBe(false);
  });

  it("asks for full screen with the browser UI hidden", async () => {
    const request = vi.fn(async () => undefined);
    Object.assign(root, { requestFullscreen: request });
    await expect(enterFullscreen()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({ navigationUI: "hide" });
  });

  it("carries on without an error when the request is refused (iframe, permission, iOS)", async () => {
    Object.assign(root, { requestFullscreen: vi.fn(async () => Promise.reject(new TypeError("Permissions check failed"))) });
    await expect(enterFullscreen()).resolves.toBe(false);
  });

  it("does not ask again while already full screen, and can leave", async () => {
    const request = vi.fn(async () => undefined);
    const exit = vi.fn(async () => undefined);
    Object.assign(root, { requestFullscreen: request });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: root });
    Object.assign(document, { exitFullscreen: exit });
    await expect(enterFullscreen()).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
    await exitFullscreen();
    expect(exit).toHaveBeenCalled();
  });
});
