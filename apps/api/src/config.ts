export interface Config {
  databaseUrl: string;
  port: number;
  version: string;
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const invalid = new Error(
    "DATABASE_URL is not a valid URL (URL-encode special characters in the password, or use a hex password)",
  );
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
    // An unencoded "/" or "#" can still parse, but as host:port with no password.
    if (!parsed.username || !parsed.password) throw invalid;
    // postgres.js decodes the password; malformed %-escapes would crash it at connect time.
    decodeURIComponent(parsed.password);
  } catch {
    throw invalid;
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres:// scheme");
  }

  const rawPort = env.PORT ?? "8787";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${rawPort}"`);
  }

  return { databaseUrl, port, version: env.GIT_SHA || "dev" };
}
