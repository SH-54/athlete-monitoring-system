import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./tests/auth-ui",
  outputDir: "./test-results/auth-ui",
  webServer: {
    command: "npm run start -- --port 3171",
    url: "http://127.0.0.1:3171",
    env: {
      ATHLOS_DEMO_MODE: "false",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_language_ui_test_only",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  use: { ...base.use, baseURL: "http://127.0.0.1:3171" },
});
