import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAnalytics, track } from "./analytics";

const scripts = () => Array.from(document.head.querySelectorAll<HTMLScriptElement>("script[data-website-id]"));
const dnt = (value: string | null) => Object.defineProperty(navigator, "doNotTrack", { value, configurable: true });

beforeEach(() => {
  document.head.innerHTML = "";
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  dnt(null);
  delete (window as { umami?: unknown }).umami;
});

describe("initAnalytics", () => {
  it("adds nothing without a website id", () => {
    vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "");
    dnt(null);
    initAnalytics();
    expect(scripts()).toHaveLength(0);
  });

  it("adds nothing when the browser sends Do Not Track", () => {
    vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "site-1");
    dnt("1");
    initAnalytics();
    expect(scripts()).toHaveLength(0);
  });

  it("loads the same-origin script once, with auto-track on", () => {
    vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "site-1");
    dnt("0");
    initAnalytics();
    initAnalytics();
    const [s, ...rest] = scripts();
    expect(rest).toHaveLength(0);
    expect(s?.getAttribute("src")).toBe("/stats/script.js");
    expect(s?.defer).toBe(true);
    expect(s?.dataset.websiteId).toBe("site-1");
    expect(s?.dataset.autoTrack).toBe("true");
  });
});

describe("track", () => {
  it("is a no-op when umami is missing", () => {
    expect(() => track("ack")).not.toThrow();
  });

  it("never throws when umami does", () => {
    (window as { umami?: unknown }).umami = {
      track: () => {
        throw new Error("blocked");
      },
    };
    expect(() => track("share_click")).not.toThrow();
  });

  it("sends the event name and only the allowed props", () => {
    const spy = vi.fn();
    (window as { umami?: unknown }).umami = { track: spy };
    track("shift_finish", { result: "resolved", incident: "db-pool-exhaustion", mode: "daily", leak: "x" } as never);
    track("ack");
    expect(spy).toHaveBeenNthCalledWith(1, "shift_finish", { result: "resolved", incident: "db-pool-exhaustion", mode: "daily" });
    expect(spy).toHaveBeenNthCalledWith(2, "ack", undefined);
  });
});
