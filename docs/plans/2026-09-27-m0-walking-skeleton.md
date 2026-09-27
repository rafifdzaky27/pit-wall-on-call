# M0 Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a "hello" web page and an API with health endpoints to `https://pitwall.rafifdzaky.com` through the complete CI/CD path (PR checks → GHCR images → Tailscale SSH deploy → smoke test → auto-rollback), before any game features exist.

**Architecture:** A pnpm TypeScript monorepo with `apps/api` (Hono on Node, bundled into one file with tsup) and `apps/web` (Vite + React). The web image is Caddy serving the static build and reverse-proxying `/api/*` to the api container. Docker Compose on a homelab Proxmox VM runs postgres, api, web and cloudflared (outbound tunnel, no inbound ports). GitHub Actions builds SHA-tagged images and runs `infra/deploy.sh <sha>` over Tailscale SSH.

**Tech Stack:** Node 22, pnpm (pinned via Corepack), TypeScript (strict), Hono + @hono/node-server, postgres (porsager) driver, tsup, Vite + React, Vitest + Testing Library (jsdom), ESLint + typescript-eslint, Docker + Compose, Caddy 2, Postgres 17, cloudflared, GitHub Actions, Tailscale.

**Spec:** `docs/specs/2026-09-27-pit-wall-on-call-design.md` (sections 4, 10, 15). Roadmap: `docs/plans/2026-09-27-roadmap.md`.

## Global Constraints

- Node **22** (`.nvmrc`), pnpm pinned through the `packageManager` field (set by `corepack use pnpm@latest`).
- TypeScript `strict: true` and `noUncheckedIndexedAccess: true` in every package.
- Package names use the `@pitwall/*` scope. Image names are `ghcr.io/<owner>/pitwall-api` and `ghcr.io/<owner>/pitwall-web`, tagged with the **full git SHA**, and the owner must be lowercase.
- **Public routes live under `/api/*` only.** Ops routes (`/healthz`, `/readyz`, and `/metrics` from M2) are served by the api container at its root and are **never proxied by Caddy**. This refines spec section 8, which lists `/healthz` without saying whether it is public. Ops endpoints must not be internet-facing.
- No inbound ports on the homelab VM. Public traffic enters only through cloudflared.
- **Never** use a self-hosted GitHub runner on the homelab (spec section 10).
- Secrets live only in `/opt/pitwall/.env` on the host (mode 600) and in GitHub secrets. Never commit them.
- Commit messages and PR descriptions carry **no AI attribution trailers**.

## Review Focus

1. **The database hangs instead of refusing** (for example, a VM network blip). `/readyz` must answer `503` within about 2 s rather than hang the smoke test. → Test in Task 1.
2. **`POSTGRES_PASSWORD` contains URL-special characters** (`#`, `/`, `@`) and silently corrupts `DATABASE_URL`. The API must fail fast at startup with a message that names the fix. → Test in Task 1. The runbook also generates a hex password.
3. **The API is down, or `/api` is misrouted to the SPA** (Caddy returns `index.html` with a 200). The web page must show "API unreachable" rather than a spinner forever or a crash. → Tests in Task 2.
4. **A deep-link refresh** (`/daily`) must serve the SPA, while an **unknown `/api/*` path** must *not* return `index.html`. → Verification in Task 3.
5. **Deploying a SHA whose image doesn't exist, and the very first deploy failing.** The pull must fail before anything changes, `.env` must keep the old tag, and a first deploy with no previous tag must exit non-zero rather than loop. → Built into `deploy.sh` in Task 5 and exercised by the drill in Task 6.

---

### Task 1: Workspace foundation + API health service

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.gitignore`, `.gitattributes`, `.editorconfig`, `.nvmrc`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsup.config.ts`
- Create: `apps/api/src/config.ts`, `apps/api/src/app.ts`, `apps/api/src/db.ts`, `apps/api/src/server.ts`
- Test: `apps/api/src/config.test.ts`, `apps/api/src/app.test.ts`

