import { cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isTypingTarget, useShortcuts } from "./useShortcuts";

afterEach(cleanup);

describe("useShortcuts", () => {
  it("runs the bound action for a single key, case-insensitively", () => {
    const o = vi.fn();
    renderHook(() => useShortcuts({ o }));
    fireEvent.keyDown(window, { key: "o" });
    fireEvent.keyDown(window, { key: "O" });
    expect(o).toHaveBeenCalledTimes(2);
  });

  it("supports named keys like Escape and symbols like [", () => {
    const esc = vi.fn();
    const left = vi.fn();
    renderHook(() => useShortcuts({ Escape: esc, "[": left }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "[" });
    expect(esc).toHaveBeenCalled();
    expect(left).toHaveBeenCalled();
  });

  it("ignores keys typed into text fields", () => {
    const x = vi.fn();
    renderHook(() => useShortcuts({ x }));
    const { container } = render(
      <div>
        <textarea />
        <input />
      </div>,
    );
    fireEvent.keyDown(container.querySelector("textarea")!, { key: "x" });
    fireEvent.keyDown(container.querySelector("input")!, { key: "x" });
    expect(x).not.toHaveBeenCalled();
  });

  it("ignores modified and repeated keys", () => {
    const a = vi.fn();
    renderHook(() => useShortcuts({ a }));
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    fireEvent.keyDown(window, { key: "a", metaKey: true });
    fireEvent.keyDown(window, { key: "a", altKey: true });
    fireEvent.keyDown(window, { key: "a", repeat: true });
    expect(a).not.toHaveBeenCalled();
  });

  it("does nothing while disabled", () => {
    const p = vi.fn();
    renderHook(() => useShortcuts({ p }, false));
    fireEvent.keyDown(window, { key: "p" });
    expect(p).not.toHaveBeenCalled();
  });

  it("recognises typing targets", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
