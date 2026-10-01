// Explicit network fixtures; no live Supabase writes.
import { createServer } from "vite";
import { chromium } from "playwright";
import Chromium from "@sparticuz/chromium";
import assert from "node:assert/strict";
import fs from "node:fs";
const endpoint = "https://live-fixture.supabase.co",
  server = await createServer({
    cacheDir: "/tmp/cherkasy-vite-live",
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(endpoint),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        "test-publishable-key",
      ),
    },
    server: { host: "127.0.0.1", port: 5177, strictPort: true },
    logLevel: "error",
  });
await server.listen();
const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || await Chromium.executablePath(),
    args: Chromium.args,
    headless: true,
  }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
const seed = JSON.parse(fs.readFileSync("public/demo.json", "utf8"));
let state = "active",
  age = 0,
  apiFailed = false,
  critical = false,
  requests = 0;
await page.route(endpoint + "/**", async (route) => {
  const u = new URL(route.request().url()),
    table = u.pathname.split("/").at(-1);
  let rows = seed[table] || [];
  if (table === "api_cache") {
    requests++;
    if (apiFailed)
      return route.fulfill({
        status: 503,
        json: { message: "Source unavailable" },
      });
    rows = [
      {
        id: "cache",
        key: "alerts",
        payload: {
          state,
          scope: "Черкаський район та Черкаська область",
          started_at: new Date(Date.now() - 600000).toISOString(),
        },
        refreshed_at: new Date(Date.now() - age).toISOString(),
      },
    ];
  }
  if (table === "announcements")
    rows = [
      {
        id: "maintenance",
        active: true,
        placement: "global",
        type: critical ? "critical" : "maintenance",
        priority: 1,
        title: "Технічні роботи",
        message: "Планове оновлення",
        dismissible: true,
        version: 1,
      },
    ];
  if (table === "city_status")
    rows = [
      {
        id: "work",
        is_active: true,
        type: "Роботи",
        severity: "warning",
        title: "Планові роботи",
        description: "Тест",
        updated_at: new Date(Date.now() - 480000).toISOString(),
      },
    ];
  if (table === "site_settings")
    rows = [
      {
        id: "display",
        key: "display",
        value: { blocks: ["city", "news"], interval: 5, theme: "dark" },
      },
    ];
  return route.fulfill({
    headers: {
      "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
    },
    json: rows,
  });
});
const base = "http://127.0.0.1:5177/cherkasy-digital/";
for (const width of [1440, 1024, 768, 375, 320]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(base);
  await page.locator(".air-alert-status.active").waitFor();
  await page.waitForTimeout(350);
  assert.ok(await page.locator(".air-alert-status").isVisible());
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "overflow " + width+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:String(e.className),x:Math.round(e.getBoundingClientRect().right)})).slice(0,12))),
  );
  await page.locator(".air-alert-status").click();
  await page.getByRole("dialog", { name: "Повітряна тривога" }).waitFor();
  assert.ok(
    (await page.locator(".air-detail").innerText()).includes(
      "Черкаський район",
    ),
  );
  await page.getByRole("button", { name: "Закрити вікно" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  if (width === 1440 || width === 375)
    await page.screenshot({
      path: `test-results/live-header-${width}.png`,
      fullPage: false,
    });
}
// Signage continues ordinary content during active alert.
for (const [width, height] of [
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
]) {
  await page.setViewportSize({ width, height });
  await page.goto(base + "display");
  await page.locator(".display-air.active").waitFor();
  await page.locator(".broadcast-overlay.alert").waitFor();
  await page
    .locator(".broadcast-overlay")
    .waitFor({ state: "detached", timeout: 12000 });
  assert.equal(await page.locator(".broadcast-overlay").count(), 0);
  const initial = await page
    .locator(".broadcast-rail>span")
    .first()
    .innerText();
  await page.waitForTimeout(5500);
  const after = await page.locator(".broadcast-rail>span").first().innerText();
  assert.notEqual(after, initial, "rotation stopped during alert");
  assert.ok(await page.locator(".display-air.active").isVisible());
  assert.ok(await page.locator(".broadcast-ticker").isVisible());
  assert.match(
    await page.locator(".broadcast-ticker").innerText(),
    /ПОВІТРЯНА ТРИВОГА/,
  );
  await page.screenshot({
    path: `test-results/broadcast-${width}.png`,
    fullPage: true,
  });

  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth + 1 &&
        document.documentElement.scrollHeight <= innerHeight + 1,
    ),
    "display viewport overflow",
  );
  await page.screenshot({ path: `test-results/broadcast-${width}.png` });
}
await page.setViewportSize({ width: 1920, height: 1080 });
// All-clear only follows a confirmed active -> inactive response.
apiFailed = true;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.locator(".display-air.unknown").waitFor();
assert.equal(await page.locator(".broadcast-overlay.clear").count(), 0);
apiFailed = false;
state = "inactive";
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.locator(".broadcast-overlay.clear").waitFor();
await page
  .locator(".broadcast-overlay")
  .waitFor({ state: "detached", timeout: 10000 });
assert.equal(await page.locator(".broadcast-overlay").count(), 0);
age = 180000;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.locator(".display-air.unknown").waitFor();
assert.equal(await page.locator(".broadcast-overlay.clear").count(), 0);
age = 0;
critical = true;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.locator(".broadcast.critical").waitFor();
await page.locator(".display-critical").waitFor({ timeout: 25000 });
await page.screenshot({ path: "test-results/broadcast-critical.png" });
await page.emulateMedia({ reducedMotion: "reduce" });
assert.equal(
  await page
    .locator(".display-atmosphere>span")
    .first()
    .evaluate((e) => getComputedStyle(e).animationName),
  "none",
);
// Cursor returns after movement and hides after inactivity.
await page.mouse.move(50, 50);
await page.waitForTimeout(3800);
assert.ok(await page.locator(".broadcast.cursor-hidden").count());
await page.mouse.move(60, 60);
assert.equal(await page.locator(".broadcast.cursor-hidden").count(), 0);
const before = requests;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.waitForTimeout(600);
assert.equal(requests - before, 1);
assert.deepEqual(errors, []);
console.log(
  "PASS BROADCAST: global header, four TV resolutions, alert overlay 7s, active-alert content rotation/ticker, all-clear 5s, unknown/stale, critical scene, cursor, reduced motion, shared polling",
);
await browser.close();
await server.close();
