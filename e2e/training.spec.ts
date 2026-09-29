import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("a first-timer takes the coached training shift from the landing to the report (M2.5 spec §5)", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  // The first visit leads with the training shift.
  await page.getByRole("button", { name: "Training shift (about 3 min)" }).first().click();
  const coach = page.getByRole("region", { name: "Training coach" });
  await expect(coach.getByRole("status")).toHaveText(/^Nothing is broken yet/);
  await page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" }).click();
  await expect(coach.getByRole("status")).toHaveText(/^The pager is ringing/);
  await page.keyboard.press("a");
  // The ack leaves you on the desktop; its notice points to Monitoring.
  await page.getByRole("button", { name: "Open Monitoring" }).first().click();
  await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
  await expect(coach.getByRole("status")).toHaveText(/^Open Logs/);
  // Show me opens the tool, filtered to the service, and outlines the control (M2.5 plan B Task 5).
  const showMe = async (target: string) => {
    await coach.getByRole("button", { name: "Show me" }).click();
    // The tool loads lazily and Show me keeps looking on the (frozen) clock, so step it.
    const lit = page.locator(`[data-coach="${target}"].coach-highlight`);
    for (let i = 0; i < 20 && (await lit.count()) === 0; i++) await page.clock.runFor(100);
    await expect(lit).toHaveCount(1);
    await page.locator(`[data-coach="${target}"]`).click();
  };
  await showMe("action:api.logs");
  await page.clock.runFor(4_000);
  await expect(coach.getByRole("status")).toHaveText(/config history/);
  await showMe("action:api.config");
  await page.clock.runFor(4_000);
  // Tell customers first, then fix (the coach's order since the M2.5 review).
  await expect(coach.getByRole("status")).toHaveText(/status update/);
  await showMe("action:global.status_update");
  await page.clock.runFor(6_000);
  await showMe("action:api.config_rollback");
  await page.clock.runFor(16_000);
  await page.clock.runFor(16_000);
  await page.clock.runFor(3_200);
  const report = page.getByRole("dialog", { name: "Shift report" });
  await expect(report.getByRole("heading", { level: 2 })).toHaveText("Training complete");
  await report.getByRole("button", { name: "Start a real shift" }).click();
  await expect(page.getByRole("region", { name: "Training coach" })).toHaveCount(0);
  // Done once: the landing now leads with the real shift.
  await page.clock.runFor(2_000);
  await expect(page.getByRole("button", { name: "Start shift" }).first()).toBeVisible();
});
