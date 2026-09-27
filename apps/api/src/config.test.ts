import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

const validUrl = "postgres://pitwall:0123abcd@postgres:5432/pitwall";

describe("parseConfig", () => {
  it("parses a valid environment with defaults", () => {
    expect(parseConfig({ DATABASE_URL: validUrl })).toEqual({
      databaseUrl: validUrl,
      port: 8787,
      version: "dev",
    });
  });

  it("uses PORT and GIT_SHA when provided", () => {
    const config = parseConfig({ DATABASE_URL: validUrl, PORT: "9000", GIT_SHA: "abc123" });
    expect(config.port).toBe(9000);
    expect(config.version).toBe("abc123");
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseConfig({})).toThrow("DATABASE_URL is required");
  });

  it("rejects a password with unencoded special characters", () => {
    expect(() =>
      parseConfig({ DATABASE_URL: "postgres://pitwall:ab#cd@postgres:5432/pitwall" }),
    ).toThrow(/not a valid URL/);
  });

  it("rejects a non-postgres scheme", () => {
    expect(() => parseConfig({ DATABASE_URL: "mysql://u:p@db:3306/x" })).toThrow(
      /postgres:\/\//,
    );
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => parseConfig({ DATABASE_URL: validUrl, PORT: "eighty" })).toThrow(/PORT/);
  });
});
