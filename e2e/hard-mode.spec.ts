import { ACK } from "../packages/engine/src/index";
import { expect, test } from "@playwright/test";
import { INCIDENTS } from "../packages/scenarios/src/registry";

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

// The pinned e2e incident (VITE_PIN_INCIDENT in playwright.config.ts): its first variant is the Slow Leak.
const variant = INCIDENTS.find((i) => i.id === "db-pool-exhaustion")!.variants[0]!;
// The golden player's typed actions, in order. The commands are read from the scenario, never written here.
const steps = variant.golden.perfect.flatMap((r) => {
  const action = variant.scenario.actions.find((a) => a.id === r.actionId);
  return r.actionId === ACK || !action ? [] : [action];
});

// Workstreams A1 and A2 write the `cli` values; the integration step removes this guard.
test.skip(steps.length === 0 || steps.some((a) => !a.cli), "needs M6 content");

test("hard mode: set Hard in Settings, then solve the Slow Leak by typing its commands in the Terminal (M6)", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");

  // Settings → Gameplay → Difficulty → Hard; the choice applies to the next shift.
  await page.getByRole("navigation", { name: "Dock" }).getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("region", { name: "Settings" });
  await settings.getByRole("navigation", { name: "Settings pages" }).getByRole("button", { name: "Gameplay" }).click();
  await settings.getByRole("radiogroup", { name: "Difficulty" }).getByRole("radio", { name: "Hard" }).check();
  await page.getByRole("button", { name: "Close Settings" }).click();

  await page.getByRole("button", { name: "Practice shift" }).first().click();
  await page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" }).click();
  await page.keyboard.press("a");

  // The first ack of a hard shift opens the Terminal, and the dock gains its icon.
  const prompt = page.getByRole("textbox", { name: "Terminal command" });
  await expect(prompt).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Dock" }).getByRole("button", { name: "Terminal" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Incident status:.*hard mode$/ })).toBeVisible();

  for (const action of steps) {
    await prompt.fill(action.cli!);
    await prompt.press("Enter");
    await page.clock.runFor(action.durationS * 1000 + 500);
  }
  const output = page.getByRole("log", { name: "Terminal output" });
  await expect(output).not.toContainText("running…");

  // The fix holds for a countdown, then the cold close leads to the report.
  await page.clock.runFor(11_000);
  await page.clock.runFor(1_600);
  await page.clock.runFor(1_600);
  await expect(page.getByRole("dialog", { name: "Shift report" })).toBeVisible();
});
