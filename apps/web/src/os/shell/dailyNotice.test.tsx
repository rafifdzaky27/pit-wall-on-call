import { dailyFor, utcDate } from "@pitwall/scenarios";
import { resolveWorld } from "@pitwall/world";
import { act, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderOs } from "../testing";
import { PITCH } from "../brand/pitch";
import { useNoticeFeed } from "./noticeFeed";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Feed() {
  useNoticeFeed(() => {});
  return null;
}
const shiftNotice = (os: ReturnType<typeof renderOs>["os"]) => os().notices.find((n) => n.id === "shift")!;

describe("the one-line pitch on the first screen (M5 launch check)", () => {
  it.each([
    ["a first visit", {}],
    ["a returning player", { trainingDone: true }],
  ])("opens the shift notice for %s", (_name, prefs) => {
    const { os } = renderOs(<Feed />, { prefs });
    expect(shiftNotice(os).body.startsWith(PITCH)).toBe(true);
  });

  it("is the page's meta and Open Graph description, word for word", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toContain(`<meta name="description" content="${PITCH}" />`);
    expect(html).toContain(`<meta property="og:description" content="${PITCH}" />`);
  });
});

describe("the daily on the landing (M3 spec Y8)", () => {
  it("leads with today's daily, in the daily's own city", () => {
    const today = dailyFor(utcDate(Date.now()));
    const { os } = renderOs(<Feed />, { prefs: { trainingDone: true } });
    const n = shiftNotice(os);
    expect(n.title).toBe(`Daily #${today.number} · ${resolveWorld(today.seed).city.name}`);
    expect(n.actions.map((a) => a.label)).toEqual(["Start daily", "Practice shift", "Training shift (about 3 min)"]);
  });

  it("puts training first on a first visit", () => {
    const { os } = renderOs(<Feed />);
    expect(shiftNotice(os).actions.map((a) => a.label)).toEqual(["Training shift (about 3 min)", "Start daily", "Practice shift"]);
  });

  it("Start daily starts today's daily", () => {
    const today = dailyFor(utcDate(Date.now()));
    const { os, incident } = renderOs(<Feed />, { prefs: { trainingDone: true } });
    act(() => shiftNotice(os).actions[0]!.run());
    expect(incident().daily).toEqual(today);
    expect(incident().phase).toBe("prepage");
  });

  it("once today's ranked daily is in, says how it went, and offers it again as practice", () => {
    const today = dailyFor(utcDate(Date.now()));
    localStorage.setItem(`pitwall.daily.${today.date}`, JSON.stringify({ rank: 12, total: 340 }));
    const { os } = renderOs(<Feed />, { prefs: { trainingDone: true } });
    const n = shiftNotice(os);
    expect(n.title).toBe(`Daily #${today.number} done · #12 of 340`);
    expect(n.actions.map((a) => a.label)).toEqual(["Practice shift", "Daily again (practice)", "Training shift (about 3 min)"]);
  });

  it("has exactly one primary action, even before the training is done (M3 walkthrough W1)", () => {
    const today = dailyFor(utcDate(Date.now()));
    localStorage.setItem(`pitwall.daily.${today.date}`, JSON.stringify({ rank: 1, total: 1 }));
    const { os } = renderOs(<Feed />);
    expect(shiftNotice(os).actions.filter((a) => a.primary).map((a) => a.label)).toEqual(["Practice shift"]);
  });
});
