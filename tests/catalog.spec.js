const { test, expect } = require("@playwright/test");
const { readdir } = require("node:fs/promises");
const { version: packageVersion } = require("../package.json");

const pageLoadResults = new WeakMap();
const testOrigin = `http://127.0.0.1:${Number(process.env.BRAMS_TEST_PORT || 4173)}`;

test.beforeEach(async ({ page }) => {
  const errors = [];
  const external = [];
  const fontResponses = [];
  const imageResponses = [];

  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== testOrigin && !["data:", "blob:"].includes(url.protocol)) external.push(request.url());
  });
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (pathname.endsWith(".woff2")) fontResponses.push({ pathname, status: response.status() });
    if (pathname.endsWith(".webp")) imageResponses.push({ pathname, status: response.status() });
  });

  pageLoadResults.set(page, { errors, external, fontResponses, imageResponses });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
});

test("loads 44 components, three local fonts and exactly eight local images", async ({ page }) => {
  const { errors, external, fontResponses, imageResponses } = pageLoadResults.get(page);
  const catalogAssets = page.locator("[data-brams-catalog-asset]");
  await expect(catalogAssets).toHaveCount(8);
  await catalogAssets.evaluateAll((images) => images.forEach((image) => { image.loading = "eager"; }));
  await expect.poll(() => catalogAssets.evaluateAll((images) => {
    return images.map((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  }), { timeout: 15_000 }).toEqual(Array(8).fill(true));
  await expect(page.locator(".brams-catalog-component")).toHaveCount(44);
  await expect(page.locator(".brams-catalog-component__number").last()).toHaveText("44");
  expect(fontResponses.sort((a, b) => a.pathname.localeCompare(b.pathname))).toEqual([
    { pathname: "/fonts/Archivo-Medium.woff2", status: 200 },
    { pathname: "/fonts/Archivo-Regular.woff2", status: 200 },
    { pathname: "/fonts/Archivo-SemiBold.woff2", status: 200 },
  ]);
  const expectedImages = [
    "brams-action-module.webp",
    "brams-control-unit.webp",
    "brams-data-instrument.webp",
    "brams-interaction-study.webp",
    "brams-material-study.webp",
    "brams-signal-study.webp",
    "brams-system-family.webp",
    "brams-wayfinding-study.webp",
  ];
  expect((await readdir("assets")).filter((file) => file.endsWith(".webp")).sort()).toEqual(expectedImages);
  expect([...new Map(imageResponses.map((result) => [result.pathname, result])).values()]
    .sort((a, b) => a.pathname.localeCompare(b.pathname))).toEqual(expectedImages.map((file) => ({
    pathname: `/assets/${file}`,
    status: 200,
  })));
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
      ".brams-catalog-section__count",
      ".brams-catalog-component__number",
      ".brams-catalog-finder kbd",
      ".brams-catalog-code-block pre",
      ".brams-catalog-manual-copy",
      ".brams-catalog-finder__number",
      ".brams-catalog-finder__spec",
      ".brams-catalog-spec code",
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
        metric: style(".brams-catalog-metrics__item strong").fontFamily,
        rangeValue: style(".brams-range__value").fontFamily,
        sectionCount: style(".brams-catalog-section__count").fontFamily,
      },
      weights: {
        body: style("body").fontWeight,
        heading: style(".brams-card__title").fontWeight,
        button: style(".brams-button").fontWeight,
        strong: style(".brams-catalog-metrics__item strong").fontWeight,
      },
      numericVariants: {
        rangeValue: style(".brams-range__value").fontVariantNumeric,
        sectionCount: style(".brams-catalog-section__count").fontVariantNumeric,
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
  expect(typography.families.metric).toContain("Archivo");
  expect(typography.families.rangeValue).toContain("monospace");
  expect(typography.families.sectionCount).toContain("monospace");
  expect(typography.weights).toEqual({ body: "400", heading: "500", button: "600", strong: "600" });
  expect(typography.numericVariants).toEqual({
    rangeValue: "tabular-nums",
    sectionCount: "tabular-nums",
    moduleIndex: "tabular-nums",
  });
  expect(typography.unexpectedMono).toEqual([]);
  expect(typography.excessiveWeights).toEqual([]);
});

test("exposes an idempotent public API", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => window.Brams.VERSION)).toBe(packageVersion);
  await expect(page.locator("script[src='catalog.js']")).toHaveCount(1);
  expect(await page.evaluate(() => Object.keys(window.Brams).sort())).toEqual(["VERSION", "close", "init", "open", "toast"]);
  await page.evaluate(() => {
    Brams.init(document);
    Brams.init(document.querySelector("#switch"));
  });
  const control = page.locator("#switch-demo");
  await expect(control).toHaveAttribute("aria-checked", "true");
  await control.click();
  await expect(control).toHaveAttribute("aria-checked", "false");
});

