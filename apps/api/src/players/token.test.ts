import { describe, expect, it } from "vitest";
import { hashToken, newToken, tagOf } from "./token";

describe("tokens", () => {
  it("are pw_ plus 32 random bytes in base64url", () => {
    const a = newToken();
    expect(a).toMatch(/^pw_[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(a);
  });

  it("hash to a deterministic SHA-256 hex digest", () => {
    expect(hashToken("pw_x")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("pw_x")).toBe(hashToken("pw_x"));
    expect(hashToken("pw_x")).not.toBe(hashToken("pw_y"));
  });
});

describe("tagOf", () => {
  it("is the last 4 characters of the player ID", () => {
    expect(tagOf("0c1f2e3d-0000-4000-8000-0000abcd1234")).toBe("1234");
  });
});
