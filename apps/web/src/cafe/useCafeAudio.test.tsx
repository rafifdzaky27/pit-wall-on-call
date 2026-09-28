import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Ambience } from "../os/audio/ambience";
import { audio } from "../os/audio/engine";
import type { View } from "./camera";
import { useCafeAudio } from "./useCafeAudio";

afterEach(() => vi.restoreAllMocks());

describe("useCafeAudio", () => {
  it("starts the café with the shift, muffles it on the laptop, and stops it when the café goes", () => {
    const start = vi.spyOn(Ambience.prototype, "start").mockResolvedValue();
    const stop = vi.spyOn(Ambience.prototype, "stop").mockImplementation(() => {});
    const muffle = vi.spyOn(audio, "setMuffled").mockImplementation(() => {});
    const { rerender, unmount } = renderHook((p: { view: View; rain: boolean }) => useCafeAudio(p.view, p.rain), { initialProps: { view: "cafe", rain: true } });
    expect(start).toHaveBeenCalledWith({ rain: true });
    expect(muffle).toHaveBeenLastCalledWith(false);
    rerender({ view: "desktop", rain: true });
    expect(muffle).toHaveBeenLastCalledWith(true);
    unmount();
    expect(stop).toHaveBeenCalled();
    expect(muffle).toHaveBeenLastCalledWith(false);
  });
});
