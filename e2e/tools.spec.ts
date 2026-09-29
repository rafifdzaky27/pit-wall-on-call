import { expect, test, type Page } from "@playwright/test";

// Reduced motion: page.clock freezes CSS transitions mid-way, and a dock icon's hover lift would never settle.
test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

/** The dock hides under a maximized window and shows itself to the keyboard, as it does for Tab. */
async function fromDock(page: Page, name: RegExp | string) {
  await page.getByRole("navigation", { name: "Dock" }).getByRole("button", { name }).focus();
  await page.keyboard.press("Enter");
}

test("a shift worked the way an SRE would: ask, post a status, roll back in Deploys, close in Incident (M2.5 plan B)", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Practice shift" }).click();
  await page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" }).click();
  await page.keyboard.press("a");
  // The ack leaves you on the desktop; its notice points to Monitoring.
  await page.getByRole("button", { name: "Open Monitoring" }).first().click();
  await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();

  // Ask the deployer from a suggested question; they answer a while later.
  await fromDock(page, /^Chat/);
  const chat = page.getByRole("region", { name: "Chat" });
  await chat.getByRole("button", { name: /, away/ }).click();
  await chat.getByRole("group", { name: "Suggested questions" }).getByRole("button", { name: "hey, what went out in checkout today?" }).click();
  await expect(chat.getByText("hey, what went out in checkout today?").first()).toBeVisible();
  await page.clock.runFor(31_000);
  await expect(chat.getByText(/^v142, the checkout refactor/)).toBeVisible();

  // A status update in your own words, from the composer.
  await chat.getByRole("button", { name: /^# incidents/ }).click();
  const composer = chat.getByRole("textbox", { name: "Message # incidents" });
  await composer.fill("/status Some payments are failing. We are on it.");
  await composer.press("Enter");
  await expect(chat.getByText("Status update: Some payments are failing. We are on it.")).toBeVisible();
  await page.clock.runFor(6_000);

  // The rollback lives in Deploys, next to the version history.
  await fromDock(page, "Deploys");
  const deploys = page.getByRole("region", { name: "Deploys" });
  const checkout = deploys.getByRole("region", { name: "checkout-api" });
  await expect(checkout.getByRole("list", { name: "Deploy history" })).toContainText("v142");
  await checkout.getByRole("button", { name: /Roll back to v141/ }).click();
  await page.clock.runFor(31_000);
  await expect(checkout.getByText("v141 · 3 pods")).toBeVisible();

  // The status chip opens Incident; it shows the fix holding, then resolved, with the whole timeline.
  await page.getByRole("button", { name: /^Incident status/ }).click();
  const incident = page.getByRole("region", { name: "Incident" });
  await expect(incident.getByText(/^Fix holding/)).toBeVisible();
  await page.clock.runFor(11_000);
  await expect(incident.getByText("Resolved", { exact: true }).first()).toBeVisible();
  await expect(incident.getByRole("list", { name: "Timeline" })).toContainText("Done: Roll back to v141");
  await expect(incident.getByRole("list", { name: "Timeline" })).toContainText("Done: Post status update");
});
