// UI-only network fixtures. Real server authorization is covered by database.mjs, not these fixtures.
import { createServer } from "vite";
import { chromium } from "playwright";
import Chromium from "@sparticuz/chromium";
import fs from "node:fs";
import assert from "node:assert/strict";
const url = "https://ui-fixture.supabase.co";
const server = await createServer({
  cacheDir: "/tmp/cherkasy-vite-auth",
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
      "test-publishable-key",
    ),
  },
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
  logLevel: "error",
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || await Chromium.executablePath(),
  args: Chromium.args,
  headless: true,
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const seed = JSON.parse(fs.readFileSync("public/demo.json", "utf8"));
for (const r of seed.departments) r.active ??= true;
const uid = "11111111-1111-4111-8111-111111111111",
  aid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const profile = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  user_id: uid,
  email: "test@example.invalid",
  first_name: "Тест",
  last_name: "Мешканець",
  blocked: false,
  created_at: new Date().toISOString(),
};
const svc = seed.services[0];
seed.profiles = [profile];
seed.user_roles = [{ id: "role1", user_id: uid, role_name: "super_admin" }];
seed.staff_departments = [
  { id: "department1", user_id: uid, department_id: svc.department_id },
];
seed.applications = [
  {
    id: aid,
    user_id: uid,
    service_id: svc.id,
    department_id: svc.department_id,
    number: "CK-2026-000001",
    status: "submitted",
    data: {
      name: "Тест",
      email: profile.email,
      description: "Демонстраційний текст",
      subject: "Консультація",
      consent: true,
    },
    form_snapshot: seed.service_form_fields.filter(
      (f) => f.form_id === seed.service_forms[0].id,
    ),
    created_at: new Date().toISOString(),
  },
];
seed.application_status_history = [
  {
    id: "history1",
    application_id: aid,
    new_status: "submitted",
    created_at: new Date().toISOString(),
  },
];
seed.notifications = [
  {
    id: "note1",
    user_id: uid,
    title: "Тестове сповіщення",
    message: "Перевірка центру",
    read_at: null,
    link: "/account/applications/" + aid,
  },
];
seed.audit_logs = [
  {
    id: "audit1",
    entity: "services",
    action: "INSERT",
    metadata: {},
    created_at: new Date().toISOString(),
  },
];
seed.saved_services = [];
seed.appeals = [];
seed.user_addresses = [];
seed.user_documents = [];
const session = {
  access_token:
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(
      JSON.stringify({
        sub: uid,
        role: "authenticated",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".fixture",
  refresh_token: "test-refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: uid,
    email: profile.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: { first_name: "Тест" },
    created_at: new Date().toISOString(),
  },
};
await page.addInitScript(
  (s) => localStorage.setItem("sb-ui-fixture-auth-token", JSON.stringify(s)),
  session,
);
await page.route(url + "/**", async (route) => {
  const req = route.request(),
    u = new URL(req.url());
  const headers = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "content-range",
    "content-type": "application/json",
  };
  if (req.method() === "OPTIONS")
    return route.fulfill({ status: 200, headers, body: "" });
  if (u.pathname.includes("/auth/v1/user"))
    return route.fulfill({ headers, body: JSON.stringify(session.user) });
  if (u.pathname.includes("/auth/v1/"))
    return route.fulfill({ headers, body: JSON.stringify(session) });
  const table = u.pathname.split("/").pop();
  if (u.pathname.includes("/rpc/")) {
    const body = req.postDataJSON() || {};
    let result = null;
    if(table==='application_service')result=[svc];
    if(table==='application_assignees'||table==='staff_directory')result=[{user_id:uid,name:'Тестовий Працівник'}];
    if(['application_linked_documents','document_usage'].includes(table))result=[];
    if(table==='set_application_metadata'){const a=seed.applications.find(v=>v.id===body.p_id);Object.assign(a,{priority:body.p_priority,deadline:body.p_deadline})}
    if(table==='change_application'){const a=seed.applications.find(v=>v.id===body.p_id);Object.assign(a,{status:body.p_status,assignee_id:body.p_assignee})}

    if (table === "save_draft") {
      result = body.p_id || "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      const existing = seed.applications.find((r) => r.id === result);
      if (existing) existing.data = body.p_data;
      else
        seed.applications.push({
          id: result,
          user_id: uid,
          service_id: svc.id,
          department_id: svc.department_id,
          status: "draft",
          data: body.p_data,
          form_snapshot: seed.applications[0].form_snapshot,
          created_at: new Date().toISOString(),
        });
    }
    if (table === "submit_application") {
      result = "CK-2026-000002";
      const r = seed.applications.find((r) => r.id === body.p_id);
      r.status = "submitted";
      r.number = result;
    }
    return route.fulfill({ headers, body: JSON.stringify(result) });
  }
  let rows = [...(seed[table] || [])];
  for (const [k, v] of u.searchParams) {
    if (v.startsWith("eq."))
      rows = rows.filter((r) => String(r[k]) === v.slice(3));
    if (v === "is.null") rows = rows.filter((r) => r[k] == null);
    if (v === "not.is.null") rows = rows.filter((r) => r[k] != null);
    if (v.startsWith("neq."))
      rows = rows.filter((r) => String(r[k]) !== v.slice(4));
  }
  if (req.method() === "PATCH") {
    const body = req.postDataJSON();
    assert.equal("id" in body, false, "PATCH should identify row in URL");
    for (const r of rows) Object.assign(r, body);
    return route.fulfill({
      headers,
      json: req.headers().accept?.includes("vnd.pgrst.object") ? rows[0] : rows,
    });
  }
  if (req.method() === "DELETE") {
    seed[table] = (seed[table] || []).filter(
      (r) => !rows.some((x) => x.id === r.id),
    );
    return route.fulfill({ headers, json: rows.map((r) => ({ id: r.id })) });
  }
  if (req.method() === "POST") {
    const b = req.postDataJSON();
    const values = Array.isArray(b) ? b : [b];
    for (const r of values) {
      r.id ??= crypto.randomUUID();
      const i = (seed[table] || []).findIndex((x) => x.id === r.id);
      seed[table] ??= [];
      if (i >= 0) seed[table][i] = { ...seed[table][i], ...r };
      else seed[table].push(r);
    }
    return route.fulfill({
      headers,
      body: JSON.stringify(
        req.headers().accept?.includes("vnd.pgrst.object") ? values[0] : values,
      ),
    });
  }
  headers["content-range"] =
    "0-" + Math.max(rows.length - 1, 0) + "/" + rows.length;
  return route.fulfill({ headers, body: JSON.stringify(rows) });
});
await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
await page.route("https://fonts.gstatic.com/**", (r) => r.abort());
const base = "http://127.0.0.1:5175/cherkasy-digital/";
for (const width of process.env.UI_QUICK ? [] : [1920,1440,1024,768,430,390]) {
  await page.setViewportSize({ width, height: 1000 });
  for (const p of [
    "account",
    "account/profile",
    "account/addresses",
    "account/documents",
    "account/saved",
    "account/security",
    "account/notifications",
    "account/activity",
    "admin/important-announcements",
    "admin/verifications",
    "account/applications/" + aid,
    "staff",
    "staff/applications",
    "staff/applications/" + aid,
    "admin",
    "admin/services",
    "admin/news",
    "admin/documents",
    "admin/events",
    "admin/forms",
    "admin/settings",
    "admin/display",
    "admin/users",
    "admin/audit",
    "admin/appeals",
  ]) {
    await page.goto(base + p, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main h1");
    await page.waitForTimeout(100);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `overflow ${width} ${p}`,
    );
  }
}
await page.goto(base + "admin/services");
await page.getByRole("button", { name: "Створити", exact: true }).click();
await page.getByRole("dialog").waitFor();
await page.getByLabel("Назва *", { exact: true }).fill("Тестова послуга");
await page.getByLabel("Адреса (slug) *").fill("test-service");
await page.getByRole("button", { name: "Попередній перегляд" }).click();
await page
  .getByRole("heading", { name: "Тестова послуга", exact: true })
  .waitFor();
await page.getByRole("button", { name: "Назад до редактора" }).click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Зберегти", exact: true })
  .click();
await page.getByRole("dialog").waitFor({ state: "hidden" });
await page.goto(base + "admin/forms");
await page.getByLabel("Послуга", { exact: false }).selectOption(svc.id);
await page.getByRole("heading", { name: "Поле 1", exact: true }).waitFor();
await page.getByRole("button", { name: "Переглянути форму" }).click();
await page.getByRole("dialog").getByLabel("Ваше ім’я *").waitFor();
await page.getByRole("button", { name: "Закрити вікно" }).click();
await page.goto(base + "services/" + svc.slug + "/apply");
await page.getByLabel("Ваше ім’я *").fill("Тест");
await page.getByLabel("Email для зв’язку *").fill(profile.email);
await page.getByLabel("Тема запиту *").selectOption("Консультація");
await page.getByLabel("Опишіть питання *").fill("Це перевірка форми заявки");
await page.getByLabel("Підтверджую, що це демонстраційна заява *").check();
await page.getByRole("button", { name: "Далі", exact: true }).click();
await page.getByRole("button", { name: "Далі", exact: true }).click();
await page.getByRole("heading", { name: "Перевірте вашу заяву" }).waitFor();
await page.getByRole("button", { name: "Далі", exact: true }).click();
await page.getByLabel("Підтверджую правильність даних").check();
await page.getByRole("button", { name: "Надіслати заяву" }).click();
await page.waitForURL(
  "**/account/applications/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
);
// Actual mutation methods and visible archive/trash transitions across every content resource.
for (const table of ["news", "events", "documents", "services"]) {
  const item = seed[table].find(
    (r) => r.status !== "archived" && !r.deleted_at,
  );
  await page.goto(base + "admin/" + table);
  const row = () =>
    page.locator("tbody tr").filter({ hasText: item.title }).first();
  await row().getByRole("button", { name: "Архів", exact: true }).click();
  await row().waitFor({ state: "detached" });
  assert.equal(item.status, "archived");
  await page.getByLabel("Розділ записів").selectOption("archive");
  await row().getByRole("button", { name: "Відновити", exact: true }).click();
  await row().waitFor({ state: "detached" });
  assert.equal(item.status, "draft");
  await page.getByLabel("Розділ записів").selectOption("current");
  page.once("dialog", (d) => d.accept());
  await row().getByRole("button", { name: "До кошика", exact: true }).click();
  await row().waitFor({ state: "detached" });
  assert.ok(item.deleted_at);
  await page.getByLabel("Розділ записів").selectOption("trash");
  await row().getByRole("button", { name: "Відновити", exact: true }).click();
  await row().waitFor({ state: "detached" });
  assert.equal(item.deleted_at, null);
}
const department = seed.departments[0];
await page.goto(base + "admin/departments");
let depRow = () =>
  page.locator("tbody tr").filter({ hasText: department.name }).first();
await depRow().getByRole("button", { name: "Архів", exact: true }).click();
await depRow().waitFor({ state: "detached" });
assert.equal(department.active, false);
await page.getByLabel("Розділ записів").selectOption("archive");
await depRow().getByRole("button", { name: "Відновити", exact: true }).click();
await depRow().waitFor({ state: "detached" });
assert.equal(department.active, true);
await page.goto(base + "admin/news-categories");
const category = seed.news_categories[0];
page.once("dialog", (d) => d.accept());
await page
  .locator("tbody tr")
  .filter({ hasText: category.name })
  .first()
  .getByRole("button", { name: "Видалити", exact: true })
  .click();
await page
  .locator("tbody tr")
  .filter({ hasText: category.name })
  .waitFor({ state: "detached" });
assert.ok(!seed.news_categories.some((r) => r.id === category.id));
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(base + "admin/display");
await page.getByLabel("Назва екрана").fill("ЧЕРКАСИ ТАБЛО");
await page.getByLabel("Кількість новин").fill("7");
await page.getByLabel("Тривалість: Новини").fill("12");
await page.getByRole("button", { name: "Відкрити preview display" }).click();
const preview = page.frameLocator('iframe[title="Preview display 16:9"]');
await preview.locator(".broadcast-brand strong").waitFor();
assert.equal(
  await preview.locator(".broadcast-brand strong").innerText(),
  "ЧЕРКАСИ ТАБЛО",
);
assert.equal(
  await preview
    .locator(".broadcast")
    .evaluate((e) => e.getBoundingClientRect().width),
  1920,
);
await page.getByRole("button", { name: "Зберегти табло", exact: true }).click();
await page.getByText("Налаштування табло збережено", { exact: true }).waitFor();
const display = seed.site_settings.find((r) => r.key === "display").value;
assert.equal(display.title, "ЧЕРКАСИ ТАБЛО");
assert.equal(display.news_count, 7);
assert.equal(display.durations.news, 12);
await page.locator(".display-preview-frame").scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
await page.screenshot({
  path: "test-results/display-admin-preview.png",
  fullPage: true,
});
// Exercise V3 detail tabs, permissioned metadata controls and staged upload feedback.
await page.goto(base+'staff/applications/'+aid);await page.getByRole('tab',{name:'Чат',exact:true}).click();
await page.getByLabel('Повідомлення користувачу / оператору').fill('Повідомлення V3');
await page.getByRole('button',{name:'Надіслати повідомлення',exact:true}).click();
await page.getByText('Повідомлення V3',{exact:true}).waitFor();
await page.getByRole('tab',{name:'Внутрішні нотатки',exact:true}).click();
await page.getByLabel('Текст внутрішньої нотатки').fill('Внутрішня нотатка V3');
await page.getByRole('button',{name:'Зберегти внутрішню нотатку',exact:true}).click();
await page.getByText('Внутрішня нотатка V3',{exact:true}).waitFor();
await page.getByLabel('Пріоритет',{exact:true}).selectOption('high');
await page.getByRole('button',{name:'Зберегти',exact:true}).click();
await page.waitForTimeout(150);assert.equal(seed.applications.find(v=>v.id===aid).priority,'high');
await page.goto(base+'account/documents');
await page.locator('.staged input[type=file]').first().setInputFiles({name:'proof.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 test')});
await page.getByText('Готовий до завантаження',{exact:false}).waitFor();
assert.equal(seed.user_documents.length,0,'staging is not an upload');
await page.getByRole('button',{name:'Прибрати',exact:true}).click();
assert.deepEqual(errors, []);
console.log(
  "PASS: authenticated resident/staff/admin UI fixtures, CMS preview/save, form builder, multistep draft/submit, mobile layout, zero page errors",
);
await browser.close();
await server.close();
