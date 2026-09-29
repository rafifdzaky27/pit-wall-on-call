import { serve } from "@hono/node-server";
import pino from "pino";
import postgres from "postgres";
import { createApp } from "./app";
import { createDb } from "./db/client";
import { migrateDb } from "./db/migrate";

/**
 * The API for Playwright (M2 spec §7): a fresh, migrated `pitwall_e2e` database on the dev or CI
 * Postgres, served on 8787 with generous rate limits so parallel specs never trip them.
 */
const adminUrl = process.env.E2E_DATABASE_URL ?? "postgres://pitwall:pitwall@localhost:54329/pitwall";
const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
await admin.unsafe("drop database if exists pitwall_e2e with (force)");
await admin.unsafe("create database pitwall_e2e");
await admin.end();

const url = new URL(adminUrl);
url.pathname = "/pitwall_e2e";
const db = createDb(url.toString());
await migrateDb(db.db);

const plenty = { max: 10_000, windowMs: 60_000 };
/**
 * The server's calendar stands on e2e/day.ts's day (a Slow Leak daily), so the specs play a known incident
 * whichever incident the real date's daily is (M4). The clock still runs.
 */
const E2E_DAY = process.env.E2E_DAY ?? "2026-09-30";
const offset = Date.parse(`${E2E_DAY}T10:00:00Z`) - Date.now();
const app = createApp({
  version: "e2e",
  pingDb: db.ping,
  pendingMigrations: db.pendingMigrations,
  db: db.db,
  logger: pino({ level: "warn" }),
  now: () => Date.now() + offset,
  limits: { runsPerToken: plenty, runsPerIp: plenty, playersPerIp: plenty, renamePerToken: plenty, boardPerIp: plenty },
});
serve({ fetch: app.fetch, port: 8787 }, () => console.log("e2e api listening on 8787"));
