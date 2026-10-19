import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * Playwright e2e config. Tests run against the real static export in ./out,
 * served by a plain static server with no backend — mirroring production.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `npx serve` ships with no backend; serves ./out as static files.
    // No `-s` (SPA) flag: the export emits real per-route index.html files
    // (trailingSlash), so SPA fallback would mask routing and serve home.
    command: `npx --yes serve@14 out -l ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
