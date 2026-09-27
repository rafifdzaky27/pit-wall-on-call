import { slowLeak } from "@pitwall/scenarios";
import { describe, expect, it } from "vitest";
import { M15_SURFACES, reachableClueCount, reachableHotspots, surfaceOf } from "./surfaces";

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
