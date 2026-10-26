import { test, expect } from "@playwright/test";

test("Developer dashboard uses pinned Lucide SVGs instead of Unicode placeholder icons", async ({ page }) => {
  await page.goto("/#/dev");
  await expect(page.getByRole("heading", { name: "Developer overview" })).toBeVisible();
  const sprite = await page.request.get("/icons.svg");
  expect(sprite.ok()).toBeTruthy();
  expect(await sprite.text()).toContain('id="layout-dashboard"');
  await expect(page.locator(".sidebar .nav-icon svg.lucide-icon")).toHaveCount(11);
  await expect(page.locator(".sidebar img.product-symbol")).toHaveAttribute("src", "./assets/thryvems-mark.png");
  // Reconciled PR #3 wordmark; keep the official product mark, not PR #3's duplicate painted SVG.
  await expect(page.locator(".sidebar .wordmark")).toHaveText("ThryveMS");
  await expect(page.locator(".topbar .wordmark")).toHaveText("ThryveMS");
  expect((await page.request.get("/assets/thryvems-mark.svg")).ok()).toBeTruthy();
  expect((await page.request.get("/fonts/public-sans-latin-400-normal.woff2")).ok()).toBeTruthy();
  expect((await page.request.get("/fonts/public-sans-latin-600-normal.woff2")).ok()).toBeTruthy();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('600 20px "Public Sans"'))).toBeTruthy();
  expect(await page.locator(".metric-icon svg.lucide-icon").count()).toBeGreaterThanOrEqual(12);
  const nav = await page.locator(".sidebar .nav").innerText();
  expect(nav).not.toMatch(/[▦▤▣⇧✉≡⚙⚑⌂♙]/);
  const refs = await page.locator(".nav-icon svg use, .metric-icon svg use").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
  expect(refs.every(x => x?.startsWith("./icons.svg#"))).toBeTruthy();
});

test("Desktop sidebar collapses to icon labels and keeps routes accessible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#/dev");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".sidebar")).toHaveClass(/collapsed/);
  await expect(page.locator(".sidebar .nav a[aria-label='Deployments']")).toBeVisible();
  await page.locator(".sidebar .nav a[aria-label='Deployments']").click();
  await expect(page.getByRole("heading", { name: "Deployments" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator(".sidebar")).not.toHaveClass(/collapsed/);
});

test("ThryveMS screens retain responsive grid and accessible SVG icons in both appearances", async ({ page }, testInfo) => {
  for (const width of [390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 850 });
    for (const route of ["#/dev", "#/dev/deployments", "#/biz"]) {
      await page.goto("/" + route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      const svg = page.locator("main .metric-icon svg.lucide-icon").first();
      if (await svg.count()) await expect(svg).toHaveAttribute("aria-hidden", "true");
    }
    await page.goto("/#/dev");
    await page.screenshot({ path: testInfo.outputPath("developer-light-" + width + ".png"), fullPage: true });
    await page.getByRole("button", { name: "Toggle light and dark appearance" }).click();
    await page.screenshot({ path: testInfo.outputPath("developer-dark-" + width + ".png"), fullPage: true });
    await page.goto("/#/biz");
    await page.screenshot({ path: testInfo.outputPath("partner-dark-" + width + ".png"), fullPage: true });
  }
});

test("Sidebar shows approved sub-pages for the active menu group", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#/dev/finance");
  const sub = page.locator(".sidebar .nav-sub a");
  await expect(sub.filter({ hasText: "Shared profit reporting" })).toBeVisible();
  await sub.filter({ hasText: "Distributions" }).click();
  await expect(page).toHaveURL(/tab=distributions/);
  await expect(sub.filter({ hasText: "Distributions" })).toHaveAttribute("aria-current", "page");
  await page.locator("#preview-role").selectOption("partner-a");
  await page.goto("/#/biz");
  await expect(page.locator(".sidebar .nav a[aria-label='Business settings']")).toBeVisible();
});

test("Mobile menu opens as a drawer and closes after navigating", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/#/dev");
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
  await page.locator(".sidebar .nav a[aria-label='Releases']").click();
  await expect(page.getByRole("heading", { name: "Releases", level: 1 })).toBeVisible();
  await expect(page.locator(".sidebar")).toBeHidden();
});

test("Tables use the ThryveMS footer: rows per page and Previous / Page x of y / Next", async ({ page }) => {
  await page.goto("/#/dev/organisations");
  const footer = page.locator(".table-footer").first();
  await expect(footer.getByLabel("Rows per page")).toBeVisible();
  await expect(footer.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await expect(footer).toContainText(/Page 1 of \d+/);
  await footer.getByRole("button", { name: "Next page" }).click();
  await expect(footer).toContainText(/Page 2 of/);
});
