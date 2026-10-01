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
