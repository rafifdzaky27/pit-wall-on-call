import { expect, test } from "@playwright/test";
import { ENGINE_VERSION } from "../packages/engine/src/constants";
import { dailyFor, utcDate } from "../packages/scenarios/src/daily";

const skip = (page: import("@playwright/test").Page) =>
  page.getByRole("group", { name: "Café controls" }).getByRole("button", { name: "Skip to the page" });

interface Entry {
  handle: string;
  budgetBurnedBp: number;
}

test.describe("the runs API contract (M2)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a finished shift is posted, and the debrief's score is the one the server stored", async ({ page, request }) => {
    const handle = `e2e_${Date.now().toString(36).slice(-7)}`;
    await page.clock.install();
    await page.goto("/");
    await page.getByRole("button", { name: "Practice shift" }).click();
    await skip(page).click();
    await page.keyboard.press("a");
    // The ack leaves you on the desktop; its notice points to Monitoring.
    await page.getByRole("button", { name: "Open Monitoring" }).first().click();
    await expect(page.getByRole("region", { name: "Monitoring" })).toBeVisible();
    await page.keyboard.press("2");
    // A fix within 2 s of the page is held for review (spec §8), so look around first, as a person would.
    await page.clock.runFor(3_000);
    // The rollback lives in Deploys (M2.5 plan B4).
    await page.getByRole("navigation", { name: "Open in" }).getByRole("button", { name: "Deploys" }).click();
    await page.getByRole("button", { name: /Roll back to v141/ }).click();
    await page.clock.runFor(31_000);
    await page.clock.runFor(11_000);
    await page.clock.runFor(1_600);
    // The shift report opens 1.5 s after the caption (M2.5 spec §6).
    await page.clock.runFor(1_600);
    await page.getByRole("dialog", { name: "Shift report" }).getByRole("button", { name: "Read the postmortem" }).click();

    const board = page.getByRole("region", { name: "Leaderboard" });
    await expect(board.getByText("Pick a handle to post this shift to the practice leaderboard.")).toBeVisible();
    await board.getByRole("textbox", { name: "Handle" }).fill(handle);
    await board.getByRole("button", { name: "Post score" }).click();
    // A real round trip to the shared e2e API; under a parallel suite it can take longer than 5 s.
    await expect(board.getByText(/^New best: #\d+ of \d+ on the practice leaderboard\.$/)).toBeVisible({ timeout: 15_000 });

    const shown = await page.getByRole("list", { name: "Score" }).locator(".tile", { hasText: "Error budget burned" }).locator(".tile-v").textContent();
    const res = await request.get("/api/leaderboard?scenario=db-pool-exhaustion");
    expect(res.ok()).toBe(true);
    const stored = ((await res.json()) as { entries: Entry[] }).entries.find((e) => e.handle === handle);
    expect(stored, "the posted shift is on the board").toBeDefined();
    expect(`${(stored!.budgetBurnedBp / 100).toFixed(1)}%`).toBe(shown);

    await board.getByRole("button", { name: "View leaderboard" }).click();
    await expect(page.getByRole("tab", { name: "Leaderboard · Pit Wall On-Call", selected: true })).toBeVisible();
    // Today's daily leads; this was a practice shift, so it is on the second tab (M3 spec Y11).
    await page.getByRole("tablist", { name: "Boards" }).getByRole("tab", { name: "Practice" }).click();
    await expect(page.getByRole("table", { name: "Practice leaderboard" }).getByText(`${handle}#`, { exact: false })).toBeVisible();
    await expect(page.getByRole("table", { name: "Practice leaderboard" }).locator(".lb-you")).toContainText("(you)");
  });

  test("below 1024 px, the lock screen shows today's daily board", async ({ page, request }) => {
    // One ranked daily, so the board has a table: the golden perfect player's actions on today's daily.
    const today = dailyFor(utcDate(Date.now()));
    const player = await (await request.post("/api/players", { data: { handle: "phone_seed" } })).json();
    const actions = [
      { tick: 0, actionId: "inspect:laptop.slack.deploys" },
      { tick: 20, actionId: "ack" },
      { tick: 20, actionId: "checkout.pool_stats" },
      { tick: 60, actionId: "checkout.deploys" },
      { tick: 90, actionId: "checkout.rollback" },
    ];
    const posted = await request.post("/api/runs", {
      headers: { authorization: `Bearer ${player.token}` },
      data: { scenarioId: today.scenarioId, seed: today.seed, mode: "daily", dailyDate: today.date, engineVersion: ENGINE_VERSION, runKey: crypto.randomUUID(), actions },
    });
    expect(posted.status()).toBe(201);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: `Daily #${today.number}` })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
    // The table fits too, so the Result column is not hidden behind a sideways scroll (walkthrough W1).
    const wrap = page.locator(".lb-table-wrap");
    await expect(page.getByRole("columnheader", { name: "Result" })).toBeVisible();
    expect(await wrap.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
