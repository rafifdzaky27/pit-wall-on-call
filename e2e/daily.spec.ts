import { expect, test, type Page } from "@playwright/test";
import { dailyFor, utcDate } from "../packages/scenarios/src/daily";

// Reduced motion: these flows are about the daily, not the camera (flow.spec covers motion).
test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

/** Ack, open Deploys from Monitoring, roll back, and let the fix hold until the report opens. */
async function playToReport(page: Page) {
  await page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" }).click();
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Open Monitoring" }).first().click();
  await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
  await page.keyboard.press("2");
  await page.clock.runFor(3_000);
  await page.getByRole("navigation", { name: "Open in" }).getByRole("button", { name: "Deploys" }).click();
  await page.getByRole("button", { name: /Roll back to v141/ }).click();
  await page.clock.runFor(31_000);
  await page.clock.runFor(11_000);
  await page.clock.runFor(1_600);
  await page.clock.runFor(1_600);
  return page.getByRole("dialog", { name: "Shift report" });
}

test("today's daily: the first attempt ranks, the second is practice (M3)", async ({ page }) => {
  const today = dailyFor(utcDate(Date.now()));
  const handle = `d_${Date.now().toString(36).slice(-7)}`;
  await page.clock.install();
  await page.goto("/daily");
  // The share link lands on the desktop, and the landing leads with today's daily.
  await expect(page.getByRole("heading", { name: new RegExp(`^Daily #${today.number} · `) })).toBeVisible();
  await page.getByRole("button", { name: "Start daily" }).first().click();
  const report = await playToReport(page);
  await expect(report.getByText(`Daily #${today.number} · Shift report`)).toBeVisible();
  const board = report.getByRole("region", { name: "Leaderboard" });
  await board.getByRole("textbox", { name: "Handle" }).fill(handle);
  await board.getByRole("button", { name: "Post score" }).click();
  await expect(board.getByText(/^Ranked #\d+ of \d+ on today's daily board\.$/)).toBeVisible({ timeout: 15_000 });
  await expect(report.getByRole("table", { name: "Daily leaderboard" }).getByText(`${handle}#`, { exact: false })).toBeVisible();

  // Back on the desktop, the landing says it is done, and offers it again as practice.
  await report.getByRole("button", { name: "New shift" }).click();
  await page.clock.runFor(2_000);
  const done = page.getByRole("heading", { name: /^Daily #\d+ done · #\d+ of \d+$/ });
  await expect(done).toBeVisible();
  await expect(done).toHaveText(new RegExp(`^Daily #${today.number} `));
  await page.getByRole("button", { name: "Daily again (practice)" }).first().click();
  const again = await playToReport(page);
  await expect(again.getByText("Practice: your ranked attempt at today's daily came earlier. This one counts on the practice board.")).toBeVisible({ timeout: 15_000 });
});
