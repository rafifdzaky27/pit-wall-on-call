import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { createDb, type Db } from "./client";
import { migrateDb } from "./migrate";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://pitwall:pitwall@localhost:54329/pitwall";

export interface TestDatabase {
  url: string;
  db: Db;
  sql: postgres.Sql;
  drop: () => Promise<void>;
}

/** A throw-away database per test file, so files can run in parallel against one Postgres. */
export async function testDatabase({ migrate = true }: { migrate?: boolean } = {}): Promise<TestDatabase> {
  const admin = postgres(TEST_DATABASE_URL, { max: 1, connect_timeout: 5, onnotice: () => {} });
  const name = `t_${randomBytes(6).toString("hex")}`;
  try {
    await admin.unsafe(`create database ${name}`);
  } catch (error) {
    await admin.end();
    const code = (error as { code?: string }).code;
    if (code === "ECONNREFUSED" || code === "CONNECT_TIMEOUT") {
      throw new Error(`Postgres is not reachable at ${new URL(TEST_DATABASE_URL).host}. Run pnpm db:up.`, { cause: error });
    }
    throw error;
  }
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  const conn = createDb(url.toString());
  if (migrate) await migrateDb(conn.db);
  return {
    url: url.toString(),
    db: conn.db,
    sql: conn.sql,
    drop: async () => {
      await conn.close();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}
