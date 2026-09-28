import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client";

/** `drizzle/` sits next to `dist/` in the image and two levels up from `src/db/` in the repo. */
function migrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, "../drizzle"), resolve(here, "../../drizzle")];
  const found = candidates.find((dir) => existsSync(resolve(dir, "meta/_journal.json")));
  if (!found) throw new Error(`migrations folder not found (looked in ${candidates.join(", ")})`);
  return found;
}

export async function migrateDb(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: migrationsFolder() });
}
