import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

// The e2e web build carries VITE_UMAMI_WEBSITE_ID=e2e-test (playwright.config.ts), so the loader asks for
// /stats/script.js. The stub below stands in for Umami and records every track() call.
const STUB = `window.__umami = [];
window.umami = { track: function (name, props) { window.__umami.push([name, props === undefined ? null : props]); } };`;

test("one scripted shift sends the funnel events to our own origin only (M5)", async ({ page }) => {
  const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:4173").origin;
  const foreign: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(origin) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) foreign.push(r.url());
  });
  let scriptRequests = 0;
  await page.route("**/stats/script.js", (route) => {
    scriptRequests++;
    return route.fulfill({ contentType: "text/javascript", body: STUB });
  });

  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Practice shift" }).click();
  await page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" }).click();
  await page.keyboard.press("a");
  // A quiet spell before acting: the guide's first hint shows.
  await page.clock.runFor(50_000);
  await expect(page.getByText("Guide").first()).toBeVisible();
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
  const report = page.getByRole("dialog", { name: "Shift report" });
  await expect(report).toBeVisible();
  await report.getByRole("button", { name: "Share" }).click();

  const calls = await page.evaluate(() => (window as unknown as { __umami: unknown[] }).__umami);
  expect(calls).toEqual([
    ["shift_start", { incident: "db-pool-exhaustion", mode: "practice", difficulty: "normal" }],
    ["ack", null],
    ["hint_shown", null],
    ["shift_finish", { result: "resolved", incident: "db-pool-exhaustion", mode: "practice", difficulty: "normal" }],
    ["share_click", null],
  ]);
  expect(scriptRequests).toBe(1);
  expect(foreign).toEqual([]);
});
