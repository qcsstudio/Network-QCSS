import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/frontend",
  timeout: 900_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.FRONTEND_QA_BASE || "http://127.0.0.1:3100",
    channel: "chrome",
    colorScheme: "light",
    locale: "en-IN",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: process.env.FRONTEND_QA_EXTERNAL
    ? undefined
    : {
        command: "npm run start -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100/api/health",
        reuseExistingServer: true,
        timeout: 120_000
      }
});
