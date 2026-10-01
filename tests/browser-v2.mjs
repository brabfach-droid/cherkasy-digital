import { preview } from "vite";
import { chromium } from "playwright";
import Chromium from "@sparticuz/chromium";
import fs from "node:fs";
import assert from "node:assert/strict";
const server = await preview({
  preview: { host: "127.0.0.1", port: 5176, strictPort: true },
  logLevel: "error",
});
const browser = await chromium.launch({
  executablePath: await Chromium.executablePath(),
  args: Chromium.args,
  headless: true,
});
const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const data = JSON.parse(fs.readFileSync("public/demo.json", "utf8"));
let version = 1,
  type = "warning";
await context.route("**/demo.json", (r) =>
  r.fulfill({
    json: {
      ...data,
      announcements: [
        {
          id: "test-global",
          title: "Важливе повідомлення V2",
          message: "Тест верхньої плашки без перекриття інтерфейсу",
          placement: "global",
          type,
          active: true,
          dismissible: true,
          priority: 100,
          version,
        },
      ],
    },
  }),
);
const base = "http://127.0.0.1:5176/cherkasy-digital/";
await page.goto(base);
await page.locator(".global-announcement").waitFor();
await page.waitForTimeout(500);
const banner = await page.locator(".global-announcement").boundingBox(),
  header = await page.locator(".site-header").boundingBox();
assert.ok(header.y >= banner.y + banner.height - 1);
await page.getByRole("button", { name: "Закрити важливе оголошення" }).click();
await page.locator(".global-announcement").waitFor({ state: "detached" });
await page.reload();
await page.locator("h1").first().waitFor();
await page.waitForTimeout(500);
assert.equal(await page.locator(".global-announcement").count(), 0);
version++;
await page.reload();
await page.locator(".global-announcement").waitFor();
await page.screenshot({
  path: "test-results/v2-banner-mobile.png",
  fullPage: true,
});
await page.getByRole("button", { name: /Сповіщення:/ }).click();
await page.getByText("Усі сповіщення →").waitFor();
await page.keyboard.press("Escape");
type = "critical";
version++;
await page.reload();
await page.locator(".global-announcement.critical").waitFor();
assert.equal(
  await page
    .getByRole("button", { name: "Закрити важливе оголошення" })
    .count(),
  0,
);
await page.goto(base + "display");
await page.locator(".display-critical").waitFor();
await page.waitForTimeout(500);
assert.ok(await page.locator(".display-critical").innerText());
await page.setViewportSize({ width: 1920, height: 1080 });
await page.screenshot({ path: "test-results/v2-display.png", fullPage: true });
await page.goto(base + "documents/demo-guide");
await page.locator(".qr img").waitFor();
assert.ok(
  (await page.locator(".qr img").getAttribute("src")).startsWith(
    "data:image/png",
  ),
);
await page.emulateMedia({ reducedMotion: "reduce" });
assert.ok(
  await page.evaluate(
    () =>
      parseFloat(
        getComputedStyle(
          document.querySelector(".button") || document.querySelector("button"),
        ).transitionDuration,
      ) < 0.01,
  ),
);
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
});
await page.reload();
await page.waitForTimeout(400);
const manifest = await page.evaluate(
  async () =>
    await (
      await fetch(document.querySelector('link[rel="manifest"]').href)
    ).json(),
);
assert.equal(manifest.scope, "/cherkasy-digital/");
assert.equal(manifest.icons.length, 2);
const entries = await page.evaluate(async () => {
  const out = [];
  for (const key of await caches.keys()) {
    const c = await caches.open(key);
    out.push(...(await c.keys()).map((r) => r.url));
  }
  return out;
});
assert.ok(entries.some((u) => u.endsWith("/offline.html")));
assert.ok(
  entries.every(
    (u) =>
      !u.includes("supabase") &&
      !u.includes("demo.json") &&
      !u.includes("/account/") &&
      !u.includes("/status/"),
  ),
);
await context.setOffline(true);
await page.goto(base + "news");
await page.getByRole("heading", { name: "Ви зараз офлайн" }).waitFor();
assert.deepEqual(errors, []);
console.log(
  "PASS V2 UI: banner layout/dismiss/version/critical, notification popover, display, QR, reduced motion, PWA manifest/cache allowlist and offline fallback",
);
await browser.close();
await new Promise((r) => server.httpServer.close(r));
