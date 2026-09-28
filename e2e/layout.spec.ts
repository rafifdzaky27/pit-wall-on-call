import { expect, test } from "@playwright/test";

// Laptop viewports with and without browser chrome (polish spec S23, walkthrough finding 1).
const VIEWPORTS = [
  [1366, 657],
  [1366, 768],
  [1440, 789],
  [1440, 900],
  [1866, 882],
  [1920, 1080],
] as const;

for (const [width, height] of VIEWPORTS) {
  test(`the service map shows every node whole at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.getByRole("button", { name: "Start shift" }).click();
    await page.getByRole("button", { name: "Skip to the page" }).click();
    await page.keyboard.press("a");
    // Measure after the window's open motion settles (looping CSS animations never finish).
    await page.waitForFunction(() => document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity));
    const panel = page.locator(".map-panel");
    await expect(panel).toBeVisible();
    const box = (await page.locator(".map").boundingBox())!;
    const outer = (await panel.boundingBox())!;
    expect(box.height).toBeGreaterThan(120);
    expect(box.y + box.height).toBeLessThanOrEqual(outer.y + outer.height + 1);
    const nodes = await page.locator(".map .node").all();
    expect(nodes).toHaveLength(4);
    const rects = [];
    for (const node of nodes) {
      const r = (await node.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(r.y).toBeGreaterThanOrEqual(box.y - 1);
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height + 1);
      rects.push(r);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap, `nodes ${i} and ${j} overlap`).toBe(false);
      }
    }
    const spark = (await page.locator(".spark").first().boundingBox())!;
    expect(spark.height).toBeGreaterThanOrEqual(24);
  });
}
