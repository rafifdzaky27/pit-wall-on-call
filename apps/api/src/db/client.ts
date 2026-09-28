import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import journal from "../../drizzle/meta/_journal.json";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(databaseUrl: string, { max = 5 }: { max?: number } = {}) {
  const sql = postgres(databaseUrl, { max, connect_timeout: 5, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  return {
    sql,
    db,
    ping: async () => {
      await sql`select 1`;
    },
    /** Bundled migrations not yet applied; /readyz is not ready until this is 0 (M2 spec §3). */
    pendingMigrations: async (): Promise<number> => {
      const [row] = await sql<{ table: string | null }[]>`select to_regclass('drizzle.__drizzle_migrations')::text as table`;
      if (!row?.table) return journal.entries.length;
      const [applied] = await sql<{ count: number }[]>`select count(*)::int as count from drizzle.__drizzle_migrations`;
      return Math.max(0, journal.entries.length - (applied?.count ?? 0));
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
