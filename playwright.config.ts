import { defineConfig, devices } from "@playwright/test";

// Uses Brave already on this computer, so no extra browser download. Change with TEST_BROWSER.
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const launchOptions = { executablePath: process.env.TEST_BROWSER || BRAVE };

export default defineConfig({
  testDir: "tests/browser",
  workers: 2,
  timeout: 60000,
  reporter: [["list"]],
  use: { baseURL: process.env.TEST_DASHBOARD_URL || "http://localhost:5173", launchOptions },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 375, height: 812 } } },
  ],
});
