import { test, expect } from "@playwright/test";

const netProfit = async (page) => (await page.locator(".pl tr.net td.num").innerText()).trim();
const viewAs = (page, who) => page.getByLabel("Preview, view as").selectOption(who);

test("both workspaces show the same net profit for every period", async ({ page }) => {
  test.setTimeout(120_000);
  for (const period of ["2026-10", "2026-09", "2026-Q3", "2026-YTD"]) {
    await page.goto("/#/finance/profit");
    await viewAs(page, "developer");
    await page.goto("/#/finance/profit");
    await page.locator('[data-global="period"]').selectOption(period);
    const dev = await netProfit(page);
    await viewAs(page, "partner-a");
    await page.goto("/#/finance/profit");
    await page.locator('[data-global="period"]').selectOption(period);
    expect(await netProfit(page), "period " + period).toBe(dev);
    await viewAs(page, "partner-b");
    await page.goto("/#/finance/profit");
    await page.locator('[data-global="period"]').selectOption(period);
    expect(await netProfit(page), "period " + period).toBe(dev);
  }
  await expect(page.getByText("Same as the Developer Console.")).toBeVisible();
});

test("partners see totals but not other partners' client details or developer pages", async ({ page }) => {
  await page.goto("/#/overview");
  await viewAs(page, "partner-a");
  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Deployments" })).toHaveCount(0);
  await page.goto("/#/clients/list");
  await expect(page.getByRole("link", { name: "Arden & Co." })).toBeVisible();
  await expect(page.getByText("Pasig Electronics")).toHaveCount(0);
  await page.goto("/#/finance/revenue-expenses");
  await expect(page.getByText("Another partner’s client").first()).toBeVisible();
  await page.goto("/#/deployments/production");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.goto("/#/organisations/pasig");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await viewAs(page, "client");
  await expect(page.getByRole("heading", { name: "No access to the platform console" })).toBeVisible();
});

test("developer creates a sandbox without production side effects and it persists", async ({ page }) => {
  await page.goto("/#/deployments/sandboxes");
  await page.getByRole("button", { name: "Create sandbox" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Client (type a name to search)").fill("Calamba Precision");
  await expect(page.locator("#sb-source")).toHaveValue("prd-calamba-01");
  await dlg.getByLabel("Purpose").selectOption("Bug fix");
  await dlg.getByLabel("Issue or change reference").fill("SYNTH-101");
  await page.getByRole("button", { name: "Create preview sandbox" }).click();
  await expect(page.getByText(/SYNTH-101/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Request production promotion" })).toBeDisabled();
  await page.reload();
  await page.goto("/#/deployments/sandboxes");
  await expect(page.getByRole("cell", { name: "Calamba Precision", exact: true })).toBeVisible();
});

test("tables search, sort and paginate with 10 rows by default", async ({ page }) => {
  await page.goto("/#/finance/costs");
  await expect(page.getByText(/1–10 of \d+/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page.getByPlaceholder("Search vendor, client or reference").fill("Neon");
  await expect(page.locator('[data-tbody="costs"] tbody tr')).toHaveCount(1);
  await page.getByLabel("Rows per page").selectOption("50");
});

test("subscription change needs an effective date and reason", async ({ page }) => {
  await page.goto("/#/organisations/arden");
  await page.getByRole("button", { name: "Change subscription" }).first().click();
  await page.getByLabel("Purchased seats").fill("70");
  await page.getByRole("button", { name: "Save change" }).click();
  await expect(page.getByText("Choose the effective date.")).toBeVisible();
  await page.getByLabel("Effective date").fill("2026-11-01");
  await page.getByLabel("Reason").fill("Night shift");
  await page.getByRole("button", { name: "Save change" }).click();
  await page.getByRole("tab", { name: "Lifecycle history" }).click();
  await expect(page.getByText("Seats 60 → 70")).toBeVisible();
});

test("responsive screenshots at 390/768/1280/1920 in both appearances", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  for (const width of [390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [who, path] of [["developer", "/#/overview"], ["developer", "/#/finance/profit"], ["partner-a", "/#/overview"], ["partner-a", "/#/finance/profit"]]) {
      await page.goto(path);
      await viewAs(page, who);
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      for (const theme of ["light", "dark"]) {
        if ((await page.evaluate(() => document.documentElement.classList.contains("dark"))) !== (theme === "dark")) await page.getByRole("button", { name: "Toggle light and dark appearance" }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), who + " " + path + " " + width + " " + theme).toBeTruthy();
        await page.screenshot({ path: testInfo.outputPath(who + "-" + path.replace(/\W+/g, "-") + "-" + theme + "-" + width + ".png"), fullPage: true });
      }
    }
  }
});
