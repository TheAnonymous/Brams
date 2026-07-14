const { test, expect } = require("@playwright/test");

const pageLoadResults = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  const external = [];
  const fontResponses = [];

  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4173" && !["data:", "blob:"].includes(url.protocol)) external.push(request.url());
  });
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.endsWith(".woff2")) fontResponses.push({ pathname, status: response.status() });
  });

  pageLoadResults.set(page, { errors, external, fontResponses });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
});

test("loads all 44 components and local fonts without errors or external requests", async ({ page }) => {
  const { errors, external, fontResponses } = pageLoadResults.get(page);
  const catalogAssets = page.locator("[data-brams-catalog-asset]");
  for (const asset of await catalogAssets.all()) await asset.scrollIntoViewIfNeeded();
  await expect.poll(() => catalogAssets.evaluateAll((images) => {
    return images.map((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  })).toEqual([true, true, true, true]);
  await expect(page.locator(".brams-catalog-component")).toHaveCount(44);
  await expect(page.locator(".brams-catalog-component__number").last()).toHaveText("44");
  expect(fontResponses.sort((a, b) => a.pathname.localeCompare(b.pathname))).toEqual([
    { pathname: "/fonts/Archivo-Medium.woff2", status: 200 },
    { pathname: "/fonts/Archivo-Regular.woff2", status: 200 },
    { pathname: "/fonts/Archivo-SemiBold.woff2", status: 200 },
  ]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("uses Archivo for UI hierarchy and reserves mono for technical values", async ({ page }) => {
  const typography = await page.evaluate(async () => {
    await document.fonts.ready;

    const style = (selector) => getComputedStyle(document.querySelector(selector));
    const archivoFaces = [...document.fonts]
      .filter((face) => face.family.replaceAll('"', "") === "Archivo")
      .map((face) => ({ status: face.status, weight: face.weight }))
      .sort((a, b) => Number(a.weight) - Number(b.weight));
    const monoScope = [
      ".brams-range__value",
      ".brams-stepper__marker",
      ".brams-stat__value",
      ".brams-timeline__time",
      ".brams-mono",
      ".brams-control-panel__serial",
      ".brams-control-panel__display",
      ".brams-control-panel__scale-labels",
      ".brams-control-panel__module:first-child .brams-control-panel__value",
      ".brams-catalog-section__count",
      ".brams-catalog-component__number",
    ].join(",");
    const unexpectedMono = [...document.querySelectorAll("body *")]
      .filter((element) => getComputedStyle(element).fontFamily.includes("monospace") && !element.closest(monoScope))
      .map((element) => element.className || element.tagName);
    const excessiveWeights = [...document.querySelectorAll("body *")]
      .filter((element) => Number(getComputedStyle(element).fontWeight) > 600)
      .map((element) => ({ className: element.className || element.tagName, weight: getComputedStyle(element).fontWeight }));

    return {
      archivoFaces,
      checks: [400, 500, 600].map((weight) => document.fonts.check(`${weight} 16px Archivo`)),
      families: {
        body: style("body").fontFamily,
        codeLabel: style(".brams-catalog-code").fontFamily,
        moduleStatus: style(".brams-control-panel__module:nth-child(2) .brams-control-panel__value").fontFamily,
        rangeValue: style(".brams-range__value").fontFamily,
        serial: style(".brams-control-panel__serial").fontFamily,
      },
      weights: {
        body: style("body").fontWeight,
        heading: style(".brams-card__title").fontWeight,
        button: style(".brams-button").fontWeight,
        strong: style(".brams-catalog-metrics__item strong").fontWeight,
      },
      numericVariants: {
        rangeValue: style(".brams-range__value").fontVariantNumeric,
        serial: style(".brams-control-panel__serial").fontVariantNumeric,
        moduleIndex: style(".brams-catalog-component__number").fontVariantNumeric,
      },
      unexpectedMono,
      excessiveWeights,
    };
  });

  expect(typography.archivoFaces).toEqual([
    { status: "loaded", weight: "400" },
    { status: "loaded", weight: "500" },
    { status: "loaded", weight: "600" },
  ]);
  expect(typography.checks).toEqual([true, true, true]);
  expect(typography.families.body).toContain("Archivo");
  expect(typography.families.codeLabel).toContain("Archivo");
  expect(typography.families.moduleStatus).toContain("Archivo");
  expect(typography.families.rangeValue).toContain("monospace");
  expect(typography.families.serial).toContain("monospace");
  expect(typography.weights).toEqual({ body: "400", heading: "500", button: "600", strong: "600" });
  expect(typography.numericVariants).toEqual({
    rangeValue: "tabular-nums",
    serial: "tabular-nums",
    moduleIndex: "tabular-nums",
  });
  expect(typography.unexpectedMono).toEqual([]);
  expect(typography.excessiveWeights).toEqual([]);
});

test("exposes an idempotent public API", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => window.Brams.VERSION)).toBe("0.3.1");
  await page.evaluate(() => {
    Brams.init(document);
    Brams.init(document.querySelector("#switch"));
  });
  const control = page.locator("#switch-demo");
  await expect(control).toHaveAttribute("aria-checked", "true");
  await control.click();
  await expect(control).toHaveAttribute("aria-checked", "false");
});

test("tabs, segmented control and menu implement keyboard models", async ({ page }) => {
  const firstTab = page.locator("#tab-general");
  await firstTab.focus();
  await firstTab.press("ArrowRight");
  await expect(page.locator("#tab-network")).toBeFocused();
  await expect(page.locator("#tab-network")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#panel-network")).toBeVisible();
  await page.locator("#tab-network").press("End");
  await expect(page.locator("#tab-access")).toBeFocused();

  const segment = page.locator("#segmented-demo button").first();
  await segment.focus();
  await segment.press("ArrowRight");
  await expect(page.locator("#segmented-demo button").nth(1)).toHaveAttribute("aria-pressed", "true");

  const menuTrigger = page.locator("#menu-trigger");
  await menuTrigger.focus();
  await menuTrigger.press("ArrowDown");
  await expect(page.locator("#device-menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Duplizieren" })).toBeFocused();
  await page.getByRole("menuitem", { name: "Duplizieren" }).press("End");
  await expect(page.getByRole("menuitem", { name: "Löschen" })).toBeFocused();
  await page.getByRole("menuitem", { name: "Löschen" }).press("Escape");
  await expect(page.locator("#device-menu")).toBeHidden();
  await expect(menuTrigger).toBeFocused();
});

test("accordion and form controls expose native and ARIA state", async ({ page }) => {
  const accordionButton = page.getByRole("button", { name: /Welche Browser/ });
  await expect(accordionButton).toHaveAttribute("aria-expanded", "false");
  await accordionButton.click();
  await expect(accordionButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#accordion-panel-2")).toBeVisible();

  await expect(page.locator("input[data-brams-indeterminate]")).toHaveJSProperty("indeterminate", true);
  await expect(page.locator("#form-field input[aria-invalid='true']")).toHaveAttribute("aria-describedby", "field-error");
  await expect(page.locator("#switch button:disabled")).toBeDisabled();
});

test("modal traps focus, closes with Escape and restores focus", async ({ page }) => {
  const trigger = page.locator("#modal-trigger");
  await trigger.click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/brams-scroll-locked/);
  await expect(page.locator("#confirm-dialog button").first()).toBeFocused();

  const last = page.locator("#confirm-dialog .brams-dialog__footer button").last();
  await last.focus();
  await last.press("Tab");
  await expect(page.locator("#confirm-dialog button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#confirm-dialog")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/brams-scroll-locked/);
  await expect(trigger).toBeFocused();
});

test("modal backdrop and drawer respect the topmost layer", async ({ page }) => {
  await page.locator("#modal-trigger").click();
  await page.evaluate(() => Brams.open("#settings-drawer"));
  await expect(page.locator("#settings-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-drawer")).toBeHidden();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.locator("#confirm-dialog").click({ position: { x: 4, y: 4 } });
  await expect(page.locator("#confirm-dialog")).toBeHidden();
});

test("overlay events bubble", async ({ page }) => {
  const events = await page.evaluate(async () => {
    const names = [];
    document.addEventListener("brams:open", () => names.push("open"), { once: true });
    document.addEventListener("brams:close", () => names.push("close"), { once: true });
    Brams.open("#confirm-dialog");
    Brams.close("#confirm-dialog");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return names;
  });
  expect(events).toEqual(["open", "close"]);
});

test("toast, range, number, password, files, pagination and sorting work", async ({ page }) => {
  await page.locator("#toast-demo").click();
  await expect(page.locator(".brams-toast").filter({ hasText: "Konfiguration gespeichert" })).toBeVisible();

  await page.locator("#range-demo").fill("81");
  await expect(page.locator("#range output")).toHaveText("81 %");

  await page.locator("#number-demo [data-brams-number-action='increment']").click();
  await expect(page.locator("#number-demo input")).toHaveValue("4");

  const password = page.locator("#password-demo");
  await page.locator("#password-field [data-brams-password-toggle]").click();
  await expect(password).toHaveAttribute("type", "text");

  await page.locator("#file-demo input[type='file']").setInputFiles({
    name: "messung.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("time,value\n10:00,64"),
  });
  await expect(page.locator("#file-demo .brams-file__item")).toContainText("messung.csv");
  await expect(page.locator("#file-demo")).toHaveAttribute("data-state", "selected");

  await page.locator("#pagination-demo [data-page='2']").click();
  await expect(page.locator("#pagination-status")).toContainText("11–20");

  await page.locator("#table-demo [data-brams-sort='number']").click();
  await expect(page.locator("#table-demo tbody tr").first()).toContainText("42 %");
  await expect(page.locator("#table-demo th").nth(2)).toHaveAttribute("aria-sort", "ascending");
});

test("popover and tooltip work with keyboard focus", async ({ page }) => {
  const popover = page.locator("#popover-panel");
  await page.locator("#popover-trigger").click();
  await expect(popover).toBeVisible();
  await expect(page.locator("#popover-trigger")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();

  const tooltipTrigger = page.locator("[data-brams-tooltip]");
  await tooltipTrigger.focus();
  await expect(page.locator("#tooltip-calibrate")).toBeVisible();
  await tooltipTrigger.blur();
  await expect(page.locator("#tooltip-calibrate")).toBeHidden();
});

test("focus, disabled, invalid and reduced-motion states are present", async ({ page }) => {
  await page.locator("#modal-trigger").focus();
  const outline = await page.locator("#modal-trigger").evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
  await expect(page.locator("#button button:disabled")).toBeDisabled();
  const invalidBorder = await page.locator("input[aria-invalid='true']").evaluate((element) => getComputedStyle(element).borderLeftColor);
  expect(invalidBorder).toBe("rgb(161, 38, 30)");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page.locator(".brams-spinner").first().evaluate((element) => getComputedStyle(element).animationDuration);
  expect(duration).toBe("0.001s");
});

test("v0.3.1 visual contracts use black actions, reduced radii and shadowless cards", async ({ page }) => {
  const styles = await page.evaluate(() => {
    const primary = getComputedStyle(document.querySelector(".brams-button--primary"));
    const card = getComputedStyle(document.querySelector(".brams-catalog-component"));
    const panel = getComputedStyle(document.querySelector(".brams-control-panel"));
    const lamp = getComputedStyle(document.querySelector(".brams-control-panel__lamp"));
    return {
      primaryBackground: primary.backgroundColor,
      cardRadius: card.borderRadius,
      cardShadow: card.boxShadow,
      allCardsShadowless: [...document.querySelectorAll(".brams-card")]
        .every((element) => getComputedStyle(element).boxShadow === "none"),
      panelRadius: panel.borderRadius,
      lampBackground: lamp.backgroundColor,
    };
  });

  expect(styles).toEqual({
    primaryBackground: "rgb(17, 17, 15)",
    cardRadius: "2px",
    cardShadow: "none",
    allCardsShadowless: true,
    panelRadius: "2px",
    lampBackground: "rgb(177, 38, 30)",
  });
});

test("core text and control colors meet WCAG AA contrast", async ({ page }) => {
  const ratios = await page.evaluate(() => {
    function rgb(value) {
      return value.match(/\d+(?:\.\d+)?/g).slice(0, 3).map(Number);
    }

    function luminance(value) {
      const channels = rgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
    }

    function contrast(foreground, background) {
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return (lighter + 0.05) / (darker + 0.05);
    }

    const body = getComputedStyle(document.body);
    const primary = getComputedStyle(document.querySelector(".brams-button--primary"));
    const muted = getComputedStyle(document.querySelector(".brams-catalog-hero__lead"));
    return {
      body: contrast(body.color, getComputedStyle(document.documentElement).backgroundColor),
      primary: contrast(primary.color, primary.backgroundColor),
      muted: contrast(muted.color, getComputedStyle(document.documentElement).backgroundColor),
    };
  });

  expect(ratios.body).toBeGreaterThanOrEqual(4.5);
  expect(ratios.primary).toBeGreaterThanOrEqual(4.5);
  expect(ratios.muted).toBeGreaterThanOrEqual(4.5);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} layout has no page-level horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.reload();
    const overflow = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
  });
}
