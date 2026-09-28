// Renders the 1200×630 social preview (apps/web/public/og.png) with headless Chromium.
// Run: node scripts/og-image.mjs   (after `pnpm exec playwright install chromium`)
/* global document, console */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const font = (weight) =>
  readFileSync(resolve(root, `apps/web/node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-${weight}-normal.woff2`)).toString("base64");
const favicon = readFileSync(resolve(root, "apps/web/public/favicon.svg"), "utf8");

const html = `<!doctype html><html><head><style>
@font-face { font-family: Plex; font-weight: 400; src: url(data:font/woff2;base64,${font(400)}) format("woff2"); }
@font-face { font-family: Plex; font-weight: 600; src: url(data:font/woff2;base64,${font(600)}) format("woff2"); }
html, body { margin: 0; }
body { width: 1200px; height: 630px; background: #111217; color: #d8dee9; font-family: Plex; display: grid; place-content: center; gap: 28px; padding: 0 96px; box-sizing: border-box; }
.row { display: flex; align-items: center; gap: 28px; }
.row svg { width: 120px; height: 120px; }
h1 { font-size: 76px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
p { font-size: 32px; margin: 0; color: #8e97a5; max-width: 900px; line-height: 1.35; }
.tag { display: inline-block; font-size: 22px; font-weight: 600; color: #f2495c; background: rgba(242,73,92,.12); padding: 4px 12px; border-radius: 6px; letter-spacing: .04em; }
</style></head><body>
<div class="row">${favicon}<h1>Pit Wall On-Call</h1></div>
<p>The pager goes off. Checkout is failing. Find the cause before the error budget runs out.</p>
<div><span class="tag">SEV2 · CHECKOUT RETURNING 5XX</span></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: resolve(root, "apps/web/public/og.png") });
await browser.close();
console.log("wrote apps/web/public/og.png");
