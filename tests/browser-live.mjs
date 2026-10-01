// Explicit network fixtures; no live Supabase writes.
import { createServer } from "vite";
import { chromium } from "playwright";
import Chromium from "@sparticuz/chromium";
import assert from "node:assert/strict";
import fs from "node:fs";
const endpoint = "https://live-fixture.supabase.co",
  server = await createServer({
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
    executablePath: await Chromium.executablePath(),
    args: Chromium.args,
    headless: true,
  }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
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
    "overflow " + width,
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
await page.setViewportSize({ width: 1920, height: 1080 });
await page.goto(base + "display");
await page.locator(".live-display.alert").waitFor();
await page.waitForTimeout(400);
assert.match(await page.locator(".display-scene h1").innerText(), /ПОВІТРЯНА/);
await page.screenshot({
  path: "test-results/live-display-alert.png",
  fullPage: true,
});
assert.ok(
  (await page.locator(".display-live-modules").innerText()).includes(
    "8 хв тому",
  ),
);
// Error must show unknown, not an all-clear scene.
apiFailed = true;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.locator(".live-display.warning").waitFor();
assert.equal(await page.locator(".live-display.all-clear").count(), 0);
assert.match(await page.locator(".display-air").innerText(), /невідомий/);
apiFailed = false;
state = "inactive";
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.locator(".live-display.all-clear").waitFor();
await page.waitForTimeout(8500);
await page.locator(".live-display.warning").waitFor();
assert.equal(await page.locator(".live-display.alert").count(), 0);
age = 180000;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.locator(".display-air.unknown").waitFor();
assert.equal(await page.locator(".live-display.all-clear").count(), 0);
age = 0;
critical = true;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.locator(".live-display.critical").waitFor();
await page.waitForTimeout(350);
await page.screenshot({
  path: "test-results/live-display-critical.png",
  fullPage: true,
});
critical = false;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.locator(".live-display.warning").waitFor();
await page.waitForTimeout(6000);
assert.match(
  await page.locator(".display-scene h1").innerText(),
  /Останні новини|Місто реагує/,
);
await page.screenshot({
  path: "test-results/live-display-normal.png",
  fullPage: true,
});
await page.emulateMedia({ reducedMotion: "reduce" });
assert.equal(
  await page
    .locator(".display-atmosphere>span")
    .first()
    .evaluate((e) => getComputedStyle(e).animationName),
  "none",
);
// At most one source request per refresh despite multiple widgets.
const before = requests;
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.waitForTimeout(600);
assert.equal(requests - before, 1);
assert.deepEqual(errors, []);
console.log(
  "PASS LIVE: header five sizes, simultaneous announcement + alert, details, alert priority, unknown/stale, confirmed all-clear 8s, critical, rotation, real freshness, reduced motion, shared source polling",
);
await browser.close();
await server.close();
