# Черкаси Цифрові — V3 / 3.0.0

Оновлення існуючого порталу: [інструкція](docs/UPDATE_V3.md). Міграція: `supabase/migrations/v3_upgrade.sql`. Збережені маршрути, Auth, Storage та дані. Новий маршрут `/appeal-status/:token`. Нових env або buckets немає.

# Оновлення V2

Поточна версія: **2.2.1**. Виправлення архіву/кошика: [docs/UPDATE_V2_2_1.md](docs/UPDATE_V2_2_1.md). Нове телевізійне табло: [docs/UPDATE_V2_2.md](docs/UPDATE_V2_2.md). Якщо V2 уже встановлена, нового SQL не потрібно. Для переходу з V1 спочатку виконайте [docs/UPDATE_V2.md](docs/UPDATE_V2.md).

# Черкаси Цифрові

Веб-портал на React + TypeScript + Vite, Supabase та GitHub Pages. Вихідний код готовий до підключення вашого Supabase. Реальних міських органів, контактів чи правових текстів у проєкті немає; seed містить лише позначені демонстраційні матеріали.

**Почніть із [SETUP_FOR_BEGINNER.md](SETUP_FOR_BEGINNER.md).** Там створення Supabase, запуск SQL, налаштування Auth, alerts.in.ua та публікація через GitHub описані покроково.

## Швидкий запуск

Потрібен Node.js 22.12+ або 24 LTS.

```bash
npm ci
cp .env.example .env
npm run dev
```

Windows: скопіюйте `.env.example` у Провіднику й перейменуйте копію на `.env`. Заповніть `VITE_SUPABASE_URL` та `VITE_SUPABASE_ANON_KEY`. Без них доступний тільки позначений перегляд demo seed; у цьому режимі записи, авторизація та заявки не імітуються.

Відкрийте адресу з термінала **разом із `/cherkasy-digital/`**. Для публікації `npm run build`; готовий frontend у `dist/`.

## Що реалізовано

- Публічний каталог з пошуком, фільтрами й пагінацією, категорії, детальна послуга, FAQ, новини, оголошення, документи з великим PDF viewer, події зі списком/календарем та глобальний пошук.
- Реєстрація, email confirmation, парольний вхід, відновлення пароля, зміна email/пароля, збереження Supabase session.
- Кабінет: профіль/аватар, адреси, приватні документи, збережені послуги, сповіщення, заяви/чернетки та звернення.
- Конструктор 17 типів полів, правила валідації, багатокрокове подання, autosave, незмінний snapshot форми після подання, серверні номери, приватні вкладення, історія статусів, відповіді оператора й внутрішні нотатки.
- Staff: департаментний доступ, фільтри заяв, призначення відповідального, дозволені переходи статусу, опрацювання та передача звернень.
- Admin: CRUD послуг/категорій/новин/документів/подій/FAQ/департаментів, Markdown editor з очищенням HTML, передпублікаційний перегляд, архів/кошик/відновлення, медіатека, налаштування бренду/головної/footer, службові ролі й блокування, audit log.
- alerts.in.ua: окрема Edge Function, токен тільки на сервері, спільний PostgreSQL cache/lease, cron раз на хвилину. Frontend перечитує кеш кожні 30 секунд. Застарілий або відсутній кеш показує невідомий стан, помилка API не створює відбій.
- Адаптивність 320–1440+, keyboard focus, modal focus trap, український UI, uk-UA і Europe/Kyiv.
- GitHub Actions: перевірки → build → GitHub Pages; SPA 404 fallback збережує auth hash.

## Структура

| Файл / папка                          | Призначення                                              |
| ------------------------------------- | -------------------------------------------------------- |
| `src/main.tsx`                        | Lazy routes, guards, SEO metadata                        |
| `src/pages/`                          | Публічні сторінки, auth, кабінет, заявки, staff/admin    |
| `src/components/`                     | UI, завантаження файлів, dynamic fields, Markdown editor |
| `src/services/`                       | Supabase queries, RPC, uploads / signed URLs             |
| `src/hooks/`                          | Session, settings, query states / debounce               |
| `src/config/`                         | Типи, українські статуси та конфігурація CMS             |
| `src/styles/global.css`               | Адаптивний дизайн і CSS variables                        |
| `supabase/01_schema.sql`              | Таблиці, constraints, indexes, sequences                 |
| `supabase/02_functions.sql`           | RPC, triggers, audit, validation, numbering              |
| `supabase/03_rls.sql`                 | Серверні правила доступу                                 |
| `supabase/04_storage.sql`             | Buckets, Storage policies, guards вкладень               |
| `supabase/05_seed.sql`                | Позначені демодані                                       |
| `supabase/functions/alerts/`          | Серверний провайдер alerts.in.ua                         |
| `supabase/06_alerts_cron.example.sql` | Підключення щохвилинної синхронізації                    |
| `supabase/07_first_admin.example.sql` | Призначення першого super_admin                          |
| `.github/workflows/deploy.yml`        | Автопублікація на GitHub Pages                           |
| `tests/database.mjs`                  | SQL/RLS/Storage/рольові тести через PGlite               |
| `tests/logic.test.mjs`                | Форми та обробка тривог                                  |
| `tests/browser.mjs`                   | Перевірка сторінок, mobile overflow, меню, guards        |
| `docs/SECURITY.md`                    | Модель доступу та межі перевірки                         |
| `docs/ACCEPTANCE.md`                  | Кроки перевірки після підключення                        |