test("release version is consistent across runtime and catalog surfaces", async ({ page }) => {
  await expect(page).toHaveTitle(`Brams v${packageVersion} — Komponenten-Katalog`);
  await expect(page.locator("meta[name='description']")).toHaveAttribute("content", new RegExp(`Brams v${packageVersion}`));
  await expect(page.locator(".brams-header .brams-badge")).toHaveText(`v${packageVersion}`);
  await expect(page.locator("#api .brams-catalog-section__count")).toHaveText(`v${packageVersion}`);
  await expect(page.locator(".brams-catalog-footer")).toContainText(`Brams v${packageVersion}`);
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
  const accordionButton = page.getByRole("button", { name: /Wann wird Modul 07 gewartet/ });
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
  await expect(page.locator("body > header")).toHaveAttribute("inert", "");
  await expect(page.locator("body > main")).toHaveAttribute("inert", "");
  await expect(page.locator("body > footer")).toHaveAttribute("inert", "");
  await expect(page.locator(".brams-toast-region")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#confirm-dialog button").first()).toBeFocused();

  const last = page.locator("#confirm-dialog .brams-dialog__footer button").last();
  await last.focus();
  await last.press("Tab");
  await expect(page.locator("#confirm-dialog button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#confirm-dialog")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/brams-scroll-locked/);
  await expect(page.locator("body > header")).not.toHaveAttribute("inert", "");
  await expect(page.locator("body > main")).not.toHaveAttribute("inert", "");
  await expect(page.locator("body > footer")).not.toHaveAttribute("inert", "");
  await expect(trigger).toBeFocused();
});

test("modal backdrop and drawer respect the topmost layer", async ({ page }) => {
  await page.locator("#modal-trigger").click();
  await page.evaluate(() => Brams.open("#settings-drawer"));
  await expect(page.locator("#settings-drawer")).toBeVisible();
  await expect(page.locator("#confirm-dialog")).toHaveAttribute("inert", "");
  await expect(page.locator("#settings-drawer")).not.toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-drawer")).toBeHidden();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await expect(page.locator("#confirm-dialog")).not.toHaveAttribute("inert", "");
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

test("nested modals isolate sibling branches and restore their previous inert state", async ({ page }) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.id = "nested-modal-fixture";
    fixture.innerHTML = `
      <button id="nested-modal-trigger" type="button" data-brams-open="#nested-modal">Öffnen</button>
      <div id="nested-background">Hintergrund</div>
      <div id="nested-preinert" inert>Bereits inaktiv</div>
      <div id="nested-modal" class="brams-overlay" aria-hidden="true" hidden tabindex="-1">
        <section class="brams-dialog" role="dialog" aria-modal="true" aria-labelledby="nested-modal-title">
          <h2 id="nested-modal-title">Verschachtelter Dialog</h2>
          <button type="button" data-brams-close>Schließen</button>
        </section>
      </div>`;
    document.querySelector("main").append(fixture);
    Brams.init(fixture);
  });

  await page.locator("#nested-modal-trigger").click();
  await expect(page.locator("#nested-modal")).toBeVisible();
  await expect(page.locator("#nested-background")).toHaveAttribute("inert", "");
  await expect(page.locator("#nested-modal-trigger")).toHaveAttribute("inert", "");
  await expect(page.locator("#nested-preinert")).toHaveAttribute("inert", "");
  await expect(page.locator("#nested-modal")).not.toHaveAttribute("inert", "");
  await expect(page.locator("body > header")).toHaveAttribute("inert", "");

  await page.locator("#nested-modal [data-brams-close]").click();
  await expect(page.locator("#nested-modal")).toBeHidden();
  await expect(page.locator("#nested-background")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#nested-modal-trigger")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#nested-preinert")).toHaveAttribute("inert", "");
  await expect(page.locator("body > header")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#nested-modal-trigger")).toBeFocused();
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
  const popoverTrigger = page.locator("#popover-trigger");
  await popoverTrigger.click();
  await expect(popover).toBeVisible();
  await expect(popoverTrigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(popoverTrigger).toBeFocused();

  const tooltipTrigger = page.locator("[data-brams-tooltip]");
  await tooltipTrigger.focus();
  await expect(tooltipTrigger).toBeFocused();
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
  const motion = await page.locator(".brams-spinner").first().evaluate((element) => ({
    animation: getComputedStyle(element).animationName,
    transition: getComputedStyle(document.querySelector(".brams-button")).transitionDuration,
  }));
  expect(motion).toEqual({ animation: "none", transition: "0s" });
});

test("v1.0.0 visual contracts use black actions, reduced radii and shadowless cards", async ({ page }) => {
  const styles = await page.evaluate(() => {
    const primary = getComputedStyle(document.querySelector(".brams-button--primary"));
    const card = getComputedStyle(document.querySelector(".brams-catalog-component"));
    const heroStage = document.querySelector(".brams-catalog-hero__stage");
    const heroProduct = document.querySelector(".brams-catalog-hero__product");
    return {
      primaryBackground: primary.backgroundColor,
      cardRadius: card.borderRadius,
      cardShadow: card.boxShadow,
      allCardsShadowless: [...document.querySelectorAll(".brams-card")]
        .every((element) => getComputedStyle(element).boxShadow === "none"),
      heroStageChildren: heroStage.children.length,
      heroProductPosition: getComputedStyle(heroProduct).position,
    };
  });

  expect(styles).toEqual({
    primaryBackground: "rgb(17, 17, 15)",
    cardRadius: "2px",
    cardShadow: "none",
    allCardsShadowless: true,
    heroStageChildren: 1,
    heroProductPosition: "static",
  });
});

test("all 44 components expose one complete controlled specification line", async ({ page }) => {
  const specifications = await page.locator(".brams-catalog-component").evaluateAll((components) => components.map((component) => ({
    id: component.id,
    state: component.dataset.bramsDemoState,
    input: component.dataset.bramsDemoInput,
    api: component.dataset.bramsDemoApi,
    lines: component.querySelectorAll("[data-brams-demo-spec]").length,
    terms: [...component.querySelectorAll("[data-brams-demo-spec] dt")].map((term) => term.textContent.trim()),
    values: [...component.querySelectorAll("[data-brams-demo-spec] dd")].map((value) => value.textContent.trim()),
  })));

  expect(specifications).toHaveLength(44);
  for (const specification of specifications) {
    expect(specification.lines, specification.id).toBe(1);
    expect(specification.terms, specification.id).toEqual(["STATE", "INPUT", "API"]);
    expect(["static", "native", "programmatic"], specification.id).toContain(specification.state);
    expect(["static", "native", "pointer + key"], specification.id).toContain(specification.input);
    expect(specification.api, specification.id).toMatch(/^(\.brams-|data-brams-|Brams\.)/);
    expect(specification.values, specification.id).toEqual([specification.state, specification.input, specification.api]);
  }
});

test("desktop catalog uses explicit 5/7, 7/5 and full-width compositions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const layout = await page.locator(".brams-catalog-component").evaluateAll((components) => components.map((component) => ({
    id: component.id,
    span5: component.classList.contains("brams-catalog-component--span-5"),
    span7: component.classList.contains("brams-catalog-component--span-7"),
    wide: component.classList.contains("brams-catalog-component--wide"),
    gridColumn: getComputedStyle(component).gridColumnStart,
  })));

  expect(layout.some((item) => item.span5)).toBe(true);
  expect(layout.some((item) => item.span7)).toBe(true);
  expect(layout.some((item) => item.wide)).toBe(true);
  for (const item of layout) {
    expect(Number(item.span5) + Number(item.span7) + Number(item.wide), item.id).toBe(1);
    if (item.span5) expect(item.gridColumn, item.id).toBe("span 5");
    if (item.span7) expect(item.gridColumn, item.id).toBe("span 7");
  }
});

