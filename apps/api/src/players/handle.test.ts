import { describe, expect, it } from "vitest";
import { checkHandle } from "./handle";

describe("checkHandle", () => {
  it("trims, then accepts 3 to 20 letters, digits, - and _", () => {
    expect(checkHandle(" rafif_27 ")).toEqual({ ok: true, handle: "rafif_27" });
    expect(checkHandle("abc")).toEqual({ ok: true, handle: "abc" });
    expect(checkHandle("a".repeat(20))).toEqual({ ok: true, handle: "a".repeat(20) });
  });

  it.each(["ab", "a".repeat(21), "a b", "é_abc", "", "rafif!", "semi;colon"])("rejects %j as a schema error", (raw) => {
    expect(checkHandle(raw)).toEqual({ ok: false, code: "schema" });
  });

  it("rejects a long listed word anywhere, after undoing digit swaps and separators", () => {
    expect(checkHandle("xxFUCKxx")).toEqual({ ok: false, code: "handle_rejected" });
    expect(checkHandle("sh1thead")).toEqual({ ok: false, code: "handle_rejected" });
    expect(checkHandle("an-jing_99")).toEqual({ ok: false, code: "handle_rejected" });
  });

  it("rejects a short listed word only as the whole handle", () => {
    expect(checkHandle("ass")).toEqual({ ok: false, code: "handle_rejected" });
    expect(checkHandle("classic")).toEqual({ ok: true, handle: "classic" });
    expect(checkHandle("passenger")).toEqual({ ok: true, handle: "passenger" });
  });
});
