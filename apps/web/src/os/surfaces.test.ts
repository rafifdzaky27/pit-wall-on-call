import { slowLeak } from "@pitwall/scenarios";
import { CAFE } from "@pitwall/world";
import { describe, expect, it } from "vitest";
import { M15_SURFACES, M16_SURFACES, reachableClueCount, reachableHotspots, surfaceOf } from "./surfaces";

describe("surfaces", () => {
  it("maps hotspot ids to the desktop surface that shows them", () => {
    expect(surfaceOf("laptop.slack.deploys")).toBe("chat");
    expect(surfaceOf("phone.mention")).toBe("phone");
    expect(surfaceOf("table.neighbours")).toBe("cafe");
    expect(surfaceOf("wall.poster")).toBe("cafe");
    expect(surfaceOf("fridge.magnet")).toBeNull();
  });

  it("counts only the clues this build can reach", () => {
    expect(reachableHotspots(slowLeak, M15_SURFACES)).toEqual(["laptop.slack.deploys", "laptop.slack.infra", "phone.mention"]);
    expect(reachableClueCount(slowLeak, M15_SURFACES)).toBe(2);
    expect(reachableClueCount(slowLeak, ["chat", "phone", "cafe"])).toBe(3);
  });
});

describe("M1.6 café surfaces", () => {
  it("every scenario hotspot exists in the café, and all three clues are reachable", () => {
    for (const id of Object.keys(slowLeak.coldOpen.hotspots)) expect(CAFE.hotspots, id).toContain(id);
    expect(reachableClueCount(slowLeak, M16_SURFACES)).toBe(3);
  });
});