test("interactive controls share precise hover, focus, pressed, selected and disabled states", async ({ page }) => {
  const button = page.locator("#button .brams-button--primary");
  await button.hover();
  const box = await button.boundingBox();
  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
  await page.mouse.down();
  await expect.poll(() => button.evaluate((element) => ({
    active: element.matches(":active"),
    offset: new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
  }))).toEqual({ active: true, offset: 1 });
  await page.mouse.up();

  await page.locator("#button [data-brams-demo-code-toggle]").focus();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  const states = await page.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    const controlHeight = (selector) => document.querySelector(selector).getBoundingClientRect().height;
    return {
      focusedOutline: style("#button .brams-button--primary").outlineStyle,
      heights: [
        controlHeight("#button .brams-button--primary"),
        controlHeight("#icon-button .brams-icon-button"),
        controlHeight("#text-input .brams-input"),
        controlHeight("#select .brams-select"),
      ],
      selectedBackgrounds: [
        style("#tabs [aria-selected='true']").color,
        style("#segmented-control [aria-pressed='true']").backgroundColor,
        style("#pagination [aria-current='page']").backgroundColor,
        style("#switch [aria-checked='true']").backgroundColor,
      ],
      native: {
        checkboxAppearance: style("#checkbox input:checked").appearance,
        checkboxBackground: style("#checkbox input:checked").backgroundColor,
        radioAppearance: style("#radio-group input:checked").appearance,
        radioBackground: style("#radio-group input:checked").backgroundColor,
      },
      disabled: {
        button: style("#button button:disabled").opacity,
        checkbox: style("#checkbox input:disabled").cursor,
        input: style("#text-input input:disabled").cursor,
      },
    };
  });

  expect(states.focusedOutline).not.toBe("none");
  expect(new Set(states.heights)).toEqual(new Set([40]));
  expect(states.selectedBackgrounds.slice(1)).toEqual(Array(3).fill("rgb(17, 17, 15)"));
  expect(states.native).toEqual({
    checkboxAppearance: "none",
    checkboxBackground: "rgb(17, 17, 15)",
    radioAppearance: "none",
    radioBackground: "rgb(17, 17, 15)",
  });
  expect(states.disabled).toEqual({ button: "0.45", checkbox: "not-allowed", input: "not-allowed" });
});

