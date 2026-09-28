import { resolveWorld } from "@pitwall/world";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../../testing";
import { ChatApp } from "./ChatApp";
import { unreadCount } from "./unread";

const world = resolveWorld(1);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ChatApp", () => {
  it("opens on #incidents, which is empty before the page, without inspecting anything", () => {
    const { incident } = renderOs(<ChatApp />);
    expect(screen.getByRole("heading", { name: "# incidents" })).toBeTruthy();
    expect(screen.getByText("No messages in #incidents yet.")).toBeTruthy();
    expect(incident().snapshot.inspected).toEqual([]);
  });

  it("opening #deploys shows the deploy message and inspects its hotspot exactly once", () => {
    const { incident } = renderOs(<ChatApp />);
    fireEvent.click(screen.getByRole("button", { name: /^# deploys/ }));
    expect(screen.getByText("shipping the checkout refactor (v142), heading home")).toBeTruthy();
    expect(screen.getAllByText(world.colleagues.deployer).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^# infra/ }));
    fireEvent.click(screen.getByRole("button", { name: /^# deploys/ }));
    expect(incident().snapshot.inspected).toEqual(["laptop.slack.deploys", "laptop.slack.infra"]);
    expect(incident().timeline.filter((e) => e.kind === "inspect")).toHaveLength(2);
  });

  it("shows unread counts in channel names and clears them on open", () => {
    const { incident, os } = renderOs(<ChatApp />);
    expect(screen.getByRole("button", { name: /^# deploys, 3 unread/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^# deploys/ }));
    expect(screen.getByRole("button", { name: "# deploys" })).toBeTruthy();
    expect(unreadCount(incident(), os().read)).toBe(2);
  });

  it("adds incident messages at the page, and the secondary's DM after asking", () => {
    const { incident } = renderOs(<ChatApp />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    expect(screen.getByText(`SEV2 opened: Checkout returning 5xx. Primary: you. Secondary: ${world.colleagues.secondary}.`)).toBeTruthy();
    act(() => incident().acknowledge());
    act(() => incident().dispatch("global.ask_secondary"));
    act(() => vi.advanceTimersByTime(11_000));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${world.colleagues.secondary}`) }));
    expect(screen.getByText(`${world.colleagues.deployer} shipped v142 about an hour ago. Could that be it?`)).toBeTruthy();
  });
});
