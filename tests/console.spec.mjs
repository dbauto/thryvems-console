import { test, expect } from "@playwright/test";

const setUi = async (page, patch) => {
  await page.goto("/");
  await page.evaluate((p) => { const k = "thryvems.console.ui.v1"; const u = JSON.parse(localStorage.getItem(k) || "{}"); localStorage.setItem(k, JSON.stringify({ ...u, signedIn: true, ...p })); }, patch);
  await page.reload();
};
const asRole = (page, role) => setUi(page, role === "developer" ? { role: "developer", email: "owner@platform.example" } : role === "client" ? { role: "client", email: "" } : { role: "partner", partner: role, email: role + "@partners.example" });
const h1 = (page) => page.locator("main h1").first();
const sheet = (page) => page.locator("#dialog-root [role=dialog]");
const pickClient = async (page, id, name) => { await page.fill(id, name); await page.locator(id).dispatchEvent("change"); };

test.describe("access separation", () => {
  test("partners and client users get Not found on every Developer URL", async ({ page }) => {
    for (const role of ["partner-a", "partner-b", "client"]) {
      await asRole(page, role);
      for (const r of ["#/dev", "#/dev/finance?tab=costs", "#/dev/deployments", "#/dev/sandboxes/sb-1001", "#/dev/organisations/c-demo-manufacturing"]) {
        await page.goto("/" + r);
        await expect(h1(page)).toHaveText("Page not found");
        await expect(page.locator(".nav a")).toHaveCount(role === "client" ? 0 : 0);
      }
    }
  });
  test("client users can't open the Business workspace either", async ({ page }) => {
    await asRole(page, "client");
    await page.goto("/#/biz");
    await expect(h1(page)).toHaveText("Page not found");
  });
  test("developer can inspect the Business workspace read-only", async ({ page }) => {
    await page.goto("/#/biz/requests");
    await expect(page.getByText("Inspection view")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request subscription change" })).toBeDisabled();
  });
});

test.describe("partner assignment isolation", () => {
  test("Partner A never sees Partner B's client in lists, search, counts or detail", async ({ page }) => {
    await asRole(page, "partner-a");
    await page.goto("/#/biz/clients");
    await page.fill("#bz-clients-q", "Example Logistics");
    await expect(page.getByText("No matching records")).toBeVisible();
    await page.goto("/#/biz/clients/c-example-logistics");
    await expect(h1(page)).toHaveText("Page not found");
    await page.goto("/#/biz");
    const assigned = Number(await page.getByTestId("bz-assigned").locator("strong").textContent());
    await page.goto("/#/biz/clients");
    await page.fill("#bz-clients-q", "");
    await expect(page.getByTestId("bz-clients-count")).toContainText("of " + assigned + " record");
    await asRole(page, "partner-b");
    await page.goto("/#/biz/clients/c-example-logistics");
    await expect(h1(page)).toHaveText("Example Logistics");
    await page.goto("/#/biz/clients/c-demo-manufacturing");
    await expect(h1(page)).toHaveText("Page not found");
  });
});

test.describe("financial privacy", () => {
  test("partners see the same shared net profit as the Developer", async ({ page }) => {
    await page.goto("/#/dev/finance");
    const dev = await page.getByTestId("sp-net").locator("strong").textContent();
    for (const role of ["partner-a", "partner-b"]) {
      await asRole(page, role);
      await page.goto("/#/biz/finance");
      await expect(page.getByTestId("sp-net").locator("strong")).toHaveText(dev);
    }
  });
  test("partners never see other partners' client details", async ({ page }) => {
    await asRole(page, "partner-a");
    await page.goto("/#/biz/finance?tab=profit&view=client");
    const text = await page.locator("main").innerText();
    expect(text).not.toContain("Example Logistics");
    await page.goto("/#/biz/finance?tab=reports");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const csv = await page.evaluate(() => window.__lastExport);
    expect(csv.split("\n")[0]).toBe('"line","amount_php"');
    expect(csv).not.toContain("Example Logistics");
  });
});

test.describe("record-derived figures", () => {
  test("overview client count equals the non-archived organisations list", async ({ page }) => {
    await page.goto("/#/dev");
    const n = Number(await page.getByTestId("kpi-clients").locator("strong").textContent());
    await page.getByTestId("kpi-clients").click();
    await page.selectOption("#sf-org-status", "Archived");
    const archived = Number((await page.getByTestId("orgs-count").textContent()).match(/of (\d+)/)?.[1] || 0);
    await page.selectOption("#sf-org-status", "");
    const total = Number((await page.getByTestId("orgs-count").textContent()).match(/of (\d+)/)[1]);
    expect(total - archived).toBe(n);
    expect(total).toBeGreaterThanOrEqual(50);
  });
});

test.describe("accounts and provisioning", () => {
  test("creating an account never creates a deployment; simulation never sets Live", async ({ page }) => {
    await page.goto("/#/dev/organisations");
    await page.getByRole("button", { name: "Create organisation" }).click();
    await page.fill("#o-name", "Synthetic Test Works");
    await page.selectOption("#o-partner", "partner-a");
    await page.fill("#o-seats", "12");
    await page.fill("#o-cemail", "admin@synthetic.example");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(h1(page)).toHaveText("Synthetic Test Works");
    await expect(page.locator(".page-header").getByText("Account created")).toBeVisible();
    await page.getByRole("link", { name: "Deployment", exact: true }).click();
    await expect(page.getByText("Not provisioned").first()).toBeVisible();
    await page.getByRole("button", { name: "Request provisioning" }).click();
    await page.fill("#w-reason", "Client signed");
    await page.getByRole("button", { name: "Check configuration" }).click();
    await page.getByRole("button", { name: "Continue to review" }).click();
    await page.getByRole("button", { name: "Submit provisioning request" }).click();
    await page.getByRole("button", { name: "Approve provisioning" }).click();
    await page.fill("#cr-reason", "Approved");
    await sheet(page).getByRole("button", { name: "Approve provisioning" }).click();
    await page.getByRole("button", { name: "Run provisioning simulation" }).click();
    await expect(page.getByText("Simulation passed").first()).toBeVisible();
    await expect(page.locator(".page-header .pill").first()).toHaveText("Approved");
    await page.getByRole("button", { name: "Simulate a failure" }).click();
    await expect(page.locator(".page-header .pill").first()).toHaveText("Failed");
  });
  test("subscription seats are validated and changes are recorded", async ({ page }) => {
    await page.goto("/#/dev/organisations/c-demo-manufacturing?tab=subscription");
    await page.getByRole("button", { name: "Change plan or seats" }).click();
    await page.fill("#s-seats", "3");
    await page.fill("#s-reason", "Test");
    await page.getByRole("button", { name: "Save change" }).click();
    await expect(page.locator("#form-error")).toContainText("24 active users");
    await page.fill("#s-seats", "40");
    await page.getByRole("button", { name: "Save change" }).click();
    await expect(page.getByText("Purchased seats: 32 → 40")).toBeVisible();
  });
  test("partner seat request is approved by the developer and applied", async ({ page }) => {
    await asRole(page, "partner-a");
    await page.goto("/#/biz/clients/c-demo-manufacturing?tab=subscription");
    await page.getByRole("button", { name: "Request subscription change" }).click();
    await page.fill("#br-seats", "150");
    await page.fill("#br-reason", "Growth");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.locator("#form-error")).toContainText("above your authority");
    await page.fill("#br-seats", "36");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await page.goto("/#/biz/requests");
    await expect(page.getByText("Change subscription for Demo Manufacturing")).toBeVisible();
    await asRole(page, "developer");
    await page.goto("/#/dev/requests");
    await page.fill("#requests-q", "Demo Manufacturing");
    await page.getByRole("button", { name: "Approve" }).first().click();
    await page.fill("#rq-reason", "Approved");
    await page.getByRole("button", { name: "Approve request" }).click();
    await page.goto("/#/dev/organisations/c-demo-manufacturing?tab=subscription");
    await expect(page.getByText("Purchased seats: 32 → 36")).toBeVisible();
  });
});

