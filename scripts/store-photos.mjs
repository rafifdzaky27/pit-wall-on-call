// Downloads the store photos listed in apps/web/src/content/store-photos.json as WebP, sized for
// their slot, and writes CREDITS.md. Photos are under the Unsplash License (see NOTICE.md).
// Usage: node scripts/store-photos.mjs
/* global Buffer, console, fetch */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const photos = JSON.parse(readFileSync("apps/web/src/content/store-photos.json", "utf8"));
const out = "apps/web/public/store";
mkdirSync(out, { recursive: true });

const credits = [
  "# Store photo credits",
  "",
  "Photos from [Unsplash](https://unsplash.com), used under the [Unsplash License](https://unsplash.com/license).",
  "They are not covered by the AGPL or by the content-reserved clause in NOTICE.md.",
  "",
  "| File | Photographer | Source |",
  "|---|---|---|",
];
for (const p of photos) {
  // Detailed images (batik, markets) need a lower quality to stay in budget: step down until they fit.
  const size = p.kind === "banner" ? "w=960&h=320" : "w=480&h=480";
  let bytes = null;
  for (const q of [70, 60, 50, 42, 35]) {
    const res = await fetch(`https://images.unsplash.com/${p.src}?${size}&q=${q}&fit=crop&crop=entropy&fm=webp`);
    if (!res.ok) throw new Error(`${p.file}: HTTP ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length <= 90_000) break;
  }
  if (bytes.length > 90_000) throw new Error(`${p.file}: ${bytes.length} bytes is over the 90 kB budget`);
  writeFileSync(`${out}/${p.file}.webp`, bytes);
  credits.push(`| \`${p.file}.webp\` | ${p.by} | https://unsplash.com/photos/${p.id} |`);
  console.log(`${p.file}.webp ${Math.round(bytes.length / 1024)} kB`);
}
writeFileSync(`${out}/CREDITS.md`, credits.join("\n") + "\n");