**Interfaces:**
- Produces: `createApp(deps: AppDeps): Hono` where `AppDeps = { version: string; pingDb: () => Promise<void>; readinessTimeoutMs?: number }`
- Produces: `parseConfig(env: Record<string, string | undefined>): Config` where `Config = { databaseUrl: string; port: number; version: string }`
- Produces HTTP: `GET /healthz → 200 {"status":"ok"}`, `GET /readyz → 200 {"status":"ready"} | 503 {"status":"not_ready","reason":"database_unreachable"}`, `GET /api/version → 200 {"version": string}`
- Produces: the build output `apps/api/dist/server.js` (single self-contained ESM file)

- [ ] **Step 1: Create root workspace files**

`.nvmrc`:
```
22
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`package.json`:
```json
{
  "name": "pit-wall-on-call",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build": "pnpm -r build"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

`eslint.config.js`:
```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
```

`.gitignore`:
```
node_modules/
dist/
coverage/
*.log
.env
.env.*
!infra/local.env
```

`.gitattributes` (stops Windows CRLF churn; shell scripts must stay LF or they break on Linux):
```
* text=auto eol=lf
*.sh text eol=lf
```

`.editorconfig`:
```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 2: Pin pnpm and install root dev dependencies**

Run:
```bash
corepack enable
corepack use pnpm@latest
pnpm add -Dw typescript eslint @eslint/js typescript-eslint
```
Expected: `package.json` gains `"packageManager": "pnpm@<version>+sha512..."` and the devDependencies, and `pnpm-lock.yaml` is created.

- [ ] **Step 3: Create the api package skeleton**

`apps/api/package.json`:
```json
{
  "name": "@pitwall/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "start": "node dist/server.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "tsup.config.ts"]
}
```

`apps/api/tsup.config.ts` (bundles all dependencies into one file so the runtime image needs no `node_modules`; the banner restores `require` for any CommonJS dependency bundled into ESM):
```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  clean: true,
  noExternal: [/.*/],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
```

Run:
```bash
pnpm --filter @pitwall/api add hono @hono/node-server postgres
pnpm --filter @pitwall/api add -D vitest tsup tsx @types/node
```

- [ ] **Step 4: Write the failing config tests**

`apps/api/src/config.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

const validUrl = "postgres://pitwall:0123abcd@postgres:5432/pitwall";

describe("parseConfig", () => {
  it("parses a valid environment with defaults", () => {
    expect(parseConfig({ DATABASE_URL: validUrl })).toEqual({
      databaseUrl: validUrl,
      port: 8787,
      version: "dev",
    });
  });

  it("uses PORT and GIT_SHA when provided", () => {
    const config = parseConfig({ DATABASE_URL: validUrl, PORT: "9000", GIT_SHA: "abc123" });
    expect(config.port).toBe(9000);
    expect(config.version).toBe("abc123");
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseConfig({})).toThrow("DATABASE_URL is required");
  });

  it("rejects a password with unencoded special characters", () => {
    expect(() =>
      parseConfig({ DATABASE_URL: "postgres://pitwall:ab#cd@postgres:5432/pitwall" }),
    ).toThrow(/not a valid URL/);
  });

  it("rejects a non-postgres scheme", () => {
    expect(() => parseConfig({ DATABASE_URL: "mysql://u:p@db:3306/x" })).toThrow(
      /postgres:\/\//,
    );
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => parseConfig({ DATABASE_URL: validUrl, PORT: "eighty" })).toThrow(/PORT/);
  });
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `pnpm --filter @pitwall/api test`
Expected: FAIL with `Failed to resolve import "./config"`.

- [ ] **Step 6: Implement `config.ts`**

`apps/api/src/config.ts`:
```ts
export interface Config {
  databaseUrl: string;
  port: number;
  version: string;
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid URL (URL-encode special characters in the password, or use a hex password)",
    );
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
```

- [ ] **Step 7: Write the failing app tests**

