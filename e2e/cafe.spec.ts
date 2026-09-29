import { expect, test, type Page } from "@playwright/test";

const cafe = (page: Page) => page.getByRole("region", { name: "Café" });
const skip = (page: Page) => page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" });

test.describe("the café cold open", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Start shift → café → laptop → look up → the page rings on the table → A → Monitoring", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await expect(page.getByRole("img", { name: /^A café in / })).toBeVisible();
    await page.getByRole("button", { name: "Laptop", exact: true }).click();
    await expect(page.getByRole("region", { name: "Browser" })).toBeVisible();
    await page.keyboard.press("l");
    await expect(cafe(page)).toBeVisible();
    await skip(page).click();
    await expect(page.locator(".phone.ringing")).toBeVisible();
    await page.keyboard.press("a");
    await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
    await expect(cafe(page)).toBeHidden();
  });

  test("the café's captions and the phone sit above the laptop's live screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    const cafeRegion = cafe(page);
    /** What is painted on top at the centre of `where`: it must belong to `owner`. */
    const onTop = (owner: string, where: string) =>
      page.evaluate(
        ([o, w]) => {
          // In the café the screen is inert and ignores the pointer, which also hides it from hit-testing;
          // lift both for this measurement, so paint order alone decides.
          const screen = document.querySelector(".stage-screen") as HTMLElement;
          screen.inert = false;
          screen.style.pointerEvents = "auto";
          const r = document.querySelector(w)!.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest(o) !== null;
        },
        [owner, where],
      );
    await cafeRegion.getByRole("button", { name: "Phone", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Phone" })).toBeVisible();
    // The close-up covers the laptop: at the laptop screen's centre, the phone (or its backdrop) is on top.
    expect(await onTop(".phone-closeup-scrim", ".stage-screen")).toBe(true);
    await page.keyboard.press("Escape");
    await cafeRegion.getByRole("button", { name: "The next table", exact: true }).click();
    expect(await onTop(".cafe-caption", ".cafe-caption")).toBe(true);
  });

  test("a whole run: the fix holds on a visible countdown, then the cold close leads to the postmortem", async ({ page }) => {
    // Camera moves are cuts here: the fake clock races the real-time camera animations (the desktop
    // holds its renders while one runs). flow.spec covers the motion itself.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await skip(page).click();
    await page.keyboard.press("a");
    await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
    await page.keyboard.press("2");
    // The rollback lives in Deploys (M2.5 plan B4).
    await page.getByRole("navigation", { name: "Open in" }).getByRole("button", { name: "Deploys" }).click();
    await page.getByRole("button", { name: /Roll back to v141/ }).click();
    await page.clock.runFor(31_000);
    await expect(page.getByRole("status").filter({ hasText: "Fix holding" })).toBeVisible();
    await page.clock.runFor(11_000);
    await page.clock.runFor(1_600);
    await expect(page.getByText(/^Checkout is back\. Resolved in \d\d:\d\d\.$/)).toBeVisible();
    // The shift report opens 1.5 s after the caption (M2.5 spec §6).
    await page.clock.runFor(1_600);
    await page.getByRole("dialog", { name: "Shift report" }).getByRole("button", { name: "Read the postmortem" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Resolved in/ })).toBeVisible();
    await expect(page.getByText(/^Confirmed \d\d:\d\d$/)).toBeVisible();
  });

  test("if the café cannot load, a plain backdrop keeps the shift playable", async ({ page }) => {
    await page.route(/\/assets\/CafeView-[^/]+\.js$/, (route) => route.abort());
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await expect(page.locator(".cafe-fallback")).toBeVisible();
    await skip(page).click();
    await page.keyboard.press("a");
    await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
  });

  test("a shift loads no more than 300 kB of store photos (F5)", async ({ page }) => {
    let bytes = 0;
    let photos = 0;
    page.on("response", (res) => {
      if (/\/store\/[^/]+\.webp$/.test(res.url())) {
        bytes += Number(res.headers()["content-length"] ?? 0);
        photos++;
      }
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await page.keyboard.press("l");
    await expect(page.getByRole("region", { name: "Browser" })).toBeVisible();
    // The banner and the three products: the only photos a shift's store shows.
    await expect.poll(() => photos).toBeGreaterThanOrEqual(4);
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThanOrEqual(300_000);
  });
});

test.describe("Chat never scrolls the page (F1)", () => {
  test.use({ viewport: { width: 1366, height: 657 } });

  const unscrolled = (page: Page) =>
    page.evaluate(() => ({
      window: window.scrollY,
      root: document.scrollingElement?.scrollTop ?? 0,
      desktop: document.querySelector(".desktop")?.scrollTop ?? -1,
      stage: document.querySelector(".stage")?.scrollTop ?? -1,
      topBar: document.querySelector(".os-topbar")?.getBoundingClientRect().top ?? -1,
    }));

  test("opening #infra, with its New messages marker, keeps the whole page in place", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await page.keyboard.press("l");
    // At this size the Browser covers the dock; close it (X) so the dock is in plain view.
    await expect(page.getByRole("region", { name: "Browser" })).toBeVisible();
    await page.keyboard.press("x");
    const dock = page.getByRole("navigation", { name: "Dock" });
    await expect(dock).not.toHaveClass(/hidden/);
    await dock.getByRole("button", { name: /^Chat/ }).click();
    expect(await unscrolled(page)).toEqual({ window: 0, root: 0, desktop: 0, stage: 0, topBar: 0 });
    await page.getByRole("button", { name: /^# infra/ }).click();
    await expect(page.locator(".chat-new")).toBeVisible();
    expect(await unscrolled(page)).toEqual({ window: 0, root: 0, desktop: 0, stage: 0, topBar: 0 });
    await page.getByRole("button", { name: /^# deploys/ }).click();
    expect(await unscrolled(page)).toEqual({ window: 0, root: 0, desktop: 0, stage: 0, topBar: 0 });
  });
});
