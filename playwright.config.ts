import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // When BETTER_AUTH_E2E_STORAGE_STATE is set, use it as the default storageState
    // for all tests. Individual fixtures can override this.
    ...(process.env.BETTER_AUTH_E2E_STORAGE_STATE
      ? { storageState: process.env.BETTER_AUTH_E2E_STORAGE_STATE }
      : {}),
  },
  // Skip Playwright's webServer entirely when E2E_USE_EXTERNAL_SERVER is set —
  // useful when you already have `bun run dev` running in another terminal and
  // Playwright's auto-start can race with it.
  webServer: process.env.E2E_USE_EXTERNAL_SERVER
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
