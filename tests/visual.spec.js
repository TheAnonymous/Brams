const { test, expect } = require("@playwright/test");

test("full component catalog", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("catalog-full.png", { fullPage: true });
});

test("mobile catalog viewport and full catalog", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("catalog-mobile.png");
  await expect(page).toHaveScreenshot("catalog-mobile-full.png", { fullPage: true });
});

test("system control panel detail", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".brams-control-panel")).toHaveScreenshot("control-panel.png");
});

test("open modal and drawer states", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Brams.open("#confirm-dialog"));
  await expect(page).toHaveScreenshot("modal-open.png");
  await page.evaluate(() => {
    Brams.close("#confirm-dialog");
    Brams.open("#settings-drawer");
  });
  await expect(page).toHaveScreenshot("drawer-open.png");
});
