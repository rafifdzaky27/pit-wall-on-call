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
    await page.keyboard.press("2");
    await page.clock.runFor(3_000);
    await page.getByRole("button", { name: /Roll back to v141/ }).click();
    await page.clock.runFor(41_000);
    await expect(page.getByText(/^Fix confirmed · resolved in/)).toBeVisible();
    await page.clock.runFor(4_000);
    await page.getByRole("button", { name: "Read the postmortem" }).click();
    await page.clock.runFor(1_000);
    await page.getByRole("button", { name: "New shift" }).click();
    await page.clock.runFor(2_000);
    await expect(page.locator(".stage")).toHaveAttribute("data-marker", "same");
    await expect(page.locator(".stage-screen .window")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start shift" }).first()).toBeVisible();
  });

  // @perf runs alone (PERF=1 playwright test --workers=1, a CI step of its own): frame times mean nothing while other browsers share the CPU.
  test("looking up and back down stays smooth @perf", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await skip(page).click();
    await page.keyboard.press("a");
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
