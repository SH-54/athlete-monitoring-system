import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  webServer:
    !process.env.CI && !process.env.PLAYWRIGHT_BASE_URL
      ? {
          command: "npm run dev",
          env: { ATHLOS_DEMO_MODE: "true" },
          url: "http://127.0.0.1:3000",
          reuseExistingServer: true,
          timeout: 60000,
        }
      : undefined,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    launchOptions: {
      executablePath: process.env.CI ? undefined : "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  workers: 1,
  reporter: "list",
});
