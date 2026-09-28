import { desktopFor, slowLeak } from "@pitwall/scenarios";
import { formatPrice, resolveWorld } from "@pitwall/world";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../../testing";
import { BrowserApp } from "./BrowserApp";
import { ErrorPage } from "./ErrorPage";
import { EXPLAIN, REASON, statusClass } from "./http";
import { rowForTick } from "./network";

const content = desktopFor(slowLeak.id);

describe("http helpers", () => {
  it("names and explains every code the game uses, including 304", () => {
    for (const code of [200, 201, 304, 403, 429, 500, 502, 503, 504]) {
      expect(REASON[code], String(code)).toBeTruthy();
      expect(EXPLAIN[code], String(code)).toBeTruthy();
    }
    expect(EXPLAIN[304]).toMatch(/not an error/);
    expect([statusClass(200), statusClass(304), statusClass(429), statusClass(502)]).toEqual(["ok", "redirect", "client", "server"]);
  });
});

describe("rowForTick", () => {
  it("is deterministic per seed and tick", () => {
    expect(rowForTick(content, 502, 7, 50, 3000)).toEqual(rowForTick(content, 502, 7, 50, 3000));
  });

  it("never fails with a zero error rate, and fails every checkout at 100%", () => {
    for (let t = 5; t <= 1000; t += 5) {
      const ok = rowForTick(content, 502, 1, t, 0);
      expect(ok.status).not.toBe(502);
      const bad = rowForTick(content, 502, 1, t, 10_000);
      if (bad.path === "/checkout") expect(bad.status).toBe(502);
      else expect(bad.status).not.toBe(502);
    }
  });

  it("includes 304 Not Modified for cached assets", () => {
    const statuses = new Set<number>();
    for (let t = 5; t <= 1000; t += 5) statuses.add(rowForTick(content, 502, 3, t, 0).status);
    expect(statuses).toContain(304);
  });
});

describe("ErrorPage", () => {
  afterEach(cleanup);

  it.each([
    [502, "nginx", "502 Bad Gateway"],
    [504, "nginx", "504 Gateway Timeout"],
    [503, "framework", "Service Unavailable"],
    [403, "cdn", "Forbidden"],
  ] as const)("shows %i the way %s does", (code, server, heading) => {
    render(<ErrorPage code={code} server={server} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(heading);
    expect(document.body.textContent).toContain(String(code));
  });
});

describe("BrowserApp", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("before the page, shows the city brand's working store", () => {
    renderOs(<BrowserApp />);
    const world = resolveWorld(1);
    expect((screen.getByRole("textbox", { name: "Address" }) as HTMLInputElement).value).toBe(`https://${world.brand.domain}/`);
    expect(screen.getByRole("heading", { name: world.brand.name })).toBeTruthy();
    const first = world.brand.products[0]!;
    expect(screen.getAllByText(formatPrice(first.price, world.city.currency)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Checkout/ }));
    expect(screen.getByRole("button", { name: "Place order" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: world.brand.name })).toBeTruthy();
  });

  it("at the page, checkout shows the real 502 page, and the Network panel shows codes", () => {
    const { incident } = renderOs(<BrowserApp />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("502 Bad Gateway");
    expect(screen.getByRole("tab").textContent).toBe("502 Bad Gateway");
    fireEvent.click(screen.getByRole("button", { name: "Network" }));
    expect(screen.getByText("No requests recorded yet. They appear once the incident clock is running.")).toBeTruthy();
    act(() => vi.advanceTimersByTime(60_000));
    const table = screen.getByRole("table", { name: "Network requests" });
    const failed = within(table).getAllByRole("button", { name: /^502/ });
    expect(failed.length).toBeGreaterThan(0);
    fireEvent.click(failed[0]!);
    expect(screen.getByRole("status").textContent).toMatch(/502 Bad Gateway: the gateway got an invalid response/);
  });

  it("once the fix lands, checkout loads again", () => {
    const { incident } = renderOs(<BrowserApp />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("checkout.rollback"));
    act(() => vi.advanceTimersByTime(40_000));
    expect(screen.getByRole("button", { name: "Place order" })).toBeTruthy();
  });
});