`apps/api/src/app.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

const dbUp = async () => {};
const dbDown = async () => {
  throw new Error("connection refused");
};
const dbHangs = () => new Promise<void>(() => {});

describe("GET /healthz", () => {
  it("returns ok even when the database is down", async () => {
    const app = createApp({ version: "abc123", pingDb: dbDown });
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /readyz", () => {
  it("returns ready when the database answers", async () => {
    const app = createApp({ version: "abc123", pingDb: dbUp });
    const res = await app.request("/readyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ready" });
  });

  it("returns 503 when the database errors", async () => {
    const app = createApp({ version: "abc123", pingDb: dbDown });
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "not_ready", reason: "database_unreachable" });
  });

  it("returns 503 within the timeout when the database hangs", async () => {
    const app = createApp({ version: "abc123", pingDb: dbHangs, readinessTimeoutMs: 50 });
    const started = Date.now();
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("GET /api/version", () => {
  it("returns the deployed version", async () => {
    const app = createApp({ version: "abc123", pingDb: dbUp });
    const res = await app.request("/api/version");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: "abc123" });
  });
});
```

- [ ] **Step 8: Run it and confirm it fails**

Run: `pnpm --filter @pitwall/api test`
Expected: FAIL with `Failed to resolve import "./app"`. The config tests pass.

- [ ] **Step 9: Implement `app.ts`**

`apps/api/src/app.ts`:
```ts
import { Hono } from "hono";

export interface AppDeps {
  version: string;
  pingDb: () => Promise<void>;
  readinessTimeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createApp({ version, pingDb, readinessTimeoutMs = 2000 }: AppDeps) {
  const app = new Hono();

  // Ops endpoints: reachable inside the compose network only (Caddy proxies /api/* alone).
  app.get("/healthz", (c) => c.json({ status: "ok" }));

  app.get("/readyz", async (c) => {
    try {
      await withTimeout(pingDb(), readinessTimeoutMs);
      return c.json({ status: "ready" });
    } catch {
      return c.json({ status: "not_ready", reason: "database_unreachable" }, 503);
    }
  });

  app.get("/api/version", (c) => c.json({ version }));

  return app;
}
```

- [ ] **Step 10: Run the tests and confirm they pass**

Run: `pnpm --filter @pitwall/api test`
Expected: PASS, 11 tests.

- [ ] **Step 11: Implement `db.ts` and `server.ts` (wiring only, covered by the Task 3 container check)**

`apps/api/src/db.ts`:
```ts
import postgres from "postgres";

export function createDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 5, connect_timeout: 5 });
  return {
    sql,
    ping: async () => {
      await sql`select 1`;
    },
  };
}
```

`apps/api/src/server.ts`:
```ts
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
```

- [ ] **Step 12: Verify lint, typecheck and build**

Run:
```bash
pnpm lint
pnpm typecheck
pnpm --filter @pitwall/api build
```
Expected: no lint or type errors, and `apps/api/dist/server.js` exists.

- [ ] **Step 13: Commit**

```bash
git add .
git commit -m "feat(api): scaffold workspace and api health endpoints"
```

---

