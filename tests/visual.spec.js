const { test, expect } = require("@playwright/test");

async function prepareCatalog(page) {
  await page.evaluate(() => document.fonts.ready);
  const assets = page.locator("[data-brams-catalog-asset]");
  await assets.evaluateAll((images) => images.forEach((image) => { image.loading = "eager"; }));
  await expect.poll(() => assets.evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), {
    timeout: 15_000,
  }).toBe(true);
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(page.locator("[data-brams-demo-catalog-nav] a[href='#grundlagen']")).toHaveAttribute("aria-current", "true");
}

test("full component catalog", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await prepareCatalog(page);
  await expect(page).toHaveScreenshot("catalog-full.png", { fullPage: true, timeout: 20_000 });
});

test("mobile catalog viewport and full catalog", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await prepareCatalog(page);
  await expect(page).toHaveScreenshot("catalog-mobile.png");
  await expect(page).toHaveScreenshot("catalog-mobile-full.png", { fullPage: true, timeout: 20_000 });
});

test("tablet and minimum-width catalog boundaries", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  for (const viewport of [
    { name: "catalog-1024.png", width: 1024, height: 900 },
    { name: "catalog-768.png", width: 768, height: 900 },
    { name: "catalog-320.png", width: 320, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await prepareCatalog(page);
    await expect(page).toHaveScreenshot(viewport.name);
  }
});

test("open component finder and code panel", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.locator("[data-brams-demo-search]").focus();
  await expect(page).toHaveScreenshot("finder-open.png");
  await page.locator("[data-brams-demo-search]").press("Escape");
  await page.locator("#button").scrollIntoViewIfNeeded();
  await page.locator("#button [data-brams-demo-code-toggle]").click();
  await expect(page.locator("#button")).toHaveScreenshot("code-panel.png");
});

test("system and chapter motif details", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Visual baseline is maintained in Chromium.");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await prepareCatalog(page);
  await expect(page.locator(".brams-catalog-hero")).toHaveScreenshot("catalog-hero.png");
  await expect(page.locator(".brams-catalog-material").first()).toHaveScreenshot("system-family.png");
  for (const [index, name] of ["action-module", "interaction-study", "wayfinding-study", "signal-study", "data-instrument"].entries()) {
    await expect(page.locator(".brams-catalog-study").nth(index)).toHaveScreenshot(`${name}.png`);
  }
  await expect(page.locator("#button")).toHaveScreenshot("button-states.png");
  await expect(page.locator("#checkbox")).toHaveScreenshot("native-controls.png");
  await expect(page.locator("#material")).toHaveScreenshot("material-service.png");
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
