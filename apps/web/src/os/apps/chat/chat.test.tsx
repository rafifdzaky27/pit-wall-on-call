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

  it("opens a channel at its first unread message, like Slack", () => {
    // jsdom has no layout: the list sits at 100 px and the "New messages" marker 300 px into its content.
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const scrolled = this.closest(".chat-log")?.scrollTop ?? 0;
      const top = this.classList.contains("chat-new") ? 400 - scrolled : this.classList.contains("chat-log") ? 100 : 0;
      return { top, left: 0, right: 0, bottom: top, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    try {
      renderOs(<ChatApp />);
      fireEvent.click(screen.getByRole("button", { name: /^# deploys/ }));
      expect(document.querySelector(".chat-log")!.scrollTop).toBe(300);
    } finally {
      rect.mockRestore();
    }
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

describe("ChatApp scrolling", () => {
  afterEach(cleanup);

  it("opens a channel at its first unread message without scrolling any ancestor", () => {
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    try {
      renderOs(<ChatApp />);
      fireEvent.click(screen.getByRole("button", { name: /^# infra/ }));
      expect(document.querySelector(".chat-new")).not.toBeNull();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe("a chat you can use (M2.5 spec §7)", () => {
  const seconds = (n: number) => {
    for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(1000));
  };
  const box = () => screen.getByRole("textbox", { name: /^Message / }) as HTMLTextAreaElement;
  const type = (text: string) => {
    fireEvent.change(box(), { target: { value: text } });
    fireEvent.keyDown(box(), { key: "Enter" });
  };
  const paged = () => {
    const view = renderOs(<ChatApp />);
    act(() => view.incident().start());
    act(() => view.incident().skipPrepage());
    act(() => view.incident().acknowledge());
    return view;
  };
  const dm = (person: "deployer" | "support" | "secondary") => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${world.colleagues[person]}`) }));

  it("a teammate's DM offers questions; asking posts yours, they type, and answer on their own clock", () => {
    const { incident } = paged();
    dm("deployer");
    fireEvent.click(screen.getByRole("button", { name: "hey, what went out in checkout today?" }));
    expect(screen.getByText("hey, what went out in checkout today?", { selector: ".msg-text, p" })).toBeTruthy();
    expect(incident().timeline.some((e) => e.kind === "action_start" && e.actionId === "ask.deployer.changes")).toBe(true);
    expect(screen.getByText(`${world.colleagues.deployer} is typing…`)).toBeTruthy();
    // You can keep working while they answer.
    expect(incident().snapshot.busy).toBeNull();
    seconds(31);
    expect(screen.getByText(/v142, the checkout refactor/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "hey, what went out in checkout today?" })).toBeNull();
  });

  it("/ask works from any channel, and says where the question went", () => {
    const { incident } = paged();
    type(`/ask @${world.colleagues.support.toLowerCase()} impact`);
    expect(incident().timeline.some((e) => e.kind === "action_start" && e.actionId === "ask.support.impact")).toBe(true);
    expect(screen.getByRole("status", { name: "Chat note" }).textContent).toBe(`Asked ${world.colleagues.support} in a direct message.`);
  });

  it("/status posts your words in #incidents and runs the status update", () => {
    const { incident } = paged();
    type("/status Investigating failed payments");
    expect(screen.getByText("Status update: Investigating failed payments")).toBeTruthy();
    expect(incident().snapshot.busy?.actionId).toBe("global.status_update");
  });

  it("/help and mistakes show a note, and nothing is posted", () => {
    paged();
    type("/help");
    expect(screen.getByRole("status", { name: "Chat note" }).textContent).toContain("/ask @name topic");
    type("/ask @nobody changes");
    expect(screen.getByRole("status", { name: "Chat note" }).textContent).toBe("No teammate called nobody. Try /help.");
    expect(box().value).toBe("/ask @nobody changes");
  });

  it("Tab completes a command", () => {
    paged();
    fireEvent.change(box(), { target: { value: "/st" } });
    fireEvent.keyDown(box(), { key: "Tab" });
    expect(box().value).toBe("/status ");
  });

  it("Tab leaves the composer once there is nothing left to complete, and Shift+Tab always does (review I1)", () => {
    paged();
    fireEvent.change(box(), { target: { value: "/ask @" } });
    fireEvent.keyDown(box(), { key: "Tab" });
    fireEvent.keyDown(box(), { key: "Tab" });
    const whole = box().value;
    expect(whole).toMatch(/^\/ask @\w+ \w+$/);
    // A whole command has nothing more to complete: Tab moves focus on, as it does everywhere else.
    expect(fireEvent.keyDown(box(), { key: "Tab" })).toBe(true);
    expect(box().value).toBe(whole);
    fireEvent.change(box(), { target: { value: "/st" } });
    expect(fireEvent.keyDown(box(), { key: "Tab", shiftKey: true })).toBe(true);
    expect(box().value).toBe("/st");
  });

  it("before the page is acknowledged, a question explains why it can't go yet", () => {
    const view = renderOs(<ChatApp />);
    act(() => view.incident().start());
    dm("deployer");
    fireEvent.click(screen.getByRole("button", { name: "hey, what went out in checkout today?" }));
    expect(screen.getByRole("status", { name: "Chat note" }).textContent).toBe("Acknowledge the page first.");
  });

  it("free text in a DM gets an honest answer", () => {
    paged();
    dm("deployer");
    type("did you break prod");
    seconds(6);
    expect(screen.getByText("Not sure what you mean. Try /help, or one of the suggestions below.")).toBeTruthy();
  });
});