### Task 2: Web hello page with API status

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/api.ts`, `apps/web/src/vite-env.d.ts`
- Test: `apps/web/src/App.test.tsx`, `apps/web/src/api.test.ts`

**Interfaces:**
- Consumes: `GET /api/version → {"version": string}` (Task 1)
- Produces: `fetchApiVersion(): Promise<string>`, which rejects on a non-2xx status, a non-JSON body or a missing `version`
- Produces: `App` component with prop `fetchVersion?: () => Promise<string>`
- Produces: the build output `apps/web/dist/`, with the build-time env `VITE_GIT_SHA`

- [ ] **Step 1: Create the web package skeleton**

`apps/web/package.json`:
```json
{
  "name": "@pitwall/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`apps/web/vite.config.ts`:
```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
  test: {
    environment: "jsdom",
  },
});
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pit Wall On-Call</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GIT_SHA?: string;
}
```

Run:
```bash
pnpm --filter @pitwall/web add react react-dom
pnpm --filter @pitwall/web add -D vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/dom @types/react @types/react-dom
```

- [ ] **Step 2: Write the failing tests**

`apps/web/src/api.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchApiVersion } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("fetchApiVersion", () => {
  it("returns the version from a healthy API", async () => {
    stubFetch(Response.json({ version: "abc1234" }));
    await expect(fetchApiVersion()).resolves.toBe("abc1234");
  });

  it("rejects on a non-2xx status such as a Caddy 502", async () => {
    stubFetch(new Response("bad gateway", { status: 502 }));
    await expect(fetchApiVersion()).rejects.toThrow("HTTP 502");
  });

  it("rejects when /api is misrouted to the SPA and returns HTML", async () => {
    stubFetch(new Response("<!doctype html><html></html>", { status: 200 }));
    await expect(fetchApiVersion()).rejects.toThrow();
  });

  it("rejects when the JSON has no version", async () => {
    stubFetch(Response.json({ status: "ok" }));
    await expect(fetchApiVersion()).rejects.toThrow("unexpected response");
  });
});
```

`apps/web/src/App.test.tsx`:
```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

describe("App", () => {
  it("shows the API version when the API is up", async () => {
    render(<App fetchVersion={async () => "abc1234"} />);
    expect(await screen.findByText("API online · abc1234")).toBeTruthy();
  });

  it("shows unreachable when the API call fails", async () => {
    render(
      <App
        fetchVersion={async () => {
          throw new Error("HTTP 502");
        }}
      />,
    );
    expect(await screen.findByText("API unreachable")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `pnpm --filter @pitwall/web test`
Expected: FAIL with `Failed to resolve import "./api"` and `"./App"`.

- [ ] **Step 4: Implement `api.ts`, `App.tsx` and `main.tsx`**

`apps/web/src/api.ts`:
```ts
export async function fetchApiVersion(): Promise<string> {
  const res = await fetch("/api/version");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body: unknown = await res.json();
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { version?: unknown }).version !== "string"
  ) {
    throw new Error("unexpected response");
  }
  return (body as { version: string }).version;
}
```

`apps/web/src/App.tsx`:
```tsx
import { useEffect, useState } from "react";
import { fetchApiVersion } from "./api";

type ApiStatus =
  | { state: "checking" }
  | { state: "online"; version: string }
  | { state: "unreachable" };

