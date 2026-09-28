import { slowLeak } from "@pitwall/scenarios";
import { resolveWorld } from "@pitwall/world";
import { describe, expect, it } from "vitest";
import { complete, parseCommand } from "./commands";

const world = resolveWorld(1);
const ctx = { scenario: slowLeak, world };
const first = (person: "deployer" | "infra" | "support" | "secondary") => world.colleagues[person].split(" ")[0]!.toLowerCase();

describe("slash commands (M2.5 plan Task 3)", () => {
  it("asks a teammate by first name and topic", () => {
    expect(parseCommand(`/ask @${first("deployer")} changes`, ctx)).toEqual({ kind: "ask", actionId: "ask.deployer.changes" });
    expect(parseCommand(`/ask @${first("support")} impact`, ctx)).toEqual({ kind: "ask", actionId: "ask.support.impact" });
  });

  it("posts a status update with the player's own words", () => {
    expect(parseCommand("/status Investigating checkout errors", ctx)).toEqual({ kind: "status", text: "Investigating checkout errors" });
    expect(parseCommand("/status", ctx)).toEqual({ kind: "error", message: "Write the update after /status, for example: /status Investigating checkout errors" });
  });

  it("pages the secondary, and lists the commands", () => {
    expect(parseCommand(`/page @${first("secondary")}`, ctx)).toEqual({ kind: "page" });
    expect(parseCommand("/page @secondary", ctx)).toEqual({ kind: "page" });
    expect(parseCommand("/help", ctx).kind).toBe("help");
  });

  it("explains a wrong name, topic or command instead of posting", () => {
    expect(parseCommand("/ask @nobody changes", ctx)).toEqual({ kind: "error", message: "No teammate called nobody. Try /help." });
    expect(parseCommand(`/ask @${first("deployer")} lunch`, ctx)).toEqual({ kind: "error", message: `Ask ${world.colleagues.deployer} about: changes.` });
    expect(parseCommand("/deploy now", ctx)).toEqual({ kind: "error", message: "Unknown command /deploy. Try /help." });
  });

  it("treats anything without a slash as plain text", () => {
    expect(parseCommand("hello?", ctx)).toEqual({ kind: "text" });
  });

  it("completes commands, names and topics with Tab", () => {
    expect(complete("/a", ctx)).toBe("/ask @");
    expect(complete(`/ask @${first("deployer").slice(0, 2)}`, ctx)).toBe(`/ask @${first("deployer")} `);
    expect(complete(`/ask @${first("deployer")} ch`, ctx)).toBe(`/ask @${first("deployer")} changes`);
    expect(complete("/zz", ctx)).toBeNull();
  });
});
