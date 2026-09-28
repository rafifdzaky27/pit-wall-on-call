import { serve } from "@hono/node-server";
import pino from "pino";
import { createApp } from "./app";
import { parseConfig, type Config } from "./config";
import { createDb } from "./db/client";
import { createMetrics } from "./http/metrics";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", base: undefined });

let config: Config;
try {
  config = parseConfig(process.env);
} catch (error) {
  logger.error({ error: (error as Error).message }, "invalid configuration");
  process.exit(1);
}

const db = createDb(config.databaseUrl);
const app = createApp({
  version: config.version,
  pingDb: db.ping,
  pendingMigrations: db.pendingMigrations,
  db: db.db,
  logger,
  metrics: createMetrics({ defaults: true }),
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info({ port: info.port, version: config.version }, "api listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  server.close(() => {
    void db.close().finally(() => process.exit(0));
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
