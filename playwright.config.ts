import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    // Never reuse a preview that may contain live Supabase credentials.
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      CODE_HMAC_SECRET: "",
      RATE_LIMIT_HMAC_SECRET: "",
      TOKEN_ENCRYPTION_KEY: "",
      CLEANUP_SECRET: "",
      ENABLE_LIVE_TESTS: "false",
    },
    timeout: 120000,
  },
  reporter: "list",
});
