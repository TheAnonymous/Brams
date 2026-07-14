const { test, expect } = require("@playwright/test");

async function prepareCatalog(page) {
  await page.evaluate(() => document.fonts.ready);
  const assets = page.locator("[data-brams-catalog-asset]");
  for (const asset of await assets.all()) {
    await asset.scrollIntoViewIfNeeded();
    await expect.poll(() => asset.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("full component catalog", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await prepareCatalog(page);
  await expect(page).toHaveScreenshot("catalog-full.png", { fullPage: true });
});

test("mobile catalog viewport and full catalog", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await prepareCatalog(page);
  await expect(page).toHaveScreenshot("catalog-mobile.png");
  await expect(page).toHaveScreenshot("catalog-mobile-full.png", { fullPage: true });
});

test("system control panel detail", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await prepareCatalog(page);
  await expect(page.locator(".brams-control-panel")).toHaveScreenshot("control-panel.png");
  await expect(page.locator(".brams-catalog-archive").nth(0)).toHaveScreenshot("foundations-archive.png");
  await expect(page.locator(".brams-catalog-study").nth(0)).toHaveScreenshot("interaction-study.png");
  await expect(page.locator(".brams-catalog-archive").nth(1)).toHaveScreenshot("navigation-archive.png");
  await expect(page.locator(".brams-catalog-study").nth(1)).toHaveScreenshot("signal-study.png");
  await expect(page.locator(".brams-catalog-archive").nth(2)).toHaveScreenshot("information-archive.png");
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