test.describe("sandbox and release workflow", () => {
  test("create, version, test, compare, review, promote and retire a sandbox", async ({ page }) => {
    await page.goto("/#/dev/deployments?tab=sandboxes");
    await page.getByRole("button", { name: "Create sandbox" }).first().click();
    await pickClient(page, "#sb-client", "Sample Services");
    await expect(page.getByTestId("sb-source")).toContainText("v1.8.1");
    await page.selectOption("#sb-target", "1.8.2");
    await page.fill("#sb-name", "sample-services-synth101");
    await page.fill("#sb-reference", "not a reference");
    await page.getByRole("button", { name: "Create sandbox" }).last().click();
    await expect(page.locator("#form-error")).toContainText("issue or change reference");
    await page.fill("#sb-reference", "SYNTH-101");
    await page.getByRole("button", { name: "Create sandbox" }).last().click();
    await expect(h1(page)).toHaveText("sample-services-synth101");
    await expect(page.locator(".page-header").getByText("Requested")).toBeVisible();
    await page.getByRole("button", { name: "Advance simulation" }).click();
    await page.getByRole("button", { name: "Advance simulation" }).click();
    await expect(page.locator(".page-header").getByText("Ready", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Compare with production" }).click();
    await expect(page.getByRole("row", { name: /Application version v1.8.1 v1.8.2 Different/ })).toBeVisible();
    await page.getByRole("link", { name: "Test results" }).click();
    await expect(page.getByRole("button", { name: "Run tests" })).toBeDisabled();
    await page.getByRole("button", { name: "Record test result" }).click();
    await page.getByRole("button", { name: "Record result" }).click();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await page.getByRole("button", { name: "Approve review" }).click();
    await page.fill("#rv-reason", "Checks passed");
    await page.getByRole("button", { name: "Approve review" }).last().click();
    await page.getByRole("link", { name: "Release readiness" }).click();
    await expect(page.getByRole("button", { name: "Deploy to production" })).toBeDisabled();
    await page.getByRole("button", { name: "Request production promotion" }).first().click();
    await page.fill("#pr-reason", "Ship");
    await page.getByRole("button", { name: "Request promotion" }).click();
    await page.reload();
    await expect(page.getByText("Promotion requested")).toBeVisible();
    await page.getByRole("button", { name: "Retire sandbox" }).click();
    await page.fill("#rt-reason", "Done");
    await page.getByRole("button", { name: "Retire sandbox" }).last().click();
    await expect(page.locator(".page-header").getByText("Retired")).toBeVisible();
  });
  test("release approval needs a validated sandbox and never deploys", async ({ page }) => {
    await page.goto("/#/dev/releases/1.9.0-rc.1");
    await page.getByRole("button", { name: "Approve release" }).click();
    await page.fill("#ra-reason", "Ready");
    await page.getByRole("button", { name: "Approve release" }).last().click();
    await expect(page.locator("#form-error")).toContainText("Approve a sandbox review");
    await page.goto("/#/dev/sandboxes/sb-1001");
    await page.getByRole("button", { name: "Approve review" }).click();
    await page.fill("#rv-reason", "Approved");
    await page.getByRole("button", { name: "Approve review" }).last().click();
    await page.goto("/#/dev/releases/1.9.0-rc.1");
    await page.getByRole("button", { name: "Approve release" }).click();
    await page.fill("#ra-reason", "Ready");
    await page.getByRole("button", { name: "Approve release" }).last().click();
    await expect(page.getByRole("button", { name: "Deploy to production" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Roll back clients" })).toBeDisabled();
  });
});

test.describe("states and placeholders", () => {
  test("loading, empty and error states render", async ({ page }) => {
    await setUi(page, { dataState: "Loading" }); await page.goto("/#/dev/organisations");
    await expect(page.getByRole("status").first()).toBeAttached();
    await setUi(page, { dataState: "Empty" }); await page.goto("/#/dev/organisations");
    await expect(page.getByText("No organisations")).toBeVisible();
    await setUi(page, { dataState: "Error" }); await page.goto("/#/dev/organisations");
    await expect(page.getByText("This page couldn't load")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(h1(page)).toHaveText("Organisations");
  });
  test("cloud-dependent controls are disabled, not fake successes", async ({ page }) => {
    await page.goto("/#/dev/jobs");
    for (const b of await page.getByRole("button", { name: "Run now" }).all()) await expect(b).toBeDisabled();
    await page.goto("/#/dev/finance?tab=revenue");
    await page.locator("[data-act=open-invoice]").first().click();
    await expect(sheet(page).getByRole("button", { name: /online/ })).toBeDisabled();
  });
});

test("responsive and themed screenshots without overflow", async ({ page }, info) => {
  const pages = [["developer", "developer", ["#/dev", "#/dev/organisations", "#/dev/deployments", "#/dev/sandboxes/sb-1001", "#/dev/releases", "#/dev/finance", "#/dev/requests", "#/dev/team"]], ["partner", "partner-a", ["#/biz", "#/biz/clients", "#/biz/finance", "#/biz/requests"]]];
  for (const width of [390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [label, role, routes] of pages) {
      await asRole(page, role);
      for (const theme of ["light", "dark"]) {
        if (theme === "dark") await page.getByRole("button", { name: "Toggle light and dark appearance" }).click();
        for (const r of routes) {
          await page.goto("/" + r);
          await expect(h1(page)).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), r + " at " + width).toBeTruthy();
          if (width === 390 || width === 1280) await page.screenshot({ path: info.outputPath(label + "-" + r.replace(/[^a-z0-9]+/gi, "_") + "-" + theme + "-" + width + ".png"), fullPage: true });
        }
        if (theme === "dark") await page.getByRole("button", { name: "Toggle light and dark appearance" }).click();
      }
    }
  }
});

test.describe("sign-in", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("signed-out visitors see the sign-in page; Sign in opens the workspace for the account", async ({ page }) => {
    await page.goto("/#/dev/finance");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("text=Preview")).toHaveCount(0);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("main h1").first()).toHaveText("Developer overview");
    await page.getByLabel("Account menu").click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByText("You've been signed out.")).toBeVisible();
    await page.fill("#login-email", "partner-b@partners.example");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("main h1").first()).toHaveText("Business overview");
    await page.goto("/#/dev");
    await expect(page.locator("main h1").first()).toHaveText("Page not found");
  });
});

