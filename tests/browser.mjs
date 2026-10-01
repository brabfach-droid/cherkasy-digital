import { createServer } from "vite";
const devServer = await createServer({
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  logLevel: "error",
});
await devServer.listen();
import { chromium } from "playwright";
import Chromium from "@sparticuz/chromium";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: await Chromium.executablePath(),
  args: Chromium.args,
  headless: true,
});
const page = await browser.newPage();
await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir(new URL("../test-results/", import.meta.url), { recursive: true });
const base = process.env.TEST_URL || "http://127.0.0.1:5174/cherkasy-digital/";
for (const width of [1440, 1024, 768, 375, 320]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const route of [
    "",
    "services",
    "services/demo-consultation",
    "news",
    "news/demo-portal",
    "documents",
    "documents/demo-guide",
    "events",
    "events/demo-event",
    "help",
    "now",
    "appeals",
    "search?q=демо",
    "auth/login",
    "auth/register",
    "auth/forgot-password",
    "privacy",
    "does-not-exist",
    "status/invalid",
    "display",
  ]) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    try{await page.waitForSelector("main h1",{timeout:10000});}catch(e){console.error({width,route,errors,body:await page.locator("body").innerText()});throw e;}
    await page.waitForTimeout(200);
    assert.ok(
      await page.locator("main h1").innerText(),
      "Missing heading " + route,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      "Horizontal overflow " + width + " " + route,
    );
  }
  await page.goto(base);
  await page.waitForSelector(".category");
  await page.screenshot({
    path: new URL("../test-results/home-" + width + ".png", import.meta.url)
      .pathname,
    fullPage: true,
  });
  if (width < 1024) {
    await page.getByRole("button", { name: "Відкрити меню" }).click();
    assert.ok(await page.locator(".main-nav").isVisible());
    await page
      .locator(".main-nav")
      .getByText("Послуги", { exact: true })
      .click();
    await page.waitForURL("**/services");
    await page.locator(".main-nav").waitFor({ state: "hidden" });
  }
}
for (const route of [
  "account",
  "staff",
  "admin",
  "services/demo-consultation/apply",
]) {
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/auth/login?next=*");
  await page.getByRole("heading", { name: "Раді бачити вас" }).waitFor();
}
await page.goto(base + "services");
await page.getByRole("searchbox").fill("неіснуючийматеріал");
await page
  .getByRole("heading", { name: "За вашими фільтрами нічого не знайдено" })
  .waitFor();
assert.deepEqual(errors, []);
console.log(
  "PASS: desktop/tablet/mobile routes, menu, filters, empty state, auth guards, zero page errors, zero horizontal overflow",
);
await browser.close();
await devServer.close();
