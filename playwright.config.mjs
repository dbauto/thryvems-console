import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir:"./tests",testMatch:"**/*.spec.mjs",timeout:30000,retries:0,
  reporter:[["list"],["github"],["html",{open:"never",outputFolder:"playwright-report"}]],
  use:{baseURL:"http://127.0.0.1:4173",...devices["Desktop Chrome"],storageState:{cookies:[],origins:[{origin:"http://127.0.0.1:4173",localStorage:[{name:"thryvems.console.ui.v1",value:JSON.stringify({signedIn:true,email:"owner@platform.example",role:"developer"})}]}]}},
  webServer:{command:"python3 -m http.server 4173 --directory dist",port:4173,reuseExistingServer:!process.env.CI,timeout:20000}
});
