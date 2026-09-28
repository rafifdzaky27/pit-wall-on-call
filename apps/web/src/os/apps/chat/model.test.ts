import { describe, expect, it } from "vitest";
import { avatarIndex, dayLabel, groupHeads, initials, relative } from "./model";

const MIN = 60_000;
const t0 = new Date(2026, 8, 28, 10, 0).getTime();

describe("chat model", () => {
  it("collapses a message under the previous one from the same author within 5 minutes", () => {
    const heads = groupHeads([
      { id: "a", author: "infra", at: t0 },
      { id: "b", author: "infra", at: t0 + 4 * MIN },
      { id: "c", author: "infra", at: t0 + 10 * MIN },
      { id: "d", author: "support", at: t0 + 11 * MIN },
      { id: "e", author: "support", at: t0 + 11 * MIN + 1 },
    ]);
    expect([...heads]).toEqual(["a", "c", "d"]);
  });

  it("starts a new group on a new day", () => {
    const late = new Date(2026, 8, 27, 23, 58).getTime();
    expect([...groupHeads([{ id: "a", author: "x", at: late }, { id: "b", author: "x", at: late + 3 * MIN }])]).toEqual(["a", "b"]);
  });

  it("labels days like Slack", () => {
    expect(dayLabel(t0, t0)).toBe("Today");
    expect(dayLabel(t0 - 24 * 60 * MIN, t0)).toBe("Yesterday");
    expect(dayLabel(t0 - 3 * 24 * 60 * MIN, t0)).toBe("Friday 25 September");
  });

  it("makes initials and a stable avatar colour", () => {
    expect(initials("Laras")).toBe("L");
    expect(initials("Deploy Bot")).toBe("DB");
    expect(avatarIndex("Laras")).toBe(avatarIndex("Laras"));
    for (const n of ["Dimas", "Sekar", "Rizky", "Putri", "Kenji"]) expect(avatarIndex(n)).toBeGreaterThanOrEqual(1);
    for (const n of ["Dimas", "Sekar", "Rizky", "Putri", "Kenji"]) expect(avatarIndex(n)).toBeLessThanOrEqual(8);
  });

  it("says how long ago a reply was", () => {
    expect(relative(t0 - 30_000, t0)).toBe("just now");
    expect(relative(t0 - 2 * MIN, t0)).toBe("2 min ago");
    expect(relative(t0 - 90 * MIN, t0)).toBe("1 h ago");
    expect(relative(t0 - 26 * 60 * MIN, t0)).toBe("1 d ago");
  });
});
