import { createDb } from "./db/client";
import { migrateDb } from "./db/migrate";

/** One-shot migration, run by deploy.sh before the new API starts (M2 spec L8). */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error(JSON.stringify({ level: "error", msg: "DATABASE_URL is required" }));
  process.exit(1);
}
const conn = createDb(url, { max: 1 });
try {
  const before = await conn.pendingMigrations();
  await migrateDb(conn.db);
  console.log(JSON.stringify({ level: "info", msg: "migrations applied", applied: before }));
} catch (error) {
  console.error(JSON.stringify({ level: "error", msg: "migration failed", error: (error as Error).message }));
  process.exitCode = 1;
} finally {
  await conn.close();
}
