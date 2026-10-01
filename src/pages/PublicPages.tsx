import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  GraduationCap,
  Heart,
  Bus,
  FileText,
  Briefcase,
  Trees,
  Palette,
  Trophy,
  Users,
  Activity,
  ShieldCheck,
  Calendar,
  Search,
  Expand,
} from "lucide-react";
import { useData, useDebounce } from "../hooks/useData";
import { useSettings } from "../hooks/Settings";
import { useAuth } from "../hooks/Auth";
import { list, get, save, remove, errorText } from "../services/data";
import { configured } from "../services/client";
import { fileUrl } from "../services/files";
import {
  Badge,
  Button,
  Card,
  Empty,
  FileLink,
  Markdown,
  Media,
  Modal,
  Pagination,
  SearchBar,
  State,
  useToast,
} from "../components/UI";
import type { Row } from "../config/types";
import { date, datetime } from "../config/types";
const icons = [
  GraduationCap,
  Building2,
  Heart,
  Bus,
  FileText,
  Briefcase,
  Trees,
  Palette,
  Trophy,
  Users,
];
const titles: Record<string, string> = {
  services: "Послуги для кожного",
  news: "Новини міста",
  documents: "Документи",
  events: "Події міста",
};
const descriptions: Record<string, string> = {
  services: "Знайдіть потрібний сервіс і подайте заяву онлайн.",
  news: "Важливе для вашого міста — в одному місці.",
  documents: "Рішення, програми та інші опубліковані документи.",
  events: "Зустрічі, культура й життя громади.",
};
export function Section({
  title,
  to,
  children,
}: {
  title: string;
  to?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-heading">
        <h2>{title}</h2>
        {to && (
          <Link to={to}>
            Переглянути всі <ArrowUpRight size={18} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
export function Home() {
  const { settings } = useSettings(),
    navigate = useNavigate(),
    [query, setQuery] = useState("");
  const q = useData(async () => {
    const [
      services,
      categories,
      news,
      events,
      documents,
      announcements,
      allServices,
    ] = await Promise.all([
      list("services", { size: 3, visible: true, eq: { featured: true } }),
      list("service_categories", {
        size: 20,
        order: "sort_order",
        ascending: true,
      }),
      list("news", { size: 3, visible: true, order: "published_at" }),
      list("events", {
        size: 2,
        visible: true,
        order: "starts_at",
        ascending: true,
      }),
      list("documents", { size: 2, visible: true }),
      list("announcements", { size: 10, order: "priority" }),
      list("services", { size: 1000, visible: true, eq: { available: true } }),
    ]);
    return {
      services,
      categories,
      news,
      events,
      documents,
      announcements,
      allServices,
    };
  });
  const [dismissed, setDismissed] = useState<string[]>([]),
    [modalClosed, setModalClosed] = useState(false);
  const modal = q.data?.announcements.rows.find(
    (r) => r.placement === "modal" && !dismissed.includes(r.id),
  );
  const blocks: Record<string, React.ReactNode> = {
    popular: (
      <Section title="Популярні послуги" to="/services">
        <div className="grid three">
          {q.data?.services.rows.map((r) => (
            <Card
              key={r.id}
              row={r}
              to={"/services/" + r.slug}
              subtitle="Онлайн · Безкоштовно"
            />
          ))}
        </div>
      </Section>
    ),
    categories: (
      <Section title="Що вас цікавить?">
        <div className="category-grid">
          {q.data?.categories.rows.map((r, i) => {
            const Icon = icons[i % icons.length];
            return (
              <Link
                to={"/services?category=" + r.id}
                key={r.id}
                className="category"
              >
                <Icon size={24} />
                <h3>{r.name}</h3>
                <span>
                  {q.data?.allServices.rows.filter(
                    (s) => s.category_id === r.id,
                  ).length || 0}{" "}
                  послуг <ArrowUpRight size={16} />
                </span>
              </Link>
            );
          })}
        </div>
      </Section>
    ),
    now: (
      <Section title="Черкаси зараз" to="/now">
        <CityNow compact />
      </Section>
    ),
    announcements: (
      <>
        {q.data?.announcements.rows
          .filter((r) => r.placement !== "modal" && !dismissed.includes(r.id))
          .map((r) => (
            <div className="announcement" key={r.id}>
              <div>
                <p className="eyebrow">Важливе повідомлення</p>
                <h3>{r.title}</h3>
                <p>{r.message}</p>
              </div>
              {r.button_url && /^https?:\/\//.test(r.button_url) && (
                <a
                  className="button"
                  href={r.button_url}
                  rel="noopener noreferrer"
                >
                  {r.button_text || "Детальніше"}
                </a>
              )}
              {r.dismissible && (
                <button
                  aria-label="Закрити оголошення"
                  onClick={() => setDismissed((v) => [...v, r.id])}
                >
                  ×
                </button>
              )}
            </div>
          ))}
      </>
    ),
    news: (
      <Section title="Останні новини" to="/news">
        <div className="grid three">
          {q.data?.news.rows.map((r) => (
            <div key={r.id}>
              <Media bucket="news" path={r.cover_path} alt={r.title} />
              <Card
                row={r}
                to={"/news/" + r.slug}
                subtitle={date(r.published_at)}
              />
            </div>
          ))}
        </div>
      </Section>
    ),
    events: (
      <Section title="Найближчі події" to="/events">
        <div className="grid two">
          {q.data?.events.rows.map((r) => (
            <Card
              key={r.id}
              row={r}
              to={"/events/" + r.slug}
              subtitle={datetime(r.starts_at)}
            />
          ))}
        </div>
      </Section>
    ),
    documents: (
      <Section title="Документи" to="/documents">
        <div className="grid two">
          {q.data?.documents.rows.map((r) => (
            <Card
              key={r.id}
              row={r}
              to={"/documents/" + r.slug}
              subtitle={r.document_number || "Документ"}
            />
          ))}
        </div>
      </Section>
    ),
    help: (
      <div className="help-cta">
        <div>
          <p className="eyebrow">Ми поруч</p>
          <h2>
            Є запитання?
            <br />
            Знайдемо відповідь разом.
          </h2>
        </div>
        <Link className="button" to="/help">
          Центр допомоги <ArrowUpRight size={20} />
        </Link>
      </div>
    ),
  };
  const order = (
    settings.homepage_blocks?.length
      ? settings.homepage_blocks
      : Object.keys(blocks).map((key, i) => ({
          key,
          enabled: true,
          sort_order: i,
        }))
  )
    .filter((b: any) => b.enabled)
    .sort((a: any, b: any) => a.sort_order - b.sort_order);
  return (
    <>
      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> Місто у вашому браузері
          </p>
          <h1>{settings.hero_title}</h1>
          <p>{settings.hero_description}</p>
          <form
            className="hero-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/search?q=" + encodeURIComponent(query));
            }}
          >
            <Search size={22} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Яку послугу ви шукаєте?"
              aria-label="Пошук послуг"
            />
            <Button aria-label="Шукати">
              <ArrowRight size={22} />
            </Button>
          </form>
          <div className="quick-links">
            <span>Часто шукають:</span>
            <Link to="/services">Послуги</Link>
            <Link to="/appeals">Звернення</Link>
            <Link to="/documents">Документи</Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="city-ring ring-one" />
          <div className="city-ring ring-two" />
          <div className="city-ring ring-three" />
          <div className="city-mark">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="floating-tag">
            <ShieldCheck size={20} /> Просто. Зручно. Онлайн.
          </div>
          <div className="visual-caption">
            ЧЕРКАСИ
            <br />
            <b>ЦИФРОВІ</b>
            <span>49°26′ N · 32°04′ E</span>
          </div>
        </div>
      </div>
      <div className="container">
        <State loading={q.loading} error={q.error}>
          {order.map((b: any) => (
            <div key={b.key}>{blocks[b.key]}</div>
          ))}
        </State>
      </div>
      {modal && !modalClosed && (
        <Modal title={modal.title} onClose={() => setModalClosed(true)}>
          <p>{modal.message}</p>
        </Modal>
      )}
    </>
  );
}
export function Catalog() {
  const loc = window.location.pathname;
  const table = loc.includes("/services")
    ? "services"
    : loc.includes("/news")
      ? "news"
      : loc.includes("/documents")
        ? "documents"
        : "events";
  const [params, setParams] = useSearchParams(),
    search = params.get("q") || "",
    page = Number(params.get("page")) || 1,
    category = params.get("category") || "",
    format = params.get("format") || "",
    audience = params.get("audience") || "",
    availability = params.get("available") || "",
    sort =
      params.get("sort") || (table === "events" ? "starts_at" : "published_at"),
    [calendar, setCalendar] = useState(false);
  const debounced = useDebounce(search);
  const catTable =
    table === "services"
      ? "service_categories"
      : table === "news"
        ? "news_categories"
        : table === "documents"
          ? "document_categories"
          : null;
  const cats = useData(
    () =>
      catTable
        ? list(catTable, { size: 100 })
        : Promise.resolve({ rows: [], count: 0 }),
    [catTable],
  );
  function update(key: string, v: string) {
    const next = new URLSearchParams(params);
    v ? next.set(key, v) : next.delete(key);
    next.delete("page");
    setParams(next);
  }
  const q = useData(
    () =>
      list(table, {
        search: debounced,
        searchColumns:
          table === "documents"
            ? ["title", "document_number", "description"]
            : ["title", "summary"],
        page,
        visible: true,
        order: sort,
        ascending: sort === "title" || sort === "starts_at",
        eq: {
          ...(category ? { category_id: category } : {}),
          ...(format ? { format } : {}),
          ...(availability ? { available: availability === "true" } : {}),
        },
        contains: audience ? { audience: [audience] } : {},
      }),
    [table, debounced, page, category, format, audience, availability, sort],
  );
  return (
    <div className="container page">
      <p className="eyebrow">Міський портал</p>
      <h1>{titles[table]}</h1>
      <p className="lead">{descriptions[table]}</p>
      <div className="filters">
        <SearchBar
          value={search}
          onChange={(v) => update("q", v)}
          placeholder={
            table === "documents"
              ? "Назва або номер документа"
              : "Знайти у каталозі"
          }
        />
        {catTable && (
          <select
            aria-label="Категорія"
            value={category}
            onChange={(e) => update("category", e.target.value)}
          >
            <option value="">Усі категорії</option>
            {cats.data?.rows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {table === "services" && (
          <>
            <select
              aria-label="Формат"
              value={format}
              onChange={(e) => update("format", e.target.value)}
            >
              <option value="">Будь-який формат</option>
              <option value="online">Онлайн</option>
              <option value="offline">Офлайн</option>
              <option value="hybrid">Онлайн + офлайн</option>
            </select>
            <select
              aria-label="Для кого"
              value={audience}
              onChange={(e) => update("audience", e.target.value)}
            >
              {[
                ["", "Для всіх"],
                ["residents", "Мешканці"],
                ["business", "Бізнес"],
                ["veterans", "Ветерани"],
                ["idp", "ВПО"],
                ["families", "Сім’ї"],
                ["youth", "Молодь"],
                ["disability", "Люди з інвалідністю"],
                ["other", "Інше"],
              ].map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
            <select
              aria-label="Доступність"
              value={availability}
              onChange={(e) => update("available", e.target.value)}
            >
              <option value="">Усі послуги</option>
              <option value="true">Доступні</option>
              <option value="false">Тимчасово недоступні</option>
            </select>
          </>
        )}
        <select
          value={sort}
          aria-label="Сортування"
          onChange={(e) => update("sort", e.target.value)}
        >
          <option value="published_at">Найновіші</option>
          <option value="title">За назвою</option>
          {table === "events" && (
            <option value="starts_at">За датою події</option>
          )}
          {table === "documents" && (
            <option value="date">За датою документа</option>
          )}
        </select>
        {table === "events" && (
          <Button className="secondary" onClick={() => setCalendar(!calendar)}>
            <Calendar size={18} />
            {calendar ? "Список" : "Календар"}
          </Button>
        )}
      </div>
      <State loading={q.loading} error={q.error}>
        {q.data?.count ? (
          <>
            <p className="muted">Знайдено: {q.data.count}</p>
            {calendar ? (
              <EventCalendar rows={q.data.rows} />
            ) : (
              <div className="grid three">
                {q.data.rows.map((r) => (
                  <Card
                    key={r.id}
                    row={r}
                    to={"/" + table + "/" + r.slug}
                    subtitle={
                      table === "services"
                        ? `${r.format === "online" ? "Онлайн" : r.format === "hybrid" ? "Онлайн + офлайн" : "Офлайн"} · ${r.cost} · ${r.duration}`
                        : date(r.published_at)
                    }
                  />
                ))}
              </div>
            )}
            <Pagination
              page={page}
              count={q.data.count}
              onChange={(v) => {
                const n = new URLSearchParams(params);
                n.set("page", String(v));
                setParams(n);
              }}
            />
          </>
        ) : (
          <Empty text="За вашими фільтрами нічого не знайдено" />
        )}
      </State>
    </div>
  );
}
function EventCalendar({ rows }: { rows: Row[] }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [y, m] = month.split("-").map(Number);
  const count = new Date(y, m, 0).getDate(),
    offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  return (
    <>
      <label>
        Місяць
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <p className="muted">
        Календар показує події поточної сторінки результатів.
      </p>
      <div className="calendar-grid">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
          <b key={d}>{d}</b>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={"blank" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => (
          <div key={i}>
            <b>{i + 1}</b>
            {rows
              .filter((r) =>
                new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Kyiv" })
                  .format(new Date(r.starts_at))
                  .startsWith(`${month}-${String(i + 1).padStart(2, "0")}`),
              )
              .map((r) => (
                <Link key={r.id} to={"/events/" + r.slug}>
                  {r.title}
                </Link>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
export function Detail() {
  const { settings } = useSettings();
  const { slug } = useParams();
  const table = window.location.pathname.includes("/services")
    ? "services"
    : window.location.pathname.includes("/news")
      ? "news"
      : window.location.pathname.includes("/documents")
        ? "documents"
        : "events";
  const q = useData(() => get(table, "slug", slug!), [table, slug]);
  const auth = useAuth(),
    toast = useToast();
  const saved = useData(
    () =>
      auth.session && q.data && table === "services"
        ? list("saved_services", { eq: { service_id: q.data.id }, size: 1 })
        : Promise.resolve({ rows: [], count: 0 }),
    [auth.session?.user.id, q.data?.id],
  );
  useEffect(() => {
    if (!q.data) return;
    document.title = q.data.title + " · " + settings.name;
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
    ])
      document
        .querySelector(selector)
        ?.setAttribute(
          "content",
          q.data.summary || q.data.description || settings.description || "",
        );
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", document.title);
  }, [q.data?.id, settings.name]);
  const [pdf, setPdf] = useState(""),
    [full, setFull] = useState(false);
  useEffect(() => {
    let active = true;
    if (
      table === "documents" &&
      q.data?.file_path &&
      /\.pdf$/i.test(q.data.file_path)
    )
      fileUrl("documents", q.data.file_path)
        .then((u) => {
          if (active) setPdf(u);
        })
        .catch((e) => toast(errorText(e), "error"));
    return () => {
      active = false;
    };
  }, [q.data?.file_path]);
  return (
    <div className="container page">
      <Link className="back" to={"/" + table}>
        ← {titles[table]}
      </Link>
      <State loading={q.loading} error={q.error}>
        {q.data && (
          <>
            <div className="detail-head">
              <p className="eyebrow">
                {table === "services"
                  ? "Міська послуга"
                  : date(q.data.published_at)}
              </p>
              {q.data.is_demo && <Badge value="Демо" />}
              <h1>{q.data.title}</h1>
              <p className="lead">{q.data.summary || q.data.description}</p>
            </div>
            {table === "services" ? (
              <div className="detail-grid">
                <article>
                  <Markdown value={q.data.content} />
                  {[
                    ["Хто може отримати", "eligibility"],
                    ["Необхідні документи", "requirements"],
                    ["Як отримати", "steps"],
                    ["Результат", "result"],
                    ["Підстава", "legal_basis"],
                    ["Контакти", "contacts"],
                  ].map(([t, k]) => (
                    <section key={k}>
                      <h2>{t}</h2>
                      <Markdown value={q.data![k]} />
                    </section>
                  ))}
                  {(q.data.faq || []).map((f: any, i: number) => (
                    <details key={i}>
                      <summary>{f.question}</summary>
                      <Markdown value={f.answer} />
                    </details>
                  ))}
                </article>
                <aside className="panel sticky">
                  <p className="eyebrow">Про послугу</p>
                  <p>
                    <b>Формат</b>
                    <br />
                    {q.data.format === "online"
                      ? "Онлайн"
                      : q.data.format === "hybrid"
                        ? "Онлайн + офлайн"
                        : "Офлайн"}
                  </p>
                  <p>
                    <b>Термін</b>
                    <br />
                    {q.data.duration || "Не зазначено"}
                  </p>
                  <p>
                    <b>Вартість</b>
                    <br />
                    {q.data.cost}
                  </p>
                  {q.data.format !== "offline" && q.data.available && (
                    <Link
                      className="button"
                      to={"/services/" + q.data.slug + "/apply"}
                    >
                      Отримати послугу <ArrowUpRight size={18} />
                    </Link>
                  )}
                  {!q.data.available && (
                    <div className="alert">Послуга тимчасово недоступна</div>
                  )}
                  {auth.session ? (
                    <Button
                      className="secondary"
                      onClick={async () => {
                        try {
                          if (saved.data?.rows[0])
                            await remove(
                              "saved_services",
                              saved.data.rows[0].id,
                            );
                          else
                            await save("saved_services", {
                              user_id: auth.session!.user.id,
                              service_id: q.data!.id,
                            });
                          saved.reload();
                        } catch (e) {
                          toast(errorText(e), "error");
                        }
                      }}
                    >
                      {saved.data?.count
                        ? "Видалити зі збережених"
                        : "Зберегти послугу"}
                    </Button>
                  ) : (
                    <Link to="/auth/login">Увійдіть, щоб зберегти</Link>
                  )}
                </aside>
              </div>
            ) : table === "documents" ? (
              <>
                <div className="panel row">
                  <span>
                    № {q.data.document_number || "—"} · {date(q.data.date)} ·{" "}
                    {q.data.filename || "Файл ще не завантажено"}
                  </span>
                  {q.data.file_path && (
                    <FileLink
                      bucket="documents"
                      path={q.data.file_path}
                      name={q.data.filename || "Завантажити файл"}
                      download
                    />
                  )}
                  {pdf && (
                    <Button className="secondary" onClick={() => setFull(true)}>
                      <Expand size={18} />
                      На весь екран
                    </Button>
                  )}
                </div>
                {pdf ? (
                  <iframe
                    className="pdf-viewer"
                    src={pdf}
                    title={q.data.title}
                  />
                ) : (
                  <Empty
                    text={
                      q.data.file_path
                        ? "Цей формат відкривається через кнопку завантаження"
                        : "PDF ще не додано"
                    }
                  />
                )}
                {full && (
                  <Modal title={q.data.title} onClose={() => setFull(false)}>
                    <iframe
                      className="pdf-viewer full"
                      src={pdf}
                      title={q.data.title}
                    />
                  </Modal>
                )}
              </>
            ) : (
              <article className="article">
                <Media
                  bucket={table}
                  path={q.data.cover_path}
                  alt={q.data.title}
                />
                {table === "events" && (
                  <div className="panel">
                    <p>
                      {datetime(q.data.starts_at)} · {q.data.location}
                    </p>
                    <p>Організатор: {q.data.organizer || "Не зазначено"}</p>
                    {/^https?:\/\//.test(q.data.registration_url || "") && (
                      <a
                        className="button"
                        href={q.data.registration_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Реєстрація
                      </a>
                    )}
                  </div>
                )}
                <Markdown value={q.data.content} />
                {table === "news" && (
                  <>
                    <p className="muted">{q.data.author}</p>
                    <div className="grid three">
                      {(q.data.gallery || []).map((p: string) => (
                        <Media
                          key={p}
                          bucket="news"
                          path={p}
                          alt="Зображення галереї"
                        />
                      ))}
                    </div>
                  </>
                )}
              </article>
            )}
          </>
        )}
      </State>
    </div>
  );
}
export function CityNow({ compact = false }: { compact?: boolean }) {
  const q = useData(async () => {
    const [cache, manual] = await Promise.all([
      list("api_cache", { eq: { key: "alerts" }, size: 1 }),
      list("city_status", { size: 20 }),
    ]);
    return { cache: cache.rows[0], manual: manual.rows };
  });
  useEffect(() => {
    const t = setInterval(q.reload, 30000);
    return () => clearInterval(t);
  }, []);
  const c = q.data?.cache,
    p = c?.payload,
    stale =
      !c?.refreshed_at ||
      Date.now() - new Date(c.refreshed_at).getTime() > 120000;
  const state = stale ? "unknown" : p?.state || "unknown";
  const alertLabel =
    state === "active"
      ? "Повітряна тривога"
      : state === "inactive"
        ? "Активну тривогу не зафіксовано"
        : "Дані тривоги недоступні";
  const content = (
    <State loading={q.loading} error={q.error}>
      <div className={"status-grid " + (compact ? "compact" : "")}>
        <div
          className={
            "status-card " +
            (state === "active"
              ? "danger"
              : state === "inactive"
                ? "normal"
                : "info")
          }
        >
          <div className="status-icon">
            <ShieldCheck size={25} />
          </div>
          <p className="eyebrow">Повітряна тривога</p>
          <h3>{alertLabel}</h3>
          <p>{p?.scope || "Черкаський район та Черкаська область"}</p>
          <small>
            Джерело: alerts.in.ua ·{" "}
            {c?.refreshed_at
              ? datetime(c.refreshed_at)
              : "Ще не синхронізовано"}
          </small>
          {stale && c?.refreshed_at && (
            <p>Попередні дані застаріли. Поточний стан невідомий.</p>
          )}
        </div>
        {q.data?.manual
          .filter((r) => r.is_active)
          .slice(0, compact ? 2 : 20)
          .map((r) => (
            <div key={r.id} className={"status-card " + r.severity}>
              <Activity size={24} />
              <p className="eyebrow">{r.type}</p>
              <h3>{r.title}</h3>
              <p>{r.description}</p>
              <small>
                {r.source_label} · {datetime(r.started_at)}
              </small>
            </div>
          ))}
        {!q.data?.manual.length && (
          <div className="status-card info">
            <Activity size={24} />
            <h3>Оперативні повідомлення</h3>
            <p>
              Інформацію про транспорт, роботи й відключення додає диспетчер.
            </p>
            <small>Поки що немає опублікованих повідомлень.</small>
          </div>
        )}
      </div>
    </State>
  );
  return compact ? (
    content
  ) : (
    <div className="container page">
      <p className="eyebrow">Оперативна інформація</p>
      <h1>Черкаси зараз</h1>
      <p className="lead">Оновлення про місто та поточний стан тривоги.</p>
      {content}
    </div>
  );
}
export function SearchPage() {
  const [params, setParams] = useSearchParams(),
    term = params.get("q") || "",
    d = useDebounce(term);
  const q = useData(async () => {
    const tables = ["services", "news", "documents", "events", "faqs"];
    return Promise.all(
      tables.map(async (table) => ({
        table,
        ...(await list(table, {
          search: d,
          searchColumns:
            table === "faqs"
              ? ["question", "answer"]
              : table === "documents"
                ? ["title", "description"]
                : ["title", "summary"],
          size: 8,
          visible: table !== "faqs",
        })),
      })),
    );
  }, [d]);
  return (
    <div className="container page">
      <h1>Пошук на порталі</h1>
      <SearchBar
        value={term}
        onChange={(v) => setParams({ q: v })}
        placeholder="Послуга, новина або документ"
      />
      <State loading={q.loading} error={q.error}>
        {q.data?.map((g) => (
          <Section key={g.table} title={titles[g.table] || "Допомога"}>
            {g.count ? (
              <div className="grid two">
                {g.rows.map((r) =>
                  g.table === "faqs" ? (
                    <details key={r.id}>
                      <summary>{r.question}</summary>
                      <Markdown value={r.answer} />
                    </details>
                  ) : (
                    <Card
                      key={r.id}
                      row={r}
                      to={"/" + g.table + "/" + r.slug}
                    />
                  ),
                )}
              </div>
            ) : (
              <p className="muted">Нічого не знайдено</p>
            )}
          </Section>
        ))}
      </State>
    </div>
  );
}
export function Help() {
  const q = useData(() =>
    list("faqs", { size: 100, order: "sort_order", ascending: true }),
  );
  return (
    <div className="container page narrow">
      <p className="eyebrow">Підтримка</p>
      <h1>Чим можемо допомогти?</h1>
      <State loading={q.loading} error={q.error}>
        {[...new Set(q.data?.rows.map((r) => r.category))].map((c) => (
          <section key={c}>
            <h2>{c}</h2>
            {q.data?.rows
              .filter((r) => r.category === c)
              .map((r) => (
                <details key={r.id}>
                  <summary>{r.question}</summary>
                  <Markdown value={r.answer} />
                </details>
              ))}
          </section>
        ))}
      </State>
      <div className="panel">
        <h2>Не знайшли відповідь?</h2>
        <p>Напишіть звернення у категорії «Інше».</p>
        <Link className="button" to="/appeals">
          Створити звернення
        </Link>
      </div>
    </div>
  );
}
export function Info() {
  const { settings } = useSettings(),
    path = window.location.pathname;
  const isPrivacy = path.endsWith("privacy"),
    isTerms = path.endsWith("terms");
  return (
    <div className="container page narrow">
      <h1>
        {isPrivacy
          ? "Політика конфіденційності"
          : isTerms
            ? "Умови використання"
            : "Доступність"}
      </h1>
      <Markdown
        value={
          isPrivacy
            ? settings.privacy_text
            : isTerms
              ? settings.terms_text
              : "Портал підтримує клавіатурну навігацію, видимий фокус, підписи полів, адаптивний дизайн і посилання «До вмісту». Для допомоги відкрийте центр підтримки."
        }
      />
    </div>
  );
}
export function NotFound() {
  return (
    <div className="container page">
      <p className="eyebrow">404</p>
      <h1>Цієї сторінки немає</h1>
      <p>Перевірте адресу або поверніться на головну.</p>
      <Link className="button" to="/">
        На головну
      </Link>
    </div>
  );
}
