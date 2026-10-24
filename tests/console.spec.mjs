import { test, expect } from "@playwright/test";
test("developer previews a sandbox without production side effects",async ({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Developer overview"})).toBeVisible();
  await page.getByRole("button",{name:"Deployments",exact:true}).first().click();
  await page.getByRole("button",{name:"+ Create sandbox"}).click();
  await expect(page.locator("input[disabled]")).toHaveValue("Synthetic sample data only");
  await page.getByLabel("Client (type a name to search)").fill("Sample Services");
  await page.getByLabel("Change type").selectOption("Bug fix");
  await page.getByLabel("Issue or change reference").fill("SYNTH-101");
  await page.getByRole("button",{name:"Create preview sandbox"}).click();
  await expect(page.getByText(/SYNTH-101/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Promote"}).first()).toBeDisabled();
  await expect(page.getByText("Sample Services · Sandbox")).toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:"Deployments",exact:true}).first().click();
  await expect(page.getByText("Sample Services · Sandbox")).toBeVisible();
});
test("partner assignment hides other partners and developer pages",async ({page})=>{
  await page.goto("/");
  await page.getByLabel("Preview, view as").selectOption("partner-a");
  await expect(page.getByRole("heading",{name:"Business overview"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Deployments"})).toHaveCount(0);
  await page.getByRole("button",{name:"Clients",exact:true}).first().click();
  await expect(page.getByText("Demo Manufacturing")).toBeVisible();
  await expect(page.getByText("Example Logistics")).toHaveCount(0);
  await page.getByLabel("Preview, view as").selectOption("partner-b");
  await page.getByRole("button",{name:"Clients",exact:true}).first().click();
  await expect(page.getByText("Example Logistics")).toBeVisible();
  await expect(page.getByText("Demo Manufacturing")).toHaveCount(0);
  await page.getByLabel("Preview, view as").selectOption("client");
  await expect(page.getByRole("heading",{name:"Page not found"})).toBeVisible();
});
test("partner finance hides infrastructure figures",async ({page})=>{
  await page.goto("/");
  await page.getByLabel("Preview, view as").selectOption("partner-a");
  await page.getByRole("button",{name:"Finance",exact:true}).first().click();
  await expect(page.getByRole("heading",{name:"Finance"})).toBeVisible();
  await expect(page.getByRole("columnheader",{name:"Infrastructure"})).toHaveCount(0);
  await expect(page.getByText("Actual operating profit")).toHaveCount(0);
  await expect(page.getByText("Partner allocation · 70%")).toBeVisible();
});
test("responsive screenshots at 390/768/1280/1920 in both appearances",async ({page},testInfo)=>{
  for(const width of [390,768,1280,1920]){
    await page.setViewportSize({width,height:850});
    await page.goto("/");
    await expect(page.getByRole("heading",{name:"Developer overview"})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    await page.screenshot({path:testInfo.outputPath("developer-light-"+width+".png"),fullPage:true});
    await page.getByRole("button",{name:"Toggle light and dark appearance"}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
    await page.screenshot({path:testInfo.outputPath("developer-dark-"+width+".png"),fullPage:true});
  }
});