test("component finder indexes metadata, 44 entries and ignores case and diacritics", async ({ page }) => {
  const search = page.locator("[data-brams-demo-search]");
  await search.focus();
  await expect(page.locator("[data-brams-demo-results] [role='option']")).toHaveCount(44);
  await expect(page.locator(".brams-catalog-finder__group")).toHaveCount(5);
  await expect(page.locator(".brams-catalog-finder__result").first()).toContainText("STATE");
  await expect(page.locator(".brams-catalog-finder__result").first()).toContainText("INPUT");
  await expect(page.locator(".brams-catalog-finder__result").first()).toContainText("API");

  await search.fill("data-brams-password-toggle");
  await expect(page.locator("[data-brams-demo-results] [role='option']")).toHaveCount(1);
  await expect(page.locator("[data-brams-demo-results]")).toContainText("Password Field");

  await search.fill("SCHLUSSEL");
  await expect(page.locator("[data-brams-demo-results] [role='option']")).toHaveCount(1);
  await expect(page.locator("[data-brams-demo-results]")).toContainText("Description List");
  await expect(page.locator("[data-brams-demo-search-status]")).toHaveText("1 Komponente gefunden.");

  await search.fill("kein-modul");
  await expect(page.locator("[data-brams-demo-results] [role='option']")).toHaveCount(0);
  await expect(page.locator(".brams-catalog-finder__empty")).toBeVisible();
  await expect(page.locator("[data-brams-demo-search-status]")).toContainText("Keine Komponenten");
});

test("finder keyboard model updates hash and component focus", async ({ page }) => {
  await page.locator("body").press("/");
  const search = page.locator("[data-brams-demo-search]");
  await expect(search).toBeFocused();
  await search.press("ArrowUp");
  await expect(search).toHaveAttribute("aria-activedescendant", "finder-result-timeline");
  await search.fill("timeline");
  await search.press("ArrowDown");
  await expect(search).toHaveAttribute("aria-activedescendant", "finder-result-timeline");
  await search.press("Enter");
  await expect(page).toHaveURL(/#timeline$/);
  await expect(page.locator("#timeline")).toBeFocused();

  await search.focus();
  await search.fill("toast");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-brams-demo-results]")).toBeHidden();
});

