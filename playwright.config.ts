import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chrome-320",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 800 },
        launchOptions: {
          executablePath: "/usr/local/bin/google-chrome",
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/es",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
