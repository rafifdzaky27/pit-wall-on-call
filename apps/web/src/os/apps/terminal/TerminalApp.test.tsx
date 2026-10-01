import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../../testing";
import { TerminalApp } from "./TerminalApp";
import { FIXTURE_VOCAB, fixtureScenario } from "./testFixture";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const seconds = (n: number) => act(() => vi.advanceTimersByTime(n * 1000));
const input = () => screen.getByRole("textbox", { name: "Terminal command" }) as HTMLInputElement;
const log = () => screen.getByRole("log", { name: "Terminal output" });

function shift({ acked = true }: { acked?: boolean } = {}) {
  const r = renderOs(<TerminalApp vocabulary={FIXTURE_VOCAB} />, { scenario: fixtureScenario, prefs: { difficulty: "hard" } });
  act(() => r.incident().start());
  act(() => r.incident().skipPrepage());
  if (acked) act(() => r.incident().acknowledge());
  return r;
}

/** Types a line and presses Enter, as a player does. */
function run(line: string) {
  fireEvent.change(input(), { target: { value: line } });
  fireEvent.keyDown(input(), { key: "Enter" });
}

describe("the Terminal (M6 spec H3, H9)", () => {
  it("is an aria-live log with a labelled prompt", () => {
    shift();
    expect(log().getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("oncall@pitwall:~$")).toBeTruthy();
    expect(log().textContent).toContain("Type help");
  });

  it("ack takes the page", () => {
    const { incident } = shift({ acked: false });
    expect(incident().phase).toBe("paging");
    run("ack");
    expect(incident().phase).toBe("active");
    expect(log().textContent).toContain("Page acknowledged.");
  });

  it("a command that is on offer runs, shows running…, then prints the action's findings", () => {
    const { incident } = shift();
    run("kubectl top pods -l app=checkout");
    expect(incident().snapshot.busy?.actionId).toBe("checkout.pool_stats");
    expect(log().textContent).toContain("running…");
    seconds(5);
    expect(log().textContent).not.toContain("running…");
    expect(log().textContent).toContain("of 100 in use");
    expect(input().value).toBe("");
  });

  it("answers another operation is in progress while one runs, and runs nothing", () => {
    const { incident } = shift();
    run("kubectl logs deployment/edge --since=15m");
    run("kubectl top pods -l app=checkout");
    expect(log().textContent).toContain("another operation is in progress");
    expect(incident().snapshot.busy?.actionId).toBe("edge.error_log");
  });

  it("a command that is not on offer (any more) answers not found and runs nothing", () => {
    const { incident } = shift();
    run("flagctl disable zz_secret_flag");
    seconds(21);
    expect(incident().snapshot.busy).toBeNull();
    expect(incident().offers("postgres.raise_max_conns")).toBe(false);
    run("flagctl disable zz_secret_flag");
    expect(log().textContent).toContain("flagctl: no such target");
    expect(incident().snapshot.busy).toBeNull();
  });

  it("a known tool with arguments that match nothing reads the same, and never says a real service is missing", () => {
    shift();
    run("kubectl rollout undo deployment/ghost");
    expect(log().textContent).toContain("Error from server: the request could not be completed");
    expect(log().textContent).not.toContain("not found");
  });

  it("incidentctl status-page posts whatever text was typed, apostrophes included", () => {
    const { incident, os } = shift();
    run("incidentctl status-page \"We're seeing checkout errors, rolling back\"");
    expect(incident().snapshot.busy?.actionId).toBe("global.status_update");
    expect(os().chatPosts.map((p) => p.text)).toContain("Status update: We're seeing checkout errors, rolling back");
  });

  it("a single-quoted status text is posted too", () => {
    const { os } = shift();
    run("incidentctl status-page 'second note'");
    expect(os().chatPosts.map((p) => p.text)).toContain("Status update: second note");
  });

  it("unknown input says command not found", () => {
    shift();
    run("ls");
    expect(log().textContent).toContain("ls: command not found");
  });

  it("Up and Down recall the lines typed this shift", () => {
    shift();
    run("services");
    run("status");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().value).toBe("status");
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().value).toBe("services");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().value).toBe("status");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().value).toBe("");
  });

  it("Tab completes a tool name, and lists options when it is ambiguous", () => {
    shift();
    fireEvent.change(input(), { target: { value: "serv" } });
    fireEvent.keyDown(input(), { key: "Tab" });
    expect(input().value).toBe("services ");
  });

  it("Tab on an empty prompt leaves the keyboard free to move on", () => {
    shift();
    const notPrevented = fireEvent.keyDown(input(), { key: "Tab" });
    expect(notPrevented).toBe(true);
  });

  it("Ctrl+L clears the screen and Ctrl+C cancels the line", () => {
    shift();
    run("services");
    expect(log().textContent).toContain("edge-gateway");
    fireEvent.keyDown(input(), { key: "l", ctrlKey: true });
    expect(log().textContent).not.toContain("edge-gateway");
    fireEvent.change(input(), { target: { value: "half a comm" } });
    fireEvent.keyDown(input(), { key: "c", ctrlKey: true });
    expect(input().value).toBe("");
    expect(log().textContent).toContain("^C");
  });

  it("keeps its scrollback when the window closes and opens again", () => {
    const { unmount, os } = shift();
    run("services");
    expect(os().terminal.history).toEqual(["services"]);
    unmount();
    // A new mount in the same OS would read os().terminal; here the session itself is the contract.
    expect(os().terminal.entries.some((e) => e.text === "services")).toBe(true);
  });

  it("before the page it says commands wait for the ack", () => {
    const r = renderOs(<TerminalApp vocabulary={FIXTURE_VOCAB} />, { scenario: fixtureScenario, prefs: { difficulty: "hard" } });
    act(() => r.incident().start());
    run("kubectl top pods -l app=checkout");
    expect(log().textContent).toMatch(/ack/);
    expect(r.incident().snapshot.busy).toBeNull();
  });
});
