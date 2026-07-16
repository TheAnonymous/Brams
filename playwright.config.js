const { defineConfig, devices } = require("@playwright/test");

const port = Number(process.env.BRAMS_TEST_PORT || 4173);
const workers = Number(process.env.BRAMS_TEST_WORKERS || 2);
const baseURL = `http://127.0.0.1:${port}`;

if (!Number.isInteger(workers) || workers < 1) {
  throw new Error("BRAMS_TEST_WORKERS must be a positive integer");
}

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  expect: {
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.01 },
  },
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