## SQL: порядок

Виконайте **01 → 02 → 03 → 04 → 05**. `06` — тільки після розгортання Edge Function і Vault. `07` — після реєстрації власного акаунта й заміни email. Для нової бази також можна виконати `supabase/setup.sql`, який об’єднує 01–05. Не запускайте серверні `.example.sql` без заміни placeholder.

Доступ визначає PostgreSQL RLS. Frontend містить лише publishable/anon key. `service_role`, `ALERTS_API_TOKEN` та `ALERTS_SYNC_SECRET` ніколи не додавайте у `VITE_*` або GitHub frontend variables. `.env` і `supabase/.env` не комітяться.

## URL / GitHub Pages

Роутер використовує `VITE_BASE_PATH`. Workflow автоматично бере назву repository: `/repository-name/`. `public/404.html` повертає прямі посилання до SPA, зберігаючи шлях, query і auth hash. Для цього найпростішого fallback використовуйте **project repository** `cherkasy-digital`, а не спеціальний repository `username.github.io` і не custom domain.

Публічні сторінки мають динамічні title/description/canonical. SPA не дає гарантії social crawler previews для кожного матеріалу: окремий pre-render/SSR тут не використовується. Sitemap можна генерувати для вашої фактичної адреси, workflow генерує `sitemap.xml` для фактичної адреси; для ручного запуску див. `scripts/sitemap.mjs`; не публікуйте вигадані URL.

## Ролі

| Роль               | Доступ                                                   |
| ------------------ | -------------------------------------------------------- |
| Мешканець          | Власні дані, заяви, переписка, приватні файли            |
| `super_admin`      | Увесь портал, призначення ролей/департаментів/блокування |
| `admin`            | Портал і операції; без зміни службових ролей             |
| `department_admin` | Послуги/форми й операції свого департаменту              |
| `operator`         | Заяви свого департаменту                                 |
| `appeals_operator` | Звернення свого департаменту                             |
| `editor`           | Новини, документи, події та їхні медіафайли              |
| `viewer`           | Читання операцій свого департаменту                      |

За потреби можна додати користувачу кілька ролей. Ролі з `localStorage` не використовуються. Перший super_admin призначається через SQL Editor власником Supabase; наступних додають через admin → користувачі.

## Перевірки

```bash
npm test
npm run test:db
npm run build
```

`test:db` запускає модулі 01–05 двічі, з імітованими Supabase auth/storage schemas у PostgreSQL WASM. Перевіряє RLS, міждепартаментну ізоляцію, ролі, блокування, приватні файли, валідацію, snapshot, status flow і audit. Це не замінює smoke test на вашому hosted Supabase: Auth email, мережеві uploads, Edge runtime й cron слід перевірити після підключення. Деталі виконаних перевірок у `docs/VERIFICATION.md`.

## Оновлення

Дані, послуги та форми редагуйте через admin без перебудови frontend. Для зміни коду:

```bash
git add .
git commit -m "Update"
git push
```

Після push у main GitHub Actions опублікує новий сайт. Якщо змінюєте схему БД, SQL міграцію виконайте в Supabase окремо; workflow не змінює production database.

## Placeholder та зовнішні залежності

Немає реальних транспортних API, комунальних інтеграцій, SMS, BankID/Дія, цифрового підпису чи карт. «Черкаси зараз» для цих типів оновлюється вручну. Правові підстави послуг, політика конфіденційності, умови, телефони, відповідальні органи, логотип і реальні міські матеріали заповнює власник. Текстовий/абстрактний mark не є офіційним гербом.

Запит на видалення акаунта працює через admin workflow: автоматичне видалення Auth user не виконується клієнтом. Перед видаленням прибирайте приватні об’єкти й пов’язані записи в адміністративному середовищі за вашою політикою; збережені заявки мають FK restrict. Деталі у `docs/SECURITY.md`.

Офіційна документація: [Supabase Auth redirects](https://supabase.com/docs/guides/auth/redirect-urls), [Edge secrets](https://supabase.com/docs/guides/functions/secrets), [Cron](https://supabase.com/docs/guides/functions/schedule-functions), [Vite Pages](https://vite.dev/guide/static-deploy.html), [alerts.in.ua API](https://devs.alerts.in.ua/).
