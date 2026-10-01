# Виконана перевірка

Дата: 30.09.2026.

- `npm install` — успішно. Dependency versions зафіксовано в package-lock.json.
- `npm test` — 4 тести: районна/обласна тривога, сторонні регіони й типи загроз, завершені тривоги, malformed payload, required поля/consent/числові межі/вкладення.
- `npm run test:db` — модулі 01–05 виконано двічі в PGlite (PostgreSQL WASM). Ролі й schemas Auth/Storage створено тестовим harness. Перевірено isolation мешканців, департаментів, operator/viewer/editor, заборону privilege escalation, блокування профілю, приватні object paths, metadata guard, history/notifications, status transitions, required validation, snapshots і audit.
- `npm run build` — TypeScript і production Vite build успішні, lazy chunks створено, base `/cherkasy-digital/` застосовано.
- `tests/browser.mjs` — Playwright/Chromium: 18 публічних маршрутів на 1440, 1024, 768, 375 та 320 px, меню, пошук/empty state, guards account/staff/admin/apply. Немає page errors або горизонтального overflow.
- `tests/browser-authenticated.mjs` — явно тестові network fixtures, не backend продукту: сторінки кабінету, staff і admin на 1440 та 375 px; CMS create/preview/save, preview конструктора форм, чотирикрокове подання й draft/submit payload. Немає page errors/overflow. Рольова безпека перевірена окремими справжніми SQL-запитами в test:db.
- Переглянуто desktop/mobile screenshot головної, виправлено перенесення довгих українських заголовків.
- 404 fallback зберігає path/query і hash auth callback. Для GitHub Pages ці маршрути додатково перевірте на вашій фактичній адресі після deploy.

## Що неможливо перевірити без ваших налаштувань

Проєкт не підключено до вашого hosted Supabase й GitHub repository. Реєстрація через реальні email, SMTP, мережевий Storage upload, signed URL permissions у hosted API, cron, Edge runtime і виклик alerts.in.ua із вашим токеном ще не запускалися. Ці кроки описані в SETUP_FOR_BEGINNER.md та ACCEPTANCE.md. Frontend build не містить токена alerts.in.ua або service_role.

## Повторення UI перевірок

```bash
npm run test:ui
npm run test:ui:authenticated
```

Для Linux harness включено @sparticuz/chromium. На Windows/macOS можна використати звичайний Playwright Chromium: встановіть `npx playwright install chromium`, а в обох test scripts замініть запуск із `executablePath` та `Chromium.args` на `chromium.launch({headless:true})`. UI harness запускає тимчасовий Vite server сам; окремий dev server не потрібен.

Не запускайте authenticated fixture test проти реального production: він призначений для локального test server і перехоплених API.

## V2 verification

Version 2.0.0: TypeScript/Vite production build and 5 logic tests passed. All SQL modules including 08_v2 execute twice in PGlite. Added real SQL assertions for public token limited columns, owner-only generation/revocation, activity RLS, denied self verification, read/unread RPC, revision snapshots, role-limited restore, restore audit, server future-date rejection and conditional required fields.

Public browser route checks (320,375,768,1024,1440) and resident/staff/admin fixture tests passed including /account/activity, important announcements and verification admin pages. Dedicated production V2 browser test passed: banner moves header, dismiss persists, version reopens, critical non-dismiss, notification popover, /display critical screen, generated document QR PNG, reduced-motion, manifest subpath, service worker static allowlist, actual offline navigation fallback. Visually inspected mobile announcement and 1920×1080 display screenshots.

These do not replace checks against the user's hosted Supabase, SMTP, cron or real alerts token. Install prompts depend on browser platform and installability heuristics; service-worker/manifest/offline behavior was tested in Chromium.

## Перевірка 2.1.0 — 01.10.2026

TypeScript і production build успішні. Публічні маршрути перевірені на 320, 375, 768, 1024 та 1440 px; authenticated fixture тести та V2/PWA регресійний тест пройшли. Окремий браузерний тест перевіряє видимість тривоги на mobile, панель деталей, пріоритет над maintenance, зупинку ротації, 8-секундний відбій, невідомий стан при мережевій помилці/застарілому кеші, critical, ротацію, reduced motion і один спільний запит кешу під час оновлення. Desktop/mobile screenshots та табло 1920 px переглянуті візуально.

UI сценарії використовують перехоплені тестові відповіді, без записів до реальної бази. Hosted Supabase, cron і реальний токен alerts.in.ua залишаються неперевіреними.

## Перевірка 2.2.0 — 01.10.2026

Production TypeScript/Vite build і 10 logic tests пройшли. Публічні маршрути на п’яти ширинах, authenticated fixtures та V2/PWA regression пройшли. Нова admin-перевірка відкриває `/admin/display`, змінює назву, кількість новин і тривалість, перевіряє iframe 1920×1080 та збереження JSON у тестовому API. Preview і вигляд табло переглянуто візуально.

Виправлено повторне блокувальне завантаження Auth для того самого користувача при відкритті preview: фонове оновлення профілю/ролей зберігається, а незбережена форма не демонтується.

Відкритий Supabase, cron та реальний токен alerts.in.ua не перевірялися. Дані UI сценаріїв — явні network fixtures. Можливість читання з фізичної відстані залежить від діагоналі та налаштувань самого екрана; перевірено композицію і масштабування у браузері, а не на фізичному телевізорі.

Окремий broadcast browser test пройшов повністю: 1366×768, 1920×1080, 2560×1440, 3840×2160 без прокрутки; короткий overlay тривоги; активна тривога не зупиняє ротацію/стрічку; підтверджений відбій зникає за таймером; невідомий/застарілий стан; critical-сцена; приховування/повернення курсора; reduced motion та спільний запит кешу. Сповіщення входу/відбою мають CSS fade у межах 7/5 секунд і прибираються таймером без очікування виходу Motion.

## Виправлення CRUD — 2.2.1

10 logic tests і production TypeScript/Vite build пройшли. У справжньому PostgreSQL через PGlite відтворено NOT NULL помилку часткового INSERT ON CONFLICT для новин, подій, документів і послуг. Перевірено UPDATE архіву/кошика/відновлення, невидимість для anon і заборону змін мешканцем. Додатково перевірено FK-заборону видалення пов’язаного департаменту, його архівування зі збереженням послуг, відновлення та видалення невикористаного департаменту. Всі SQL-модулі повторно виконані двічі; RLS не змінювалась.

Реальний hosted Supabase користувача недоступний; SQL перевірено локально, браузерні сценарії використовують явно тестові HTTP-відповіді.

Authenticated browser test пройшов: для кожного з services/news/documents/events перевірено HTTP PATCH, зникнення з активного списку, архів, відновлення як чернетки, кошик і повторне відновлення. Для departments перевірено архів/відновлення, для категорії — DELETE та зникнення зі списку. Перевірено також CMS create/preview, форми заяв, mobile/admin routes та налаштування display; page errors немає.
