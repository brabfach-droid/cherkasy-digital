# Поточна версія: 3.0.0

# Оновлення існуючого порталу до V3 (3.0.0)

Не видаляйте проєкт Supabase, акаунти, таблиці або Storage. Використовуйте той самий GitHub-репозиторій.

## 1. Оновити базу

Відкрийте Supabase → свій проєкт → SQL Editor → New query. Відкрийте `supabase/migrations/v3_upgrade.sql` або окремий `v3_upgrade.txt` у Блокноті. Скопіюйте УВЕСЬ текст у SQL Editor і натисніть Run. `Success. No rows returned` означає, що міграція виконалась. Її можна виконати повторно.

Ця міграція потребує вже встановленої V2 (`08_v2.sql`). Для оновлення не запускайте початковий `setup.sql` замість міграції. Якщо бачите помилку, не видаляйте дані: надішліть її повний текст.

## 2. Оновити GitHub

Розпакуйте архів V3. Відкрийте GitHub → свій репозиторій → Code → Add file → Upload files. Завантажте ВМІСТ папки `cherkasy-digital`, а не сам ZIP і не додаткову зовнішню папку.

Першими замініть `src`, `public`, `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`. Далі `supabase`, `scripts`, `tests` і документацію. Якщо GitHub каже «менше 100 файлів», завантажуйте цими групами. Папки `node_modules`, `dist` і `test-results` не завантажуйте.

Натисніть Commit changes. У Actions дочекайтеся зеленої галочки workflow **Deploy GitHub Pages**. Якщо він не запустився автоматично, відкрийте саме цей workflow → Run workflow. Збережені Secrets Supabase та налаштування Pages не змінюйте.

## 3. Перевірити сайт

Перезавантажте сайт через Ctrl+Shift+R. У footer має бути `v3.0.0`. Відкрийте головну, Ctrl+K, тему, кабінет, заяву, «Мої документи», staff, admin та `/display`.

У новому завантажувачі вибір файлу лише готує його. Натисніть **Завантажити**, щоб зберегти у Supabase. Обов’язкове поле можна заповнити через «Вибрати з моїх документів». Використаний у заяві документ захищений від видалення.

У staff заяві доступні вкладки Огляд / Файли / Чат / Історія / Внутрішні нотатки, відповідальний за ім’ям, пріоритет, термін та передача до департаменту з причиною. Внутрішні нотатки не видно мешканцю.

Публічний QR звернення веде на `/appeal-status/:token`, QR заяви — на `/status/:token`. Там немає ПІБ, телефонів, відповідей форми, приватних повідомлень чи файлів. Посилання можна відкликати й створити знову.

В оголошеннях доступна опція «Також надіслати у центр сповіщень». Доставка виконується сервером під час наступного запиту сповіщень (до 30 секунд для відкритого порталу), один раз на версію оголошення та користувача.

Немає нових env-змінних або buckets. Токен alerts.in.ua залишається лише на сервері в наявному налаштуванні, не у публічному frontend.


---

> Версія 2.2.1: для виправлення архіву та кошика читайте docs/UPDATE_V2_2_1.md; для налаштувань табло — docs/UPDATE_V2_2.md. Якщо V2 уже встановлена, нового SQL не потрібно. Для переходу з V1 потрібна також інструкція docs/UPDATE_V2.md; для нового проєкту setup.sql вже включає V2.

# Запуск «Черкаси Цифрові» — від нуля

У вас уже є всі файли сайту. Потрібно підключити вашу базу Supabase та викласти frontend на GitHub Pages. Токени та акаунти створюєте у власних сервісах. Поки цього не зроблено, сайт показує лише демоперегляд.

## Частина 1. GitHub та repository

