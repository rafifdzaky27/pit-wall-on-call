import { expect, test } from "@playwright/test";

test.describe("PitOS desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("desktop → start shift → page → ack → Monitoring", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("main", { name: "Desktop" })).toBeVisible();
    await page.getByRole("button", { name: "Practice shift" }).click();
    await expect(page.getByRole("region", { name: "Café" })).toBeVisible();
    await page.keyboard.press("l");
    await expect(page.getByRole("region", { name: "Browser" })).toBeVisible();
    await page.getByRole("button", { name: "Skip to the page" }).click();
    await expect(page.getByRole("alertdialog", { name: "Checkout returning 5xx" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "502 Bad Gateway" })).toBeVisible();
    await page.keyboard.press("a");
    // The ack leaves you on the desktop; its notice points to Monitoring.
    await page.getByRole("button", { name: "Open Monitoring" }).first().click();
    await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Alerts" })).toBeVisible();
  });

  test("reading #deploys in Chat before the page counts as a clue", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Dock" }).getByRole("button", { name: /^Chat/ }).click();
    await page.getByRole("button", { name: /^# deploys/ }).click();
    await expect(page.getByText("shipping the checkout refactor (v142), heading home")).toBeVisible();
  });
});

test.describe("small screens", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the lockscreen explains the laptop requirement without horizontal scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("main", { name: "Lock screen" })).toBeVisible();
    await expect(page.getByText(/needs a screen at least 1024 px wide/)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
