import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { parseConfig, type Config } from "./config";
import { createDb } from "./db";

function log(level: "info" | "error", msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, msg, time: new Date().toISOString(), ...extra }));
}

let config: Config;
try {
  config = parseConfig(process.env);
} catch (error) {
  log("error", "invalid configuration", { error: (error as Error).message });
  process.exit(1);
}

const db = createDb(config.databaseUrl);
const app = createApp({ version: config.version, pingDb: db.ping });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  log("info", "api listening", { port: info.port, version: config.version });
});

function shutdown(signal: string) {
  log("info", "shutting down", { signal });
  server.close(() => {
    void db.sql.end({ timeout: 5 }).finally(() => process.exit(0));
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
