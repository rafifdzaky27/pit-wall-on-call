import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  // Frame-time checks run alone, through pnpm e2e:perf.
  grepInvert: process.env.PERF ? undefined : /@perf/,
  grep: process.env.PERF ? /@perf/ : undefined,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // The API on a fresh, migrated pitwall_e2e database (pnpm db:up locally, a service container in CI).
      command: "pnpm --filter @pitwall/api e2e:serve",
      url: "http://localhost:8787/healthz",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // vite preview proxies /api to the API above (preview.proxy defaults to server.proxy).
      command: "pnpm --filter @pitwall/web build && pnpm --filter @pitwall/web exec vite preview --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