test("Finance overview shows revenue and expense bars with a net profit line in both workspaces", async ({ page }) => {
  for (const [role, url] of [["developer", "/#/dev/finance"], ["partner-a", "/#/biz/finance"]]) {
    await asRole(page, role);
    await page.goto(url);
    const chart = page.getByTestId("profit-chart");
    await expect(chart).toBeVisible();
    await expect(chart.locator("rect.pc-rev")).toHaveCount(4);
    await expect(chart.locator("rect.pc-exp")).toHaveCount(4);
    await expect(chart.locator("circle.pc-dot")).toHaveCount(4);
  }
});

test("Developer controls what a partner sees; hidden areas and clients simply don't exist for the partner", async ({ page }) => {
  await page.goto("/#/dev/team?tab=partner-access&partner=partner-a");
  await page.getByLabel("Only the clients I select").check();
  await page.getByRole("button", { name: "Clear" }).click();
  await page.locator("[name=pa-client]").first().check();
  const kept = (await page.locator("[name=pa-client]").first().locator("xpath=..").innerText()).split("\n")[0].replace(/\s+(Active|Trial|Past due|Cancelled|Not started).*$/, "").trim();
  await page.locator("label", { hasText: "Invoices" }).locator("input").uncheck();
  await page.locator("label", { hasText: "Business settings" }).locator("input").uncheck();
  await page.fill("#pa-reason", "Limit Partner A to one pilot client");
  await page.getByRole("button", { name: "Save access" }).click();
  await expect(page.getByTestId("pa-shared").locator("strong")).toHaveText("1");
  await asRole(page, "partner-a");
  await page.goto("/#/biz/clients");
  await expect(page.getByTestId("bz-clients-count")).toContainText("of 1 record");
  await expect(page.locator(".sidebar .nav a[aria-label='Business settings']")).toHaveCount(0);
  await page.goto("/#/biz/finance");
  await expect(page.locator("main .view-chips a", { hasText: "Invoices" })).toHaveCount(0);
  await page.goto("/#/biz/finance?tab=invoices");
  await expect(page.locator("main h1").first()).toHaveText("Page not found");
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/restricted|limited access|hidden by|not shared with you/i);
  expect(kept.length).toBeGreaterThan(0);
});
