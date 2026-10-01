import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "./os/prefs";

const web = (path: string) => resolve(process.cwd(), path);
const html = readFileSync(web("index.html"), "utf8");

/** The before-launch checks that a file can answer (M5 launch check, docs/plans/2026-10-01-m5-launch-check.md). */
describe("launch files", () => {
  it("robots.txt allows everything and claims no sitemap", () => {
    const robots = readFileSync(web("public/robots.txt"), "utf8");
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow: ./m);
    expect(robots.toLowerCase()).not.toContain("sitemap");
  });

  it("the favicon and the Open Graph image exist and are referenced", () => {
    expect(html).toContain('<link rel="icon" href="/favicon.svg"');
    expect(existsSync(web("public/favicon.svg"))).toBe(true);
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/[^"]+\/og\.png" \/>/);
    expect(existsSync(web("public/og.png"))).toBe(true);
  });

  it("the title is the product name, and the Open Graph title agrees", () => {
    expect(html).toContain("<title>Pit Wall On-Call</title>");
    expect(html).toContain('<meta property="og:title" content="Pit Wall On-Call" />');
  });

  it("the sticky note does not send a first-time player somewhere other than the shift notice's one call to action", () => {
    expect(DEFAULT_PREFS.sticky).not.toMatch(/start here/i);
  });
});
