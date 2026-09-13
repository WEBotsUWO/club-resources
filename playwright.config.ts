import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5181",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 5181 --strictPort",
    url: "http://127.0.0.1:5181",
    reuseExistingServer: false,
  },
});
