import { desktopFor, slowLeak } from "@pitwall/scenarios";
import { CITIES, formatPrice, resolveWorld, STORE_COPY } from "@pitwall/world";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import photos from "../../../content/store-photos.json";
import { renderOs } from "../../testing";
import { BrowserApp, NAV_MS, PLACE_MS } from "./BrowserApp";
import { ErrorPage } from "./ErrorPage";
import { EXPLAIN, REASON, statusClass } from "./http";
import { matchesFilter, rowForTick, summarize, type NetRow } from "./network";

const content = desktopFor(slowLeak.id);
const world = resolveWorld(1);
const copy = STORE_COPY[world.brand.locale];

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

describe("store photos", () => {
  it("every product and banner has a downloaded photo with a credit", () => {
    // The glob only lists files; nothing is loaded into the test.
    const files = new Set(Object.keys(import.meta.glob("../../../../public/store/*.webp")).map((f) => f.split("/").at(-1)));
    const credited = new Set(photos.map((p) => p.file));
    for (const city of CITIES) {
      for (const key of [city.brand.banner.image, ...city.brand.products.map((p) => p.image)]) {
        expect(credited.has(key), key).toBe(true);
        expect(files.has(`${key}.webp`), key).toBe(true);
      }
    }
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

  it("includes 304 Not Modified for cached assets, and every request type", () => {
    const statuses = new Set<number>();
    const types = new Set<string>();
    for (let t = 5; t <= 2000; t += 5) {
      const r = rowForTick(content, 502, 3, t, 0);
      statuses.add(r.status);
      types.add(r.type);
    }
    expect(statuses).toContain(304);
    expect([...types].sort()).toEqual(["document", "fetch", "img", "script", "stylesheet"]);
  });
});

describe("network summary and filters", () => {
  const row = (over: Partial<NetRow>): NetRow => ({ id: 1, tick: 10, method: "GET", path: "/", status: 200, ms: 100, bytes: 1000, type: "document", initiator: "Other", ...over });

  it("totals requests, bytes and the finish time", () => {
    expect(summarize([row({ id: 1, tick: 10, ms: 100, bytes: 1024 }), row({ id: 2, tick: 20, ms: 5000, bytes: 2048 })])).toEqual({ count: 2, bytes: 3072, finishMs: 6000 });
    expect(summarize([])).toEqual({ count: 0, bytes: 0, finishMs: 0 });
  });

  it("filters by type chip and by text", () => {
    const r = row({ type: "fetch", path: "/checkout" });
    expect(matchesFilter(r, "all", "")).toBe(true);
    expect(matchesFilter(r, "fetch", "check")).toBe(true);
    expect(matchesFilter(r, "img", "")).toBe(false);
    expect(matchesFilter(r, "all", "cart")).toBe(false);
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

  it("before the page, shows the city brand's storefront with photos, ratings and a cart", () => {
    renderOs(<BrowserApp />);
    expect((screen.getByRole("textbox", { name: "Address" }) as HTMLInputElement).value).toBe(`https://${world.brand.domain}/`);
    expect(screen.getByRole("heading", { level: 1, name: world.brand.name })).toBeTruthy();
    const first = world.brand.products[0]!;
    expect(screen.getAllByText(formatPrice(first.price, world.city.currency)).length).toBeGreaterThan(0);
    expect((screen.getByRole("img", { name: first.name }) as HTMLImageElement).getAttribute("src")).toBe(`/store/${first.image}.webp`);
    expect(screen.getByText(copy.rating(first.rating, first.sold))).toBeTruthy();
    expect(screen.getByRole("button", { name: `${copy.cart}, 2` })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: copy.addToCart })[2]!);
    expect(screen.getByRole("button", { name: `${copy.cart}, 3` })).toBeTruthy();
  });

  it("search narrows the product grid", () => {
    renderOs(<BrowserApp />);
    const [a, b] = world.brand.products;
    fireEvent.change(screen.getByRole("searchbox", { name: copy.search }), { target: { value: a!.name.slice(0, 6) } });
    expect(screen.getByRole("img", { name: a!.name })).toBeTruthy();
    expect(screen.queryByRole("img", { name: b!.name })).toBeNull();
  });

  it("goes from the cart to checkout with a loading bar, places an order, and navigates back and forward", () => {
    renderOs(<BrowserApp />);
    fireEvent.click(screen.getByRole("button", { name: `${copy.cart}, 2` }));
    const drawer = screen.getByRole("dialog", { name: copy.cart });
    fireEvent.click(within(drawer).getByRole("button", { name: copy.checkout }));
    expect(screen.getByRole("progressbar", { name: "Loading page" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(NAV_MS));
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect((screen.getByRole("textbox", { name: "Address" }) as HTMLInputElement).value).toBe(`https://${world.brand.domain}/checkout`);
    fireEvent.click(screen.getByRole("button", { name: copy.placeOrder }));
    act(() => vi.advanceTimersByTime(PLACE_MS));
    expect(screen.getByRole("status").textContent).toContain(world.brand.name);
    expect(document.body.textContent).toMatch(new RegExp(`${world.brand.name.slice(0, 3).toUpperCase()}-\\d{6}(?!\\d)`));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    act(() => vi.advanceTimersByTime(NAV_MS));
    expect(screen.getByRole("button", { name: copy.placeOrder })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    act(() => vi.advanceTimersByTime(NAV_MS));
    expect(screen.getByRole("status").textContent).toContain(world.brand.name);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    act(() => vi.advanceTimersByTime(NAV_MS));
    expect(screen.getByRole("heading", { level: 1, name: world.brand.name })).toBeTruthy();
  });

  it("at the page, checkout shows the real 502 page, and DevTools shows codes, types and a summary", () => {
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
    expect(screen.getByText(/requests · .* transferred · Finish:/)).toBeTruthy();
    fireEvent.click(failed[0]!);
    expect(screen.getByRole("status").textContent).toMatch(/502 Bad Gateway: the gateway got an invalid response/);
    fireEvent.click(screen.getByRole("button", { name: "Img" }));
    expect(within(table).queryAllByRole("button", { name: /^502/ })).toHaveLength(0);
  });

  it("once the fix lands, checkout loads again", () => {
    const { incident } = renderOs(<BrowserApp />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("checkout.rollback"));
    act(() => vi.advanceTimersByTime(40_000));
    expect(screen.getByRole("button", { name: copy.placeOrder })).toBeTruthy();
  });

  it("closing the tab closes the Browser window, as the last tab does in Chrome", () => {
    const { os } = renderOs(<BrowserApp />);
    act(() => os().openApp("browser"));
    fireEvent.click(screen.getByRole("button", { name: "Close tab" }));
    expect(os().wm.windows.filter((w) => !w.closing)).toHaveLength(0);
  });
});
