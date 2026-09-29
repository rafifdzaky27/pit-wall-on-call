import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppBoundary, isChunkError, reloader, reloadOnce } from "./chunks";
import { ErrorBoundary } from "./screens/ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

const chunkError = () => new TypeError("Failed to fetch dynamically imported module: https://pitwall.example/assets/SettingsApp-abc.js");

function Throws({ error }: { error: Error }): never {
  throw error;
}

describe("chunk failures after a deploy (M2.5 spec §10)", () => {
  it("recognises the browsers' chunk-load errors, and nothing else", () => {
    expect(isChunkError(chunkError())).toBe(true);
    expect(isChunkError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkError(Object.assign(new Error("x"), { name: "ChunkLoadError" }))).toBe(true);
    expect(isChunkError(new Error("state.pool is NaN"))).toBe(false);
  });

  it("reloads once, and not again within 10 s", () => {
    const reload = vi.spyOn(reloader, "reload").mockImplementation(() => {});
    expect(reloadOnce(1_000)).toBe(true);
    expect(reloadOnce(5_000)).toBe(false);
    expect(reloadOnce(12_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("the crash guard reloads on a chunk error instead of showing the crash screen", () => {
    const reload = vi.spyOn(reloader, "reload").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary onReset={() => {}}>
        <Throws error={chunkError()} />
      </ErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe("Loading the new version of Pit Wall On-Call…");
    expect(screen.queryByText("The simulation hit an error")).toBeNull();
  });

  it("the crash screen shows the error message for bug reports", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary onReset={() => {}}>
        <Throws error={new Error("state.pool is NaN")} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("The simulation hit an error")).toBeTruthy();
    expect(screen.getByText("state.pool is NaN")).toBeTruthy();
  });

  it("an app whose chunk still fails after the reload says so inside its window", () => {
    vi.spyOn(reloader, "reload").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    reloadOnce(Date.now());
    render(
      <ErrorBoundary onReset={() => {}}>
        <AppBoundary>
          <Throws error={chunkError()} />
        </AppBoundary>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Couldn't load this app.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(screen.queryByText("The simulation hit an error")).toBeNull();
  });

  it("an app's own bug still reaches the crash guard", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary onReset={() => {}}>
        <AppBoundary>
          <Throws error={new Error("boom")} />
        </AppBoundary>
      </ErrorBoundary>,
    );
    expect(screen.getByText("The simulation hit an error")).toBeTruthy();
  });

  it("mid-shift, a missing chunk never reloads by itself: the window says so, and the player decides (review I4)", () => {
    const reload = vi.spyOn(reloader, "reload").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary onReset={() => {}}>
        <AppBoundary autoReload={false}>
          <Throws error={chunkError()} />
        </AppBoundary>
      </ErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't load this app. Reloading ends this shift.")).toBeTruthy();
  });
});