1. Створіть акаунт на [github.com](https://github.com/) і підтвердьте email.
2. Натисніть **+ → New repository**.
3. Назва: `cherkasy-digital`. Найпростіше обрати Public. Якщо repository private, доступність Pages залежить від вашого плану GitHub.
4. Натисніть **Create repository**.
5. Розпакуйте ZIP. Усередині папки `cherkasy-digital` є `package.json`, `src`, `supabase`, `.github`, `.env.example`.
6. Завантажуйте **вміст цієї папки**, щоб `package.json` лежав у корені repository, а не в додатковій вкладеній папці.
7. Через вебсайт: **Add file → Upload files**. Перетягніть файли й папки та натисніть **Commit changes**.
8. Обов’язково перевірте, що `.github/workflows/deploy.yml` теж завантажено. Windows може приховувати папки з крапкою. Якщо `.github` немає, створіть через **Add file → Create new file** файл з назвою `.github/workflows/deploy.yml` і вставте його вміст із архіву.
9. Не завантажуйте `node_modules`, `.env`, `supabase/.env` чи файли з вашими токенами.

Можна використовувати GitHub Desktop: **File → Add local repository**, додайте розпаковану папку, створіть repository, commit і **Publish repository**. Node dependencies та приватні env виключено через `.gitignore`.

## Частина 2. Supabase

1. Відкрийте [supabase.com](https://supabase.com/) та увійдіть.
2. Натисніть **New project**, виберіть організацію й назву `cherkasy-digital`.
3. Придумайте надійний database password і збережіть його. У файли frontend цей пароль не потрібен.
4. Виберіть доступний близький регіон і дочекайтеся створення проєкту.
5. На сторінці проєкту натисніть **Connect**. У прикладах для React/Vite знайдіть URL вигляду `https://xxxxxxxx.supabase.co` та publishable/anon key. Альтернативно URL є в **Project Settings → Data API / API**, а ключі — у **Project Settings → API Keys**. Назви пунктів можуть відрізнятися залежно від версії dashboard.
6. Для цього сайту потрібен публічний **publishable key** (`sb_publishable_…`) або legacy **anon** (`eyJ…`). Обидва використовують RLS. **Secret / service_role key** не копіюйте у frontend!

## Частина 3. Запуск SQL

1. У Supabase зліва відкрийте **SQL Editor → New query**.
2. Відкрийте `supabase/01_schema.sql` звичайним текстовим редактором.
3. Скопіюйте весь текст, вставте у SQL Editor і натисніть **Run**.
4. Дочекайтеся успішного результату.
5. Так само виконайте `02_functions.sql`, потім `03_rls.sql`, потім `04_storage.sql`, потім `05_seed.sql`.
6. Або вставте одним запитом `supabase/setup.sql`: він містить ті самі 01–05. Не потрібно виконувати обидва способи.
7. `06_alerts_cron.example.sql` поки не запускайте: до нього повернемося в частині 6.
8. `07_first_admin.example.sql` запускається після реєстрації акаунта.
9. Відкрийте **Table Editor** й перевірте таблиці `services`, `profiles`, `applications`, `user_roles`. Seed додає демонстраційні послуги, а не реальні звернення.

Повторний запуск 01–05 перевірено. Seed не перезаписує існуючі матеріали. Важливо: не вимикайте RLS «для простоти» й не додавайте політики з відкритим доступом до приватних таблиць.

## Частина 4. Storage

1. Відкрийте **Storage**.
2. Після `04_storage.sql` мають існувати:
   - private: `avatars`, `service-documents`, `application-files`, `appeal-files`, `documents`;
   - public: `news`, `events`, `site-assets`.
3. Якщо bucket не з’явився, перевірте помилку SQL. Можна створити його через **New bucket**, вводячи точну назву вище, та знову виконати `04_storage.sql`, щоб застосувати policies, MIME types і ліміти.
4. Не вмикайте Public для заяв, звернень, особистих документів або аватарів.
5. Особисті файли відкриваються через підписане посилання на 5 хвилин; посилання генерується лише після серверної перевірки доступу.

## Частина 5. Auth

1. У Supabase відкрийте **Authentication → Providers / Sign In → Email**. Увімкніть email + password і підтвердження email.
2. Відкрийте **Authentication → URL Configuration**.
3. **Site URL**: `https://ВАШ_LOGIN.github.io/cherkasy-digital/`.
4. До **Redirect URLs** додайте:

```text
https://ВАШ_LOGIN.github.io/cherkasy-digital/**
http://localhost:5173/cherkasy-digital/**
http://127.0.0.1:5173/cherkasy-digital/**
```

5. Збережіть. Якщо repository назвали інакше, замініть `cherkasy-digital` усюди.
6. Налаштуйте надійний SMTP для реальних користувачів. Вбудована відправка Supabase має обмеження й може бути доступна лише дозволеним адресам. Якщо листи не приходять, перевірте Auth logs, SMTP та папку «Спам».
7. Шаблони листів залиште з коректним `ConfirmationURL`; не замінюйте їх посиланням, що губить токен.
8. Для тестових акаунтів також можна використовувати **Authentication → Users → Add user**, але звичайну реєстрацію й підтвердження перевірте окремо.

## Частина 6. ENV та alerts.in.ua

### Frontend `.env`

1. Скопіюйте `.env.example` і назвіть копію `.env`.
2. Відкрийте її у Блокноті / VS Code.
3. Заповніть:

```env
VITE_SUPABASE_URL=https://ВАШ_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=ВАШ_PUBLISHABLE_АБО_ANON_KEY
VITE_BASE_PATH=/cherkasy-digital/
VITE_SITE_URL=http://localhost:5173/cherkasy-digital/
```

Для публічного сайту `VITE_SITE_URL` має бути вашою GitHub Pages адресою. Це значення визначає посилання в email підтвердження й відновлення.

### Серверний токен тривог

Ваш `ALERTS_API_TOKEN` не повинен потрапляти у `VITE_*`. Токен alerts.in.ua передається лише Edge Function. Додавання токена в локальний frontend `.env` саме по собі не встановлює секрет у хмарі: його потрібно передати в Supabase.

1. Скопіюйте `.env.server.example` у **`supabase/.env`**.
2. Заповніть `ALERTS_API_TOKEN` вашим токеном.
3. Для `ALERTS_SYNC_SECRET` створіть довгий випадковий рядок. У терміналі з Node.js можна виконати:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

4. Вставте отриманий рядок у `ALERTS_SYNC_SECRET`. Він захищає виклик синхронізації.
5. За замовчуванням `ALERTS_LOCATION_UIDS=152` — Черкаський район. Обласна тривога в `Черкаська область` також враховується. Це **район + обласне оголошення**, не обіцянка окремого міського статусу. У майбутньому UID можна змінити без frontend коду, за актуальним довідником alerts.in.ua.
6. Встановіть Supabase CLI через `npx`; використовуйте Node.js 22.12+ або 24. У папці проєкту виконайте:

```bash
npx supabase login
npx supabase link --project-ref ВАШ_PROJECT_REF
npx supabase secrets set --env-file supabase/.env
npx supabase functions deploy alerts --no-verify-jwt
```

`PROJECT_REF` — частина адреси до `.supabase.co`, наприклад `abcdefgh`. Під час link CLI може попросити database password, який ви створили в частині 2.

7. У **Edge Functions → alerts → Secrets** перевірте наявність `ALERTS_API_TOKEN`, `ALERTS_SYNC_SECRET`, `ALERTS_LOCATION_UIDS`, `ALERTS_OBLAST_TITLE`. `SUPABASE_URL` та `SUPABASE_SERVICE_ROLE_KEY` у функції надає Supabase автоматично.
8. У Supabase відкрийте **Vault** (може знаходитися в Database / Integrations) і створіть два secrets:
   - name `portal_supabase_url`, value ваша адреса `https://ВАШ_PROJECT.supabase.co`;
   - name `portal_alerts_sync_secret`, value той самий рядок, що у `ALERTS_SYNC_SECRET`.
9. Якщо Vault у dashboard не видно, у SQL Editor можна створити secrets:

```sql
select vault.create_secret('https://ВАШ_PROJECT.supabase.co','portal_supabase_url');
select vault.create_secret('ВАШ_ВИПАДКОВИЙ_SYNC_SECRET','portal_alerts_sync_secret');
```

Не вставляйте ваш реальний секрет у repository чи скріншоти. alerts.in.ua API token не потрібен у Vault: він залишається в Edge secrets.

10. Тепер виконайте **`supabase/06_alerts_cron.example.sql`** у SQL Editor.
11. У Supabase Cron / `cron.job_run_details` перевірте, що `portal-alerts-sync` запускається раз на хвилину.
12. Зачекайте 1–2 хвилини й відкрийте **Table Editor → api_cache**. Для `key=alerts` має оновитися `refreshed_at`, а payload міститиме стан і scope. На сайті відкрийте `/now`.
13. Якщо API недоступне / токен неправильний, функція збереже коротку помилку без секретів. На сайті після 120 секунд без оновлення показується невідомий стан. Невдалий HTTP запит не означає відбій.

Виклик API — один на хвилину для всього порталу, а не на кожного відвідувача. Це нижче опублікованих API limits. Функцію закрито `x-sync-secret`; `--no-verify-jwt` вимикає стандартний JWT gateway тільки тому, що cron використовує окремий серверний секрет. Не прибирайте перевірку заголовка у `index.ts`.

## Частина 7. Локальний запуск

1. Встановіть Node.js 24 LTS з [nodejs.org](https://nodejs.org/).
2. Відкрийте розпаковану папку проєкту. На Windows натисніть адресний рядок Провідника, введіть `cmd`, Enter.
3. Виконайте:

```bash
npm ci
npm run dev
```

4. Відкрийте URL із термінала, наприклад `http://localhost:5173/cherkasy-digital/`.
5. Не відкривайте `index.html` подвійним кліком: Vite має працювати.
6. Перевірте реєстрацію, лист підтвердження й вхід. Якщо зверху видно «Supabase не підключено», перевірте `.env` та перезапустіть `npm run dev`.
7. Для production перевірки:

```bash
npm run build
npm run preview
```

## Частина 8. GitHub Pages

1. У repository відкрийте **Settings → Secrets and variables → Actions → Variables**.
2. Натисніть **New repository variable**. Створіть:
   - `VITE_SUPABASE_URL` — ваша адреса Supabase;
   - `VITE_SUPABASE_ANON_KEY` — publishable / anon key.
3. Це публічні frontend налаштування. Не додавайте сюди service_role чи alerts token.
4. Workflow автоматично задає base path та Site URL за назвою repository і вашим GitHub login.
5. Відкрийте **Settings → Pages → Build and deployment → Source → GitHub Actions**.
6. На вкладці **Actions** виберіть **Deploy GitHub Pages → Run workflow**, або зробіть commit у main.
7. Дочекайтеся зелених build/deploy. Якщо помилка — відкрийте failed step і прочитайте текст; найчастіше це відсутня variable або неправильна структура repository.
8. Відкрийте `https://ВАШ_LOGIN.github.io/cherkasy-digital/`.
9. Перевірте прямий перехід на `/services/demo-consultation`, reload і посилання відновлення пароля. GitHub спершу віддає 404 document, який автоматично відновлює SPA шлях та auth hash.
10. У Supabase Site URL має відповідати цій публічній адресі.

Не потрібно вручну комітити `dist`: workflow збирає його сам. `package-lock.json` потрібно завантажити разом із `package.json`, бо використовується `npm ci`.

## Частина 9. Перший адміністратор

1. На вашому сайті натисніть **Увійти → Реєстрація**, створіть власний акаунт і підтвердьте email.
2. У Supabase SQL Editor вставте файл `supabase/07_first_admin.example.sql`.
3. Замініть **обидва** `YOUR_EMAIL` на ваш email у лапках.
4. Натисніть Run. В останньому запиті має з’явитися email і `super_admin`.
5. Вийдіть на сайті та увійдіть знову, щоб frontend перечитав ролі.
6. Нікому не передавайте доступ до SQL Editor або service_role key для роботи оператором.

## Частина 10. Адмінпанель і службові акаунти

1. Відкрийте `https://ВАШ_LOGIN.github.io/cherkasy-digital/admin`.
2. У розділі **Департаменти** додайте ваші реальні департаменти й контакти.
3. Працівник має зареєструвати звичайний акаунт і підтвердити email.
4. Super admin відкриває **Користувачі / Staff / Ролі → Права доступу**, відмічає роль і департамент, натискає Зберегти.
5. Оператор відкриває `/staff`, не `/admin`. Він бачить тільки дозволені заявки свого департаменту.
6. Редактор може працювати з новинами/документами/подіями, але не читає приватні заяви.
7. Поточному super_admin не можна змінити власні права через UI, щоб випадково не заблокувати доступ. За потреби це робить власник Supabase через SQL.

## Частина 11. Перша послуга

1. **Admin → Категорії послуг**: створіть категорію, якщо потрібної немає.
2. **Admin → Послуги → Створити**.
3. Заповніть назву, slug латиницею (наприклад `consultation`), опис, формат, термін, вартість, перелік документів, інструкцію, результат, підставу й контакти.
4. Виберіть **департамент**. Це потрібно, щоб заявку міг побачити відповідний operator.
5. Для audience використовуйте коди `residents,business,veterans,idp,families,youth,disability,other` через кому.
6. Залиште «Чернетка», збережіть.
7. **Admin → Форми**: виберіть послугу, додайте поля, required, options і правила. Унікальні ключі латиницею, наприклад `full_name` або `attachment`.
8. Файлові поля `file/image/pdf` показуються на кроці документів. `heading/information` — текстові блоки. Confirmation — обов’язковий checkbox підтвердження.
9. Збережіть форму, перегляньте її.
10. Поверніться у **Послуги**, відкрийте редактор, зробіть попередній перегляд і встановіть **Опубліковано**, дату не пізніше поточної. Для запланованої публікації — «Заплановано» й майбутню дату; БД відфільтрує її до цього часу.
11. Приберіть checkbox «Демо» тільки для справді налаштованої послуги.
12. Подайте тестову заявку звичайним користувачем; operator приймає її, просить дані або змінює статус. Перевірте вкладення й повідомлення.
13. Новини й події додаються аналогічно. Для документів завантажте PDF/DOCX у редакторі; PDF відкриється у великому viewer, DOCX — через кнопку відкриття/завантаження.
14. Перед реальним запуском у **Налаштуваннях** заповніть контакти, політику конфіденційності та умови, а демонстраційні матеріали архівуйте.

## Частина 12. Оновлення надалі

**Контент** змінюйте через admin: build і GitHub commit для цього не потрібні.

**Код через вебсайт GitHub:** відкрийте файл → олівець Edit → змініть → Commit changes у main. Actions оновить сайт.

**Код через термінал:**

```bash
git add .
git commit -m "Update"
git push
```

**Змінили frontend URL/key:** оновіть Variables у GitHub і запустіть workflow заново; перезапуск frontend потрібен, бо Vite підставляє значення під час build.

**Змінили alerts token:** оновіть `supabase/.env`, повторіть `npx supabase secrets set --env-file supabase/.env`. Для зміни коду функції повторіть deploy. Для зміни sync secret також змініть відповідний Vault secret.

**Змінили SQL:** створіть міграцію та окремо виконайте її у Supabase, зберігаючи дані. Frontend deploy не виконує SQL автоматично.

## Якщо щось не працює

- Немає Project URL: натисніть **Connect** у проєкті, знайдіть Supabase URL у прикладі підключення; не копіюйте URL dashboard браузера.
- Немає доступу до admin: перевірте таблицю `user_roles`, email в SQL і повторний вхід.
- Оператор не бачить заяву: перевірте department послуги, department заявки та `staff_departments` працівника.
- Не відкривається вкладення: перевірте приватний bucket, policies 04 і session. Не робіть bucket public.
- Файли/пошта не працюють у demo: заповніть Supabase env. Demo лише для перегляду.
- Заяву відхиляє валідація: перевірте required fields, email/options/числові правила, файли й confirmation.
- Тривога «невідомо»: перевірте secrets, Edge logs, cron і `api_cache.refreshed_at`. Застарілі дані не показуються як підтверджений відбій.
- Змінили `.env`, а сайт старий: зупиніть dev сервер Ctrl+C, запустіть знову; для Pages повторіть Actions.
