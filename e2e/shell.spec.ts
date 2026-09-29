import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("Start shift asks for full screen", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { fsCalls: number }).fsCalls = 0;
    // documentElement does not exist yet when init scripts run, so stub the prototype.
    Element.prototype.requestFullscreen = async function () {
      (window as unknown as { fsCalls: number }).fsCalls++;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Practice shift" }).click();
  expect(await page.evaluate(() => (window as unknown as { fsCalls: number }).fsCalls)).toBe(1);
});

test("the dock hides under maximized Monitoring (opened from the ack notice) and returns at the bottom edge", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice shift" }).click();
  await page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" }).click();
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Open Monitoring" }).first().click();
  const dock = page.getByRole("navigation", { name: "Dock" });
  await expect(dock).toHaveClass(/hidden/);
  await page.mouse.move(720, 899);
  await expect(dock).not.toHaveClass(/hidden/);
  await page.mouse.move(720, 300);
  await expect(dock).toHaveClass(/hidden/);
});

test("a window resizes from its corner", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Dock" }).getByRole("button", { name: "Files" }).click();
  const win = page.getByRole("region", { name: "Files" });
  await expect(win).toBeVisible();
  const before = (await win.boundingBox())!;
  const handle = win.locator(".rz-se");
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 80, h.y + 60, { steps: 4 });
  await page.mouse.up();
  const after = (await win.boundingBox())!;
  expect(Math.round(after.width - before.width)).toBeGreaterThanOrEqual(70);
  expect(Math.round(after.height - before.height)).toBeGreaterThanOrEqual(50);
});

test("only one top-bar menu opens at a time", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Phone/ }).click();
  await page.getByRole("button", { name: "System" }).click();
  await expect(page.getByRole("group", { name: "Quick settings" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Phone notifications" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "Quick settings" })).toHaveCount(0);
});

test("the storefront shows product photos", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Dock" }).getByRole("button", { name: "Browser" }).click();
  const img = page.locator(".st-card img").first();
  await expect(img).toBeVisible();
  // The photo is lazy-loaded, so wait for it rather than sampling once.
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
});

test("the cart drawer fits the page, with its checkout button in view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 789 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Dock" }).getByRole("button", { name: "Browser" }).click();
  await page.locator(".st-cart").click();
  const pay = page.locator(".st-drawer .st-pay");
  await expect(pay).toBeInViewport();
  const win = (await page.getByRole("region", { name: "Browser" }).boundingBox())!;
  const box = (await pay.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(win.y + win.height);
});
