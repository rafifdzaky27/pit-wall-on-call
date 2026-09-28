import { resolveWorld } from "@pitwall/world";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../../testing";
import { ChatApp } from "./ChatApp";
import { unreadCount } from "./unread";

const world = resolveWorld(1);

beforeEach(() => {
  vi.useFakeTimers();
  // Mid-afternoon, so yesterday's history is always "Yesterday" whatever time the suite runs.
  vi.setSystemTime(new Date(2026, 8, 28, 15, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ChatApp", () => {
  it("opens on #incidents with yesterday's history and a topic, without inspecting anything", () => {
    const { incident } = renderOs(<ChatApp />);
    expect(screen.getByRole("heading", { name: "# incidents" })).toBeTruthy();
    expect(screen.getByText(/Active incidents only/)).toBeTruthy();
    expect(screen.getByText("PM-212 is up for review. Short one: a cache TTL change, reverted within the hour.")).toBeTruthy();
    expect(screen.getByText("Yesterday")).toBeTruthy();
    expect(incident().snapshot.inspected).toEqual([]);
  });

  it("opening #deploys shows the deploy message and the Deploy Bot card, and inspects its hotspot once", () => {
    const { incident } = renderOs(<ChatApp />);
    fireEvent.click(screen.getByRole("button", { name: /^# deploys/ }));
    expect(screen.getByText("shipping the checkout refactor (v142), heading home")).toBeTruthy();
    expect(screen.getAllByText(world.colleagues.deployer).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Deploy Bot").length).toBeGreaterThan(0);
    expect(screen.getAllByText("APP").length).toBeGreaterThan(0);
    expect(screen.getByText("c41e07d")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^# infra/ }));
    fireEvent.click(screen.getByRole("button", { name: /^# deploys/ }));
    expect(incident().snapshot.inspected).toEqual(["laptop.slack.deploys", "laptop.slack.infra"]);
    expect(incident().timeline.filter((e) => e.kind === "inspect")).toHaveLength(2);
  });

  it("shows unread counts, a New messages divider on open, and clears them", () => {
    const { incident, os } = renderOs(<ChatApp />);
    expect(unreadCount(incident(), os().read)).toBe(9);
    fireEvent.click(screen.getByRole("button", { name: /^# deploys, 4 unread/ }));
    expect(screen.getByText("New messages")).toBeTruthy();
    expect(screen.getByRole("button", { name: "# deploys" })).toBeTruthy();
    expect(unreadCount(incident(), os().read)).toBe(5);
  });

  it("lists everyone under Direct messages with their presence", () => {
    renderOs(<ChatApp />);
    expect(screen.getByRole("button", { name: new RegExp(`^${world.colleagues.deployer}, away`) })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${world.colleagues.infra}, active`) }));
    expect(screen.getByText(`This is the very beginning of your direct message history with ${world.colleagues.infra}.`)).toBeTruthy();
  });

  it("adds incident messages at the page, and the secondary types while being asked, then replies", () => {
    const { incident } = renderOs(<ChatApp />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    expect(screen.getByText(`SEV2 opened: Checkout returning 5xx. Primary: you. Secondary: ${world.colleagues.secondary}.`)).toBeTruthy();
    act(() => incident().acknowledge());
    act(() => incident().dispatch("global.ask_secondary"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${world.colleagues.secondary}`) }));
    expect(screen.getByText(`${world.colleagues.secondary} is typing…`)).toBeTruthy();
    act(() => vi.advanceTimersByTime(11_000));
    expect(screen.getByText(`${world.colleagues.deployer} shipped v142 about an hour ago. Could that be it?`)).toBeTruthy();
    expect(screen.queryByText(`${world.colleagues.secondary} is typing…`)).toBeNull();
  });

  it("posts what you type, with Enter to send", () => {
    renderOs(<ChatApp />);
    const box = screen.getByRole("textbox", { name: "Message # incidents" });
    fireEvent.change(box, { target: { value: "on it" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByText("on it")).toBeTruthy();
    expect(screen.getAllByText("You").length).toBeGreaterThan(0);
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("toggles your reaction and opens a thread", () => {
    renderOs(<ChatApp />);
    const eyes = screen.getByRole("button", { name: /^👀 2, reacted by/ });
    fireEvent.click(eyes);
    expect(eyes.getAttribute("aria-pressed")).toBe("true");
    expect(eyes.getAttribute("aria-label")).toMatch(/^👀 3, reacted by .*you$/);
    fireEvent.click(screen.getByRole("button", { name: /2 replies/ }));
    const thread = screen.getByRole("complementary", { name: "Thread" });
    expect(thread.textContent).toContain("thanks, fixed both");
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));
    expect(screen.queryByRole("complementary", { name: "Thread" })).toBeNull();
  });
});