export function App({ fetchVersion = fetchApiVersion }: { fetchVersion?: () => Promise<string> }) {
  const [status, setStatus] = useState<ApiStatus>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    fetchVersion().then(
      (version) => {
        if (!cancelled) setStatus({ state: "online", version });
      },
      () => {
        if (!cancelled) setStatus({ state: "unreachable" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchVersion]);

  const apiLine =
    status.state === "checking"
      ? "Checking API…"
      : status.state === "online"
        ? `API online · ${status.version}`
        : "API unreachable";

  return (
    <main>
      <h1>Pit Wall On-Call</h1>
      <p>Pit lane open. The first incident is on its way.</p>
      <p>{apiLine}</p>
      <p>Web build · {import.meta.env.VITE_GIT_SHA ?? "dev"}</p>
    </main>
  );
}
```

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @pitwall/web test`
Expected: PASS, 6 tests.

- [ ] **Step 6: Verify the whole workspace**

Run:
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
Expected: all green, and `apps/web/dist/index.html` exists.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat(web): hello page showing API status and build version"
```

---

### Task 3: Container images + local compose stack

**Files:**
- Create: `.dockerignore`, `apps/api/Dockerfile`, `apps/web/Dockerfile`
- Create: `infra/Caddyfile`, `infra/docker-compose.yml`, `infra/docker-compose.local.yml`, `infra/local.env`

**Interfaces:**
- Consumes: `apps/api/dist/server.js` (Task 1) and `apps/web/dist/` (Task 2)
- Produces: images whose api listens on `8787` and whose web (Caddy) listens on `80`
- Produces: compose services `postgres`, `api`, `web`, and `cloudflared` (profile `tunnel`). Compose variables: `GHCR_OWNER`, `TAG`, `POSTGRES_PASSWORD`, `TUNNEL_TOKEN`, `COMPOSE_PROFILES`

- [ ] **Step 1: Write `.dockerignore`**

```
**/node_modules
**/dist
**/coverage
.git
docs
infra/*.env
!infra/local.env
```

- [ ] **Step 2: Write the api Dockerfile**

`apps/api/Dockerfile` (build context = repo root; `pnpm fetch` needs only the lockfile, so the dependency layer caches across source changes):
```dockerfile
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm --filter @pitwall/api build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 8787
CMD ["node", "dist/server.js"]
```

- [ ] **Step 3: Write the Caddyfile and web Dockerfile**

`infra/Caddyfile` (TLS terminates at Cloudflare, so Caddy serves plain HTTP inside the network):
```
{
	auto_https off
	admin off
}

:80 {
	encode zstd gzip

	handle /api/* {
		reverse_proxy api:8787
	}

	handle {
		root * /srv
		header /assets/* Cache-Control "public, max-age=31536000, immutable"
		header /index.html Cache-Control "no-cache"
		try_files {path} /index.html
		file_server
	}
}
```

`apps/web/Dockerfile`:
```dockerfile
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
ARG GIT_SHA=dev
ENV VITE_GIT_SHA=$GIT_SHA
RUN pnpm --filter @pitwall/web build

FROM caddy:2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
```

- [ ] **Step 4: Write the compose files**

`infra/docker-compose.yml`:
```yaml
name: pitwall

services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: pitwall
      POSTGRES_USER: pitwall
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pitwall -d pitwall"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    image: ghcr.io/${GHCR_OWNER:?set GHCR_OWNER in .env}/pitwall-api:${TAG:?set TAG}
    restart: unless-stopped
    environment:
      DATABASE_URL: postgres://pitwall:${POSTGRES_PASSWORD}@postgres:5432/pitwall
      GIT_SHA: ${TAG}
    depends_on:
      postgres:
        condition: service_healthy

  web:
    image: ghcr.io/${GHCR_OWNER}/pitwall-web:${TAG}
    restart: unless-stopped
    depends_on:
      - api

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN:-}
    depends_on:
      - web
    profiles: ["tunnel"]

volumes:
  pgdata:
```

`infra/docker-compose.local.yml` (local override: build from source and expose web on 8080):
```yaml
services:
  api:
    image: pitwall-api:local
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
  web:
    image: pitwall-web:local
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
      args:
        GIT_SHA: local
    ports:
      - "8080:80"
```

`infra/local.env` (non-secret development values, committed on purpose):
```
GHCR_OWNER=local
TAG=local
POSTGRES_PASSWORD=devpassword
```

- [ ] **Step 5: Build and start the stack locally**

Run (from the repo root):
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.local.yml --env-file infra/local.env up -d --build
```
Expected: `postgres`, `api` and `web` are running, and `cloudflared` is not started because its profile is inactive.

- [ ] **Step 6: Verify the Review Focus behaviours against the running stack**

Run each and check the expected output:
```bash
curl -s http://localhost:8080/api/version
```
Expected: `{"version":"local"}`

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8080/daily
```
Expected: `200 text/html...` (a deep link serves the SPA)

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8080/api/does-not-exist
```
Expected: `404 text/plain...`. It must **not** be `text/html`, which would mean the API was misrouted to the SPA.

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8080/healthz
```
Expected: `200 text/html...` from the SPA fallback. The API's `/healthz` is **not** publicly reachable.

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.local.yml --env-file infra/local.env exec -T api wget -qO- http://127.0.0.1:8787/readyz
```
Expected: `{"status":"ready"}`

Open `http://localhost:8080` in the browser. Expected: "API online · local" and "Web build · local".

- [ ] **Step 7: Verify readiness fails when the database is stopped**

Run:
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.local.yml --env-file infra/local.env stop postgres
docker compose -f infra/docker-compose.yml -f infra/docker-compose.local.yml --env-file infra/local.env exec -T api wget -S -qO- http://127.0.0.1:8787/readyz
```
Expected: `HTTP/1.1 503 Service Unavailable` within about 2 s. Then restore the database:
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.local.yml --env-file infra/local.env start postgres
```

- [ ] **Step 8: Tear down and commit**

Run:
```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.local.yml --env-file infra/local.env down
git add .
git commit -m "build: container images and compose stack with caddy routing"
```

---

### Task 4: CI workflow (PR checks)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root scripts `lint`, `typecheck`, `test`, `build` (Tasks 1 and 2), the Dockerfiles (Task 3) and `infra/deploy.sh` (Task 5; shellcheck skips a missing file, as below)
- Produces: a reusable workflow (`workflow_call`) with the job `check`, which branch protection requires, and the job `docker` (PR only)

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci

on:
  pull_request:
  workflow_call:

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - name: shellcheck
        run: |
          if [ -f infra/deploy.sh ]; then shellcheck infra/deploy.sh; fi

  docker:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: build api image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/api/Dockerfile
          push: false
          cache-from: type=gha,scope=api
          cache-to: type=gha,scope=api,mode=max
      - name: build web image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: false
          cache-from: type=gha,scope=web
          cache-to: type=gha,scope=web,mode=max
```

- [ ] **Step 2: Lint the workflow locally**

Run: `docker run --rm -v "${PWD}:/repo" -w /repo rhysd/actionlint:latest -color`
Expected: no output (no errors). (In PowerShell, `${PWD}` works as written.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint, typecheck, test, build and image checks"
```

---

### Task 5: Deploy pipeline (images → Tailscale SSH → deploy.sh with auto-rollback)

**Files:**
- Create: `infra/deploy.sh`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `ci.yml` via `workflow_call` (Task 4) and the compose file (Task 3)
- Consumes (GitHub config, created in Task 6): secrets `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`; variables `DEPLOY_HOST`, `DEPLOY_USER`; environment `production`
- Produces: `deploy.sh <full-git-sha>`. It exits 0 when healthy on the new tag, and exits 1 after rolling back (or with nothing to roll back to). `/opt/pitwall/.env` `TAG=` always names the tag that is actually running.

- [ ] **Step 1: Write `deploy.sh`**

`infra/deploy.sh`:
```bash
#!/usr/bin/env bash
# Usage: deploy.sh <git-sha>
# Pulls the SHA-tagged images, restarts the stack, smoke-tests it,
# and rolls back to the previously running tag if the smoke test fails.
set -euo pipefail

cd "$(dirname "$0")"

NEW_TAG="${1:?usage: deploy.sh <git-sha>}"
PREV_TAG="$(grep -E '^TAG=' .env | cut -d= -f2- || true)"

set_tag() {
  sed -i '/^TAG=/d' .env
  echo "TAG=$1" >> .env
}

# Pull first, with the tag passed only as a process env var, so a missing image
# aborts (set -e) before .env or any running container changes.
pull() {
  TAG="$1" docker compose pull api web
}

start() {
  set_tag "$1"
  docker compose up -d --remove-orphans
}

smoke_test() {
  for _ in $(seq 1 30); do
    if docker compose exec -T api wget -qO- http://127.0.0.1:8787/readyz >/dev/null 2>&1 &&
      docker compose exec -T web wget -qO- http://127.0.0.1:80/api/version 2>/dev/null | grep -q "\"$1\""; then
      return 0
    fi
    sleep 2
  done
  return 1
}

echo "deploying ${NEW_TAG} (previous: ${PREV_TAG:-none})"
pull "$NEW_TAG"
start "$NEW_TAG"

if smoke_test "$NEW_TAG"; then
  echo "deploy ok: ${NEW_TAG}"
  docker image prune -f >/dev/null
  exit 0
fi

echo "smoke test failed for ${NEW_TAG}" >&2
if [[ -z "$PREV_TAG" || "$PREV_TAG" == "$NEW_TAG" ]]; then
  echo "no previous tag to roll back to" >&2
  exit 1
fi

echo "rolling back to ${PREV_TAG}" >&2
start "$PREV_TAG"
if smoke_test "$PREV_TAG"; then
  echo "rollback ok: ${PREV_TAG}" >&2
else
  echo "ROLLBACK ALSO UNHEALTHY: manual intervention needed" >&2
fi
exit 1
```

Make it executable in git (this works on Windows too):
```bash
git add infra/deploy.sh
git update-index --chmod=+x infra/deploy.sh
```

- [ ] **Step 2: Shellcheck it locally**

Run: `docker run --rm -v "${PWD}:/mnt" koalaman/shellcheck:stable infra/deploy.sh`
Expected: no output.

- [ ] **Step 3: Write the deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

permissions:
  contents: read
  packages: write

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  images:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: lowercase owner
        run: echo "OWNER=${GITHUB_REPOSITORY_OWNER,,}" >> "$GITHUB_ENV"
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: push api image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: ghcr.io/${{ env.OWNER }}/pitwall-api:${{ github.sha }}
          cache-from: type=gha,scope=api
          cache-to: type=gha,scope=api,mode=max
      - name: push web image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          build-args: GIT_SHA=${{ github.sha }}
          tags: ghcr.io/${{ env.OWNER }}/pitwall-web:${{ github.sha }}
          cache-from: type=gha,scope=web
          cache-to: type=gha,scope=web,mode=max

  deploy:
    needs: images
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: tailscale/github-action@v3
        with:
          oauth-client-id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
          oauth-secret: ${{ secrets.TS_OAUTH_SECRET }}
          tags: tag:ci
      - name: copy infra files
        run: |
          scp -o StrictHostKeyChecking=accept-new \
            infra/docker-compose.yml infra/deploy.sh \
            "${{ vars.DEPLOY_USER }}@${{ vars.DEPLOY_HOST }}:/opt/pitwall/"
      - name: run deploy.sh
        run: |
          ssh -o StrictHostKeyChecking=accept-new \
            "${{ vars.DEPLOY_USER }}@${{ vars.DEPLOY_HOST }}" \
            "chmod +x /opt/pitwall/deploy.sh && /opt/pitwall/deploy.sh ${{ github.sha }}"
      - name: public smoke test
        run: |
          for i in $(seq 1 10); do
            if curl -fsS https://pitwall.rafifdzaky.com/api/version | grep -q "${{ github.sha }}"; then
              echo "public URL serves ${{ github.sha }}"; exit 0
            fi
            sleep 5
          done
          echo "public URL is not serving the new version" >&2
          exit 1
```

- [ ] **Step 4: Lint both workflows**

Run: `docker run --rm -v "${PWD}:/repo" -w /repo rhysd/actionlint:latest -color`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add infra/deploy.sh .github/workflows/deploy.yml
git commit -m "ci: deploy pipeline with tailscale ssh, smoke test and auto-rollback"
```

---

### Task 6: Provision production + first deploy + rollback drill (Rafif-driven runbook)

> **Superseded 2026-09-27:** after reading the homelab playbook, the host is provisioned the homelab way (Terraform root + Ansible roles, subnet-router SSH with a pinned deploy key, host `srv-pitwall-01` @ 192.168.18.25, separate Tunnel `pitwall-prod`). Follow **`docs/runbooks/srv-pitwall-01.md`**. The steps below are kept for history only.

These steps involve your accounts (Proxmox, Tailscale, Cloudflare, GitHub). **Rafif performs the clicks and account changes.** Claude guides, checks outputs and fixes anything that breaks.

**Files:**
- Create: `docs/runbooks/production-host.md` (write this runbook as you go, recording the exact values used except secrets)

**Interfaces:**
- Produces: the host `pitwall-prod` on the tailnet with the tag `tag:pitwall`, user `deploy` in the `docker` group, and `/opt/pitwall/.env`
- Produces: GitHub secrets and variables named in Task 5, plus the public hostname `pitwall.rafifdzaky.com`

- [ ] **Step 1: Confirm rafifdzaky.com DNS is on Cloudflare**

Run: `nslookup -type=ns rafifdzaky.com`
Expected: nameservers ending in `ns.cloudflare.com`. If they don't, moving the DNS to Cloudflare is a prerequisite, and we pause here to decide together.

- [ ] **Step 2: Create the VM (Proxmox UI)**

Debian (12 or 13) cloud image or ISO, 2 vCPU, 4 GB RAM, 20 GB disk, hostname `pitwall-prod`. Then, on the VM:
```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl
# Install Docker Engine + compose plugin per https://docs.docker.com/engine/install/debian/
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo mkdir -p /opt/pitwall && sudo chown deploy:deploy /opt/pitwall
```
Expected: `sudo -u deploy docker ps` works.

- [ ] **Step 3: Join the tailnet with Tailscale SSH**

Add this to the tailnet policy file (admin console → Access controls), merging it with the existing policy:
```json
{
  "tagOwners": {
    "tag:ci": ["autogroup:admin"],
    "tag:pitwall": ["autogroup:admin"]
  },
  "grants": [
    { "src": ["tag:ci"], "dst": ["tag:pitwall"], "ip": ["tcp:22"] }
  ],
  "ssh": [
    { "action": "accept", "src": ["tag:ci"], "dst": ["tag:pitwall"], "users": ["deploy"] }
  ]
}
```
On the VM:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh --advertise-tags=tag:pitwall --hostname=pitwall-prod
```
Then create an OAuth client (admin console → Settings → OAuth clients) with write scope for **auth keys** and the tag `tag:ci`. Save the client ID and secret for Step 6.

- [ ] **Step 4: Create the Cloudflare Tunnel**

Cloudflare Zero Trust → Networks → Tunnels → Create tunnel (cloudflared) → name `pitwall-prod` → copy the **token**. Add a public hostname: `pitwall.rafifdzaky.com` → service `HTTP` → `web:80`.

- [ ] **Step 5: Write `/opt/pitwall/.env` on the VM**

```bash
sudo -u deploy bash -c 'umask 077 && cat > /opt/pitwall/.env' <<EOF
GHCR_OWNER=<your GitHub username, lowercase>
POSTGRES_PASSWORD=$(openssl rand -hex 24)
TUNNEL_TOKEN=<token from step 4>
COMPOSE_PROFILES=tunnel
EOF
ls -l /opt/pitwall/.env
```
Expected: `-rw------- deploy deploy`.

- [ ] **Step 6: Create the GitHub repo and settings**

With Rafif's confirmation, Claude runs `gh repo create pit-wall-on-call --public --source . --push`. Rafif may prefer to create the repo himself. Then, in the repo settings:
- Environment `production`.
- Secrets `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET`.
- Variables `DEPLOY_HOST=pitwall-prod` and `DEPLOY_USER=deploy`.
- Branch protection on `main`: require PRs and the status check `check`.

- [ ] **Step 7: First deploy**

The push in Step 6 triggers `deploy.yml`. The first run is expected to fail at `docker compose pull`, because new GHCR packages are private. Make both packages public (GitHub → Packages → `pitwall-api` / `pitwall-web` → Package settings → Change visibility → Public), then re-run the failed `deploy` job.
Expected: the deploy job is green, and `https://pitwall.rafifdzaky.com` shows "API online · <sha>" and "Web build · <sha>" with the same SHA.

- [ ] **Step 8: Verify ops endpoints are not public**

Run: `curl -s -o /dev/null -w "%{content_type}\n" https://pitwall.rafifdzaky.com/readyz`
Expected: `text/html` (the SPA fallback), not API JSON.

- [ ] **Step 9: Game day: prove auto-rollback works**

On a branch `drill/broken-readiness`, change `/readyz` in `apps/api/src/app.ts` to always return 503 (and update its test so CI passes, since this is a drill). Open a PR, merge it, and watch the deploy.
Expected: `deploy.sh` prints `smoke test failed` → `rolling back to <previous sha>` → `rollback ok`, and the job is red. The public URL still shows the previous SHA. Then revert the drill commit through a PR and confirm the next deploy goes green.

- [ ] **Step 10: Commit the runbook**

```bash
git add docs/runbooks/production-host.md
git commit -m "docs: production host runbook"
```

M0 is done when Steps 7 to 9 match their expected output.
