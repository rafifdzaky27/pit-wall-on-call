import { expect, test } from "@playwright/test";

// Reduced motion: this is about the words a first-timer gets, not the camera.
test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

test("a first shift says what the job is, and points where to look when the player stalls (M4.5)", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Practice shift" }).first().click();
  await page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" }).click();
  await page.keyboard.press("a");
  // The ack notice states the objective: what customers hit, and what winning means (N1).
  await expect(page.getByText(/^Customers get .* Find the cause and fix it before the error budget runs out/).first()).toBeVisible();

  // Nothing happens for a while: one hint points at the next place, never at the answer (N3).
  await page.clock.runFor(46_000);
  await expect(page.getByRole("heading", { name: "Where to look" })).toBeVisible();
  await expect(page.getByText(/Monitoring has the map of every service/)).toBeVisible();

  // Monitoring: the objective strip, and a map that says how many services there are and what the colours mean (N2).
  await page.getByRole("button", { name: "Open Monitoring" }).first().click();
  const monitoring = page.getByRole("region", { name: "Monitoring" });
  await expect(monitoring.getByText("Your job")).toBeVisible();
  await expect(monitoring.getByText(/\d+ services · click one to see its metrics and checks/)).toBeVisible();
  await expect(monitoring.getByText("failing now, customers feel it")).toBeVisible();
});
