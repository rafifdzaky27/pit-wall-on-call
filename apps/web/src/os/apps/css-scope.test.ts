import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// App stylesheets load with their lazy chunk but then apply to the whole page, so a class an app
// defines must not be one that another part of PitOS uses (a bare `.msg` in Chat broke the
// Monitoring log lines once Chat had been opened).
const SRC = resolve(__dirname, "../..");
const APPS = resolve(__dirname);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

const sources = walk(SRC).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"));
const stylesheets = walk(APPS).filter((f) => f.endsWith(".css"));

function definedClasses(css: string): Set<string> {
  const out = new Set<string>();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(?:^|[,{}]\s*)\.([a-z][\w-]*)/gm)) out.add(m[1]!);
  return out;
}

/** Class tokens a component sets: the words inside its className="…" and className={…} expressions. */
function classTokens(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)) {
    const expr = m[1] ?? m[2] ?? "";
    for (const lit of expr.matchAll(/["'`]([^"'`]*)["'`]/g)) for (const t of lit[1]!.split(/[\s$]+/)) if (t) out.add(t);
    if (m[1]) for (const t of m[1].split(/\s+/)) if (t) out.add(t);
  }
  return out;
}

describe("app stylesheets", () => {
  it.each(stylesheets.map((f) => [relative(APPS, f), f]))("%s only defines classes its own app uses", (_name, file) => {
    const appDir = resolve(file, "..");
    const clashes: string[] = [];
    for (const cls of definedClasses(readFileSync(file, "utf8"))) {
      for (const src of sources) {
        if (src.startsWith(appDir)) continue;
        if (classTokens(readFileSync(src, "utf8")).has(cls)) clashes.push(`.${cls} in ${relative(SRC, src)}`);
      }
    }
    expect(clashes).toEqual([]);
  });
});
