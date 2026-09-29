import { expect, test, type Page } from "@playwright/test";

const skip = (page: Page) => page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" });

/** Frame times while `during` runs: rAF deltas, in ms. */
async function frameTimes(page: Page, during: () => Promise<void>, ms = 1100): Promise<number[]> {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __sampling: boolean };
    w.__frames = [];
    w.__sampling = true;
    let last = performance.now();
    const tick = (t: number) => {
      w.__frames.push(t - last);
      last = t;
      if (w.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await during();
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __sampling: boolean };
    w.__sampling = false;
    return w.__frames.slice(1);
  });
}

test.describe("flow (M2.5 spec §11)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("New shift from the postmortem keeps the café and lands on an empty desktop", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    await page.evaluate(() => document.querySelector(".stage")!.setAttribute("data-marker", "same"));
    await page.getByRole("button", { name: "Start shift" }).click();
    await skip(page).click();
    await page.keyboard.press("a");
    // The ack leaves you on the desktop; its notice points to Monitoring.
    await page.getByRole("button", { name: "Open Monitoring" }).first().click();
    await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
    await page.keyboard.press("2");
    await page.clock.runFor(3_000);
    // The rollback lives in Deploys (M2.5 plan B4).
    await page.getByRole("navigation", { name: "Open in" }).getByRole("button", { name: "Deploys" }).click();
    await page.getByRole("button", { name: /Roll back to v141/ }).click();
    // "Fix confirmed" shows for 1.5 s before the cold close: step the clock and catch it in its window.
    await page.clock.runFor(38_000);
    let confirmed = false;
    for (let i = 0; i < 20 && !confirmed; i++) {
      await page.clock.runFor(500);
      confirmed = await page.getByText(/^Fix confirmed · resolved in/).isVisible();
    }
    expect(confirmed).toBe(true);
    await page.clock.runFor(4_000);
    await page.getByRole("button", { name: "Read the postmortem" }).click();
    await page.clock.runFor(1_000);
    await page.getByRole("button", { name: "New shift" }).click();
    await page.clock.runFor(2_000);
    await expect(page.locator(".stage")).toHaveAttribute("data-marker", "same");
    await expect(page.locator(".stage-screen .window")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start shift" }).first()).toBeVisible();
  });

  test("the shift report opens by itself and fits a 1366×657 laptop", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 657 });
    await page.clock.install();
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await skip(page).click();
    await page.keyboard.press("a");
    // The ack leaves you on the desktop; its notice points to Monitoring.
    await page.getByRole("button", { name: "Open Monitoring" }).first().click();
    await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
    await page.keyboard.press("2");
    await page.clock.runFor(3_000);
    // The rollback lives in Deploys (M2.5 plan B4).
    await page.getByRole("navigation", { name: "Open in" }).getByRole("button", { name: "Deploys" }).click();
    await page.getByRole("button", { name: /Roll back to v141/ }).click();
    await page.clock.runFor(45_000);
    await page.clock.runFor(3_200);
    const report = page.getByRole("dialog", { name: "Shift report" });
    await expect(report).toBeVisible();
    for (const name of ["New shift", "Share", "Full leaderboard", "Read the postmortem"]) {
      const box = (await report.getByRole("button", { name }).boundingBox())!;
      expect(box.y + box.height, name).toBeLessThanOrEqual(657);
    }
  });

  test("a tab from before a deploy reloads instead of crashing when an app's chunk is gone", async ({ page }) => {
    await page.route(/\/assets\/SettingsApp-[^/]+\.js$/, (r) => r.fulfill({ status: 404, body: "" }));
    await page.goto("/");
    const openSettings = async () => {
      await page.getByRole("button", { name: "System" }).click();
      await page.getByRole("button", { name: /settings/i }).first().click();
    };
    // First failure: the page reloads onto the "new version".
    const reloaded = page.waitForEvent("load");
    await openSettings();
    await reloaded;
    // Still missing right after the reload: the window says so, and the desktop keeps working.
    await openSettings();
    await expect(page.getByText("Couldn't load this app.")).toBeVisible();
    await expect(page.getByText("The simulation hit an error")).toHaveCount(0);
    // The desktop itself keeps working (the Shift banner may already have hidden itself).
    await expect(page.getByRole("main", { name: "Desktop" })).toBeVisible();
  });

  test("? opens Help, and its glossary explains the terms (M2.5 spec §4)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Start shift" }).first()).toBeVisible();
    await page.keyboard.press("?");
    const help = page.getByRole("region", { name: "Help" });
    await expect(help).toBeVisible();
    await expect(help.getByRole("heading", { level: 2, name: "How to play" })).toBeVisible();
    await help.getByRole("navigation", { name: "Help pages" }).getByRole("button", { name: "Glossary" }).click();
    await expect(help.getByRole("heading", { level: 2, name: "Glossary" })).toBeVisible();
    await expect(help.getByLabel("Glossary")).toContainText("Error budget");
  });

  test("pressing L again mid-move turns the camera around where it is, with no snap (M2.5 follow-up)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await page.waitForTimeout(1500);
    // The laptop screen's width on screen, every frame: one continuous measure of the whole camera.
    await page.evaluate(() => {
      const w = window as unknown as { __widths: number[]; __run: boolean };
      w.__widths = [];
      w.__run = true;
      const screenEl = document.querySelector("[data-testid=stage-screen]")!;
      const tick = () => {
        if (!w.__run) return;
        w.__widths.push(screenEl.getBoundingClientRect().width);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    for (const gap of [150, 270, 390, 150, 270, 390, 150, 270]) {
      await page.keyboard.press("l");
      await page.waitForTimeout(gap);
    }
    await page.waitForTimeout(1500);
    const widths = await page.evaluate(() => {
      const w = window as unknown as { __widths: number[]; __run: boolean };
      w.__run = false;
      return w.__widths;
    });
    const steps = widths.slice(1).map((v, i) => Math.abs(v - widths[i]!));
    // A 700 ms move covers about 1000 px, some 50 px a frame at its fastest; a snap is the whole distance at once.
    expect(Math.max(...steps)).toBeLessThan(400);
  });

  // @perf runs alone (PERF=1 playwright test --workers=1, a CI step of its own): frame times mean nothing while other browsers share the CPU.
  test("looking up and back down stays smooth @perf", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await skip(page).click();
    await page.keyboard.press("a");
    // The ack leaves you on the desktop; its notice points to Monitoring.
    await page.getByRole("button", { name: "Open Monitoring" }).first().click();
    await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
    await page.waitForTimeout(1500);
    const up = await frameTimes(page, () => page.keyboard.press("l"));
    const down = await frameTimes(page, () => page.keyboard.press("l"));
    const all = [...up, ...down].sort((a, b) => a - b);
    const p90 = all[Math.floor(all.length * 0.9)]!;
    const long = all.filter((f) => f > 50).length;
    console.log(`camera frames: n=${all.length} median=${all[Math.floor(all.length / 2)]!.toFixed(1)} p90=${p90.toFixed(1)} over50=${long} worst=${all.at(-1)!.toFixed(1)}`);
    // Alone, a laptop measures a 16.7 ms median and no frame over 50 ms; the bounds leave CI some room.
    expect(p90).toBeLessThanOrEqual(34);
    expect(long).toBeLessThanOrEqual(2);
  });
});
