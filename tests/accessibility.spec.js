const { test, expect } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

function violationSummary(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target.join(" "),
      html: node.html,
      failure: node.failureSummary,
    })),
  }));
}

async function expectNoAccessibilityViolations(page, state) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  expect(violationSummary(results.violations), `${state} accessibility violations`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
});

test("catalog has no automatically detectable WCAG A/AA or best-practice violations", async ({ page }) => {
  await expectNoAccessibilityViolations(page, "catalog");
});

test("component finder has no accessibility violations while expanded", async ({ page }) => {
  const search = page.locator("[data-brams-demo-search]");
  await search.focus();
  await search.fill("dialog");
  await expect(page.locator("[data-brams-demo-results]")).toBeVisible();
  await expectNoAccessibilityViolations(page, "component finder");
});

test("modal dialog has no accessibility violations while open", async ({ page }) => {
  await page.locator("#modal-trigger").click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await expectNoAccessibilityViolations(page, "modal dialog");
});

test("drawer has no accessibility violations while open", async ({ page }) => {
  await page.locator("#drawer-trigger").click();
  await expect(page.locator("#settings-drawer")).toBeVisible();
  await expectNoAccessibilityViolations(page, "drawer");
});

test("popover and menu have no accessibility violations while open", async ({ page }) => {
  await page.locator("#popover-trigger").click();
  await expect(page.locator("#popover-panel")).toBeVisible();
  await expectNoAccessibilityViolations(page, "popover");
  await page.keyboard.press("Escape");

  await page.locator("#menu-trigger").press("ArrowDown");
  await expect(page.locator("#device-menu")).toBeVisible();
  await expectNoAccessibilityViolations(page, "menu");
});