test("all components expose non-empty independent code examples", async ({ page }) => {
  await expect(page.locator(".brams-catalog-component[data-brams-demo-documented='true']")).toHaveCount(44);
  await expect(page.locator("[data-brams-demo-code-toggle]")).toHaveCount(44);
  expect(await page.locator("template[data-brams-demo-snippet]").evaluateAll((templates) => ({
    components: new Set(templates.map((template) => template.dataset.bramsDemoSnippet)).size,
    nonEmpty: templates.every((template) => template.innerHTML.trim().length > 0),
    javascript: templates.filter((template) => template.dataset.language === "javascript").length,
  }))).toEqual({ components: 44, nonEmpty: true, javascript: 4 });

  const cardToggle = page.locator("#card [data-brams-demo-code-toggle]");
  const buttonToggle = page.locator("#button [data-brams-demo-code-toggle]");
  await cardToggle.click();
  await buttonToggle.click();
  await expect(page.locator("#code-card")).toBeVisible();
  await expect(page.locator("#code-button")).toBeVisible();
  await cardToggle.click();
  await expect(page.locator("#code-card")).toBeHidden();
  await expect(page.locator("#code-button")).toBeVisible();
});

test("code copy uses toast and exposes a manual clipboard fallback", async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => { window.__bramsCopied = value; } },
    });
  });
  await page.locator("#button [data-brams-demo-code-toggle]").click();
  await page.locator("#code-button [data-brams-demo-copy]").click();
  await expect(page.locator("#code-button [data-brams-demo-copy]")).toHaveText("Kopiert");
  await expect(page.locator("#code-button [data-brams-demo-copy-status]")).toHaveText("Code kopiert.");
  await expect(page.locator(".brams-toast").filter({ hasText: "Code kopiert" })).toBeVisible();
  expect(await page.evaluate(() => window.__bramsCopied)).toContain("brams-button--primary");

  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  await page.locator("#card [data-brams-demo-code-toggle]").click();
  await page.locator("#code-card [data-brams-demo-copy]").click();
  const manual = page.locator("#code-card [data-brams-demo-manual-copy]");
  await expect(manual).toBeVisible();
  await expect(manual).toBeFocused();
  await expect(manual).not.toHaveValue("");
  await expect(page.locator("#code-card [data-brams-demo-copy-status]")).toContainText("markiert");
});

test("correct and legacy pagination button classes remain compatible", async ({ page }) => {
  const styles = await page.evaluate(() => {
    const legacy = document.createElement("button");
    legacy.className = "brams-pagination__bramstton";
    legacy.textContent = "4";
    document.querySelector("#pagination-demo").append(legacy);
    const current = document.querySelector(".brams-pagination__button");
    const pick = (element) => {
      const style = getComputedStyle(element);
      return { display: style.display, height: style.height, borderRadius: style.borderRadius, fontSize: style.fontSize };
    };
    return { current: pick(current), legacy: pick(legacy) };
  });
  expect(styles.legacy).toEqual(styles.current);
});

test("narrow catalog navigation keeps the active section visible", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator("[data-brams-demo-catalog-nav] a[href='#material']")).toHaveAttribute("aria-current", "true");
  await expect.poll(() => page.evaluate(() => {
    const nav = document.querySelector("[data-brams-demo-catalog-nav]");
    const link = nav.querySelector("a[href='#material']");
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    return nav.scrollLeft > 0 && linkRect.left >= navRect.left - 1 && linkRect.right <= navRect.right + 1;
  })).toBe(true);
});

test("demo hooks stay outside the library runtime", async ({ page }) => {
  const sources = await page.evaluate(async () => ({
    runtime: await (await fetch("brams.js")).text(),
    catalog: await (await fetch("catalog.js")).text(),
  }));
  expect(sources.runtime).not.toContain("data-brams-demo-");
  expect(sources.catalog).toContain("data-brams-demo-");
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
  { name: "compact desktop", width: 1024, height: 900 },
  { name: "tablet", width: 768, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "minimum", width: 320, height: 720 },
]) {
  test(`${viewport.name} layout has no page-level horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.reload();
    const overflow = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
  });
}
