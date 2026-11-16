import { defineConfig, devices } from "@playwright/test";

// E2E_PROD=1 runs the suite against `next start` (the production build) on its
// own port, so it never reuses a dev server that happens to be running.
const PROD = Boolean(process.env.E2E_PROD);
const PORT = PROD ? 3100 : 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // The dev server compiles routes on first hit; more workers just contend for it.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: PROD ? `pnpm start --port ${PORT}` : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !PROD && !process.env.CI,
    timeout: 120_000,
  },
});
