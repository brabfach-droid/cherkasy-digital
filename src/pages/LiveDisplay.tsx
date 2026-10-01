import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Maximize2,
  Newspaper,
  Radio,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useCity } from "../hooks/City";
import { useSettings } from "../hooks/Settings";
import { useData } from "../hooks/useData";
import { list } from "../services/data";
import { siteUrl, configured, requireClient } from "../services/client";
import type { Row } from "../config/types";
import { ageLabel, citySeverity, kyivDayBounds } from "../utils/city";
import { APP_VERSION, QR } from "../components/V2";
import { displayConfig, displayLabels, sceneDuration } from "../config/display";
const time = (v: string | number) =>
  new Date(v).toLocaleTimeString("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
  });
const day = (v: string | number) =>
  new Date(v).toLocaleDateString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "long",
  });
function Count({ value }: { value: number }) {
  const [shown, setShown] = useState(value),
    last = useRef(value),
    reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      setShown(value);
      last.current = value;
      return;
    }
    const from = last.current,
      start = performance.now();
    let frame = 0;
    const tick = (at: number) => {
      const p = Math.min(1, (at - start) / 550);
      setShown(Math.round(from + (value - from) * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    last.current = value;
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <>{shown}</>;
}
function NewsImage({ row, mode }: { row: Row; mode: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [row.id, row.cover_path]);
  const src =
    row.cover_path && configured
      ? requireClient().storage.from("news").getPublicUrl(row.cover_path)
          .data.publicUrl
      : "";
  return (
    <div className={"broadcast-photo image-mode-" + mode}>
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <div className="broadcast-photo-placeholder">
          <Newspaper />
          <span>
            ЧЕРКАСИ
            <br />
            ЦИФРОВІ
          </span>
          <small>Міська інформація</small>
        </div>
      )}
      <span className="photo-caption">
        {row.is_demo ? "ДЕМОНСТРАЦІЙНИЙ МАТЕРІАЛ" : "ЧЕРКАСИ · НОВИНИ"}
      </span>
    </div>
  );
}
export default function LiveDisplay() {
  const c = useCity(),
    { settings, reload: reloadSettings } = useSettings(),
    reduced = useReducedMotion(),
    [step, setStep] = useState(0),
    [awake, setAwake] = useState(true),
    [fullError, setFullError] = useState(""),
    [fullscreen, setFullscreen] = useState(false),
    [overlay, setOverlay] = useState<{ kind: string; until: number } | null>(
      null,
    ),
    last = useRef<string | null>(null),
    root = useRef<HTMLDivElement>(null);
  const preview = new URLSearchParams(location.search).get("preview") === "1";
  let draft;
  try {
    draft = preview
      ? JSON.parse(sessionStorage.getItem("display-preview") || "null")
      : null;
  } catch {}
  const cfg = displayConfig(draft || settings.display || {});
  const q = useData(async () => {
    const b = kyivDayBounds();
    const entries = await Promise.allSettled([
      list("news", {
        visible: true,
        size: cfg.news_count,
        order: "published_at",
      }),
      list("events", {
        visible: true,
        size: cfg.events_count,
        order: "starts_at",
        ascending: true,
        gte: { starts_at: b.start },
        lte: { starts_at: b.end },
      }),
      list("services", {
        visible: true,
        size: 3,
        eq: { available: true, format: "online" },
      }),
      list("documents", { visible: true, size: 3, order: "published_at" }),
      list("news_categories", { size: 100 }),
    ]);
    return Object.fromEntries(
      entries.map((r, i) => [
        ["news", "events", "services", "documents", "categories"][i],
        r.status === "fulfilled"
          ? { ...r.value, checkedAt: Date.now(), error: false }
          : { rows: [], count: 0, error: true, checkedAt: 0 },
      ]),
    );
  }, [cfg.news_count, cfg.events_count]);
  useEffect(() => {
    const t = setInterval(() => {
      q.reload();
      reloadSettings();
    }, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (c.air === "unknown") return;
    if (c.air === "active" && last.current !== "active")
      setOverlay({ kind: "alert", until: Date.now() + 7000 });
    else if (c.air === "inactive" && last.current === "active")
      setOverlay({ kind: "clear", until: Date.now() + 5000 });
    last.current = c.air;
  }, [c.air]);
  useEffect(() => {
    if (!overlay) return;
    const timer = setTimeout(
      () => setOverlay(null),
      Math.max(0, overlay.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [overlay]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setAwake(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAwake(false), 3500);
    };
    const change = () => setFullscreen(!!document.fullscreenElement);
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    document.addEventListener("fullscreenchange", change);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
      document.removeEventListener("fullscreenchange", change);
    };
  }, []);
  const important = c.announcements.filter(
      (r) =>
        ["critical", "warning", "danger", "maintenance"].includes(r.type) ||
        Number(r.priority) > 0,
    ),
    critical =
      c.announcements.find((r) => r.type === "critical") ||
      c.city.find((r) => r.severity === "critical"),
    severity = citySeverity(c.city, c.announcements),
    mode =
      c.air === "active"
        ? "alert"
        : critical
          ? "critical"
          : severity === "warning"
            ? "warning"
            : c.air === "unknown"
              ? "unknown"
              : "normal";
  const order: string[] = [...cfg.blocks];
  if (important.length && !order.includes("announcements"))
    order.splice(1, 0, "announcements");
  const slides = order.flatMap<{ scene: string; id: string; row: Row | null }>(
    (scene) =>
      scene === "news"
        ? q.data?.news.rows.length
          ? q.data.news.rows.map((r: Row) => ({ scene, id: r.id, row: r }))
          : [{ scene, id: "news-empty", row: null }]
        : scene === "announcements"
          ? important.length
            ? important.map((r) => ({ scene, id: r.id, row: r }))
            : [{ scene, id: "announcements-empty", row: null }]
          : scene === "documents"
            ? q.data?.documents.rows.length
              ? q.data.documents.rows.map((r: Row) => ({
                  scene,
                  id: r.id,
                  row: r,
                }))
              : [{ scene, id: "documents-empty", row: null }]
            : [{ scene, id: scene, row: null }],
  );
  const current = slides[step % slides.length],
    scene = current.scene,
    row = current.row;
  useEffect(() => {
    const t = setTimeout(
      () => setStep((s) => s + 1),
      sceneDuration(cfg, scene),
    );
    return () => clearTimeout(t);
  }, [
    step,
    scene,
    JSON.stringify(slides.map((s) => s.id)),
    JSON.stringify(cfg.durations),
    cfg.interval,
  ]);
  const news = q.data?.news,
    events = q.data?.events,
    services = q.data?.services,
    docs = q.data?.documents,
    latest = c.city
      .map((r) => r.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1),
    sourceError = !!c.errors.city || !!c.errors.announcements,
    airText =
      c.air === "active"
        ? "ПОВІТРЯНА ТРИВОГА"
        : c.air === "inactive"
          ? "Тривоги немає"
          : "Статус тривоги недоступний";
  const modules = [
    {
      label: "ТРАНСПОРТ",
      value: c.city.filter((r) => /транспорт/i.test(r.type)).length,
      text: "активних повідомлень",
      error: !!c.errors.city || !c.checked.city,
    },
    {
      label: "КОМУНАЛЬНІ РОБОТИ",
      value: c.city.filter((r) => /робот|відключ/i.test(r.type)).length,
      text: "активних повідомлень",
      error: !!c.errors.city || !c.checked.city,
    },
    {
      label: "ПЕРЕКРИТТЯ",
      value: c.city.filter((r) => /перекрит/i.test(r.type)).length,
      text: "ділянок із повідомленнями",
      error: !!c.errors.city || !c.checked.city,
    },
    {
      label: "ПОДІЇ СЬОГОДНІ",
      value: events?.count || 0,
      text: "опублікованих подій",
      error: !events || events.error,
    },
  ];
  const items = [
    ...(c.air === "active"
      ? [
          {
            id: "air",
            at: c.cache?.payload?.started_at,
            text: "ПОВІТРЯНА ТРИВОГА · ЧЕРКАСИ · Слідкуйте за офіційними повідомленнями",
            alert: true,
          },
        ]
      : []),
    ...[
      ...c.city.map((r) => ({
        id: "c" + r.id,
        at: r.updated_at,
        text: r.title,
      })),
      ...c.announcements.map((r) => ({
        id: "a" + r.id,
        at: r.updated_at || r.start_at,
        text: r.title,
      })),
      ...(news?.rows || []).map((r: Row) => ({
        id: "n" + r.id,
        at: r.published_at,
        text: r.title,
      })),
      ...(docs?.rows || []).map((r: Row) => ({
        id: "d" + r.id,
        at: r.published_at,
        text: r.title,
      })),
    ]
      .filter((r) => r.at)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 8),
  ];
  const feed = items.length
    ? items
    : [
        {
          id: "empty",
          at: "",
          text: sourceError
            ? "Оновлення міських даних недоступне"
            : "Нових оперативних повідомлень немає",
        },
      ];
  const qr =
    scene === "news" && row
      ? siteUrl() + "news/" + row.slug
      : scene === "documents" && row
        ? siteUrl() + "documents/" + row.slug
        : scene === "services"
          ? siteUrl() + "services"
          : /^https?:\/\//.test(cfg.qr_url || "")
            ? cfg.qr_url
            : siteUrl();
  const freshness =
    scene === "news"
      ? news
      : scene === "events"
        ? events
        : scene === "services"
          ? services
          : scene === "documents"
            ? docs
            : null;
  const empty = (name: string, data: any) =>
    data?.error
      ? "Не вдалося оновити " + name
      : !data
        ? "Отримуємо матеріали…"
        : "Наразі немає опублікованих матеріалів";
  return (
    <div
      ref={root}
      className={
        "live-display broadcast " +
        mode +
        (!awake ? " cursor-hidden" : "") +
        (preview ? " preview" : "")
      }
      style={
        {
          "--screen-bg": cfg.background,
          "--screen-accent": cfg.accent,
        } as CSSProperties
      }
    >
      <div className="display-atmosphere" aria-hidden="true">
        <span />
        <i />
      </div>
      <header className="broadcast-top">
        <div className="broadcast-brand">
          <strong>{cfg.title || "Черкаси"}</strong>
          <span>ЦИФРОВЕ МІСТО{!configured ? " · ДЕМО" : ""}</span>
        </div>
        <div className="broadcast-status">
          <div className={"display-air " + c.air}>
            <span className="status-dot" />
            {airText}
          </div>
          <span>
            {critical
              ? "Термінова міська інформація"
              : sourceError
                ? "Міські дані недоступні"
                : severity === "warning"
                  ? "Є важливі міські повідомлення"
                  : c.checked.city
                    ? "Міські повідомлення перевірено"
                    : "Отримуємо міські дані"}
          </span>
          <small>
            {c.errors.alerts
              ? "Немає зв’язку з джерелом тривог"
              : c.cache?.refreshed_at
                ? "Тривоги: оновлено " + ageLabel(c.cache.refreshed_at, c.now)
                : "Очікуємо дані тривоги"}
          </small>
        </div>
        <div className="broadcast-clock">
          {cfg.show_clock && <time>{time(c.now)}</time>}
          {cfg.show_date && <span>{day(c.now)}</span>}
        </div>
      </header>
      <main className="broadcast-stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={current.id}
            className={"display-scene broadcast-scene scene-" + scene+(cfg.news_image_mode==="fullbleed"?" fullbleed":"")}
            initial={{
              opacity: 0,
              x: reduced || cfg.transition === "fade" ? 0 : 35,
            }}
            animate={{ opacity: 1, x: 0 }}
            exit={{
              opacity: 0,
              x: reduced || cfg.transition === "fade" ? 0 : -25,
            }}
            transition={{
              duration: reduced ? 0 : 0.65,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {scene === "news" ? (
              row ? (
                <>
                  <NewsImage row={row} mode={cfg.news_image_mode} />
                  <div className="broadcast-story">
                    <span className="broadcast-kicker">
                      {q.data?.categories.rows.find(
                        (r: Row) => r.id === row.category_id,
                      )?.name || "МІСТО · НОВИНИ"}
                    </span>
                    <h1>{row.title}</h1>
                    <p>{row.summary}</p>
                    <time>{day(row.published_at || row.created_at)}</time>
                  </div>
                </>
              ) : (
                <div className="broadcast-empty">
                  <span className="broadcast-kicker">НОВИНИ МІСТА</span>
                  <h1>{empty("новини", news)}</h1>
                </div>
              )
            ) : scene === "city" ? (
              <div className="broadcast-city">
                <span className="broadcast-kicker">ОПЕРАТИВНА ІНФОРМАЦІЯ</span>
                <h1>ЧЕРКАСИ ЗАРАЗ</h1>
                <div className="broadcast-modules">
                  {modules.map((m) => (
                    <article key={m.label}>
                      <span>{m.label}</span>
                      <strong>
                        {m.error ? "—" : <Count value={m.value} />}
                      </strong>
                      <p>
                        {m.error
                          ? "Дані недоступні"
                          : m.value === 0
                            ? "опублікованих повідомлень немає"
                            : m.text}
                      </p>
                    </article>
                  ))}
                </div>
                <p className="broadcast-city-note">
                  {latest
                    ? "Остання зміна міських повідомлень " +
                      ageLabel(latest, c.now)
                    : c.checked.city
                      ? "Перевірено " + ageLabel(c.checked.city, c.now)
                      : "Очікуємо міські дані"}
                </p>
              </div>
            ) : scene === "announcements" ? (
              <div
                className={
                  "broadcast-notice " +
                  (row?.type === "critical" ? "display-critical" : "")
                }
              >
                <span className="broadcast-kicker">ВАЖЛИВА ІНФОРМАЦІЯ</span>
                <h1>{row?.title || "Активних важливих оголошень немає"}</h1>
                <p>
                  {row?.message ||
                    (c.errors.announcements
                      ? "Оголошення тимчасово недоступні"
                      : "Слідкуйте за міськими новинами")}
                </p>
              </div>
            ) : scene === "events" ? (
              <div className="broadcast-events">
                <span className="broadcast-kicker">МІСЬКИЙ КАЛЕНДАР</span>
                <h1>СЬОГОДНІ У ЧЕРКАСАХ</h1>
                <div>
                  {events?.rows.length ? (
                    events.rows.map((r: Row) => (
                      <article key={r.id}>
                        <time>{time(r.starts_at)}</time>
                        <div>
                          <h2>{r.title}</h2>
                          <p>{r.location}</p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>
                      {events?.error
                        ? "Події тимчасово недоступні"
                        : events
                          ? "На сьогодні немає опублікованих подій"
                          : "Отримуємо події…"}
                    </p>
                  )}
                </div>
              </div>
            ) : scene === "services" ? (
              <div className="broadcast-services">
                <span className="broadcast-kicker">ПОСЛУГИ БЕЗ ЧЕРГ</span>
                <h1>
                  {services && !services.error ? (
                    <>
                      <Count value={services.count} /> МІСЬКИХ
                      <br />
                      ПОСЛУГ ОНЛАЙН
                    </>
                  ) : (
                    "МІСЬКІ ПОСЛУГИ ОНЛАЙН"
                  )}
                </h1>
                <div>
                  <p>Подати заяву</p>
                  <p>Перевірити статус</p>
                  <p>Знайти документ</p>
                </div>
                {services?.error && <p>Каталог тимчасово недоступний</p>}
              </div>
            ) : (
              <div className="broadcast-document">
                <span className="broadcast-kicker">ОФІЦІЙНЕ ПОВІДОМЛЕННЯ</span>
                <h1>{row?.title || empty("документи", docs)}</h1>
                <p>{row?.description}</p>
                {row && (
                  <div className="document-details">
                    <strong>
                      {row.document_number
                        ? "№ " + row.document_number
                        : "Офіційний документ"}
                    </strong>
                    <time>{day(row.date || row.published_at)}</time>
                  </div>
                )}
              </div>
            )}
          </motion.section>
        </AnimatePresence>
        {cfg.show_qr && (
          <aside className="broadcast-qr">
            <QR value={qr} label="Відкрити на телефоні" />
          </aside>
        )}
      </main>
      <div className="broadcast-rail">
        <span>
          {String((step % slides.length) + 1).padStart(2, "0")} /{" "}
          {String(slides.length).padStart(2, "0")} · {displayLabels[scene]}
        </span>
        <span>
          {freshness?.error
            ? "Оновлення матеріалів недоступне"
            : freshness?.checkedAt
              ? "Матеріали перевірено " + ageLabel(freshness.checkedAt, c.now)
              : sourceError
                ? "Оновлення недоступне"
                : c.checked.city
                  ? "Міські дані перевірено " + ageLabel(c.checked.city, c.now)
                  : "Отримуємо дані"}
        </span>
        <small>v{APP_VERSION}</small>
      </div>
      {cfg.ticker && (
        <div className="display-ticker broadcast-ticker">
          <span className="ticker-label">
            <Radio />
            МІСТО ЗАРАЗ
          </span>
          <div className="ticker-window">
            <div
              className={"ticker-track " + (!reduced ? "moving" : "")}
              style={{
                animationDuration:
                  Math.max(
                    35,
                    feed.reduce((n, r) => n + r.text.length, 0) * 0.3,
                  ) + "s",
              }}
            >
              {[0, 1].map((copy) => (
                <div key={copy} aria-hidden={copy === 1}>
                  {feed.map((r) => (
                    <span
                      key={r.id}
                      className={"alert" in r ? "ticker-alert" : ""}
                    >
                      {r.at && <time>{time(r.at)}</time>}
                      {r.text}
                      <b>•</b>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {overlay && (
        <div
          key={overlay.until}
          className={"broadcast-overlay " + overlay.kind}
          style={{ animationDuration: overlay.kind === "alert" ? "7s" : "5s" }}
          role="status"
        >
          {overlay.kind === "alert" ? <ShieldAlert /> : <ShieldCheck />}
          <span>ЧЕРКАСИ · ЧЕРКАСЬКИЙ РАЙОН ТА ОБЛАСТЬ</span>
          <h2>
            {overlay.kind === "alert"
              ? "ПОВІТРЯНА ТРИВОГА"
              : "ВІДБІЙ ПОВІТРЯНОЇ ТРИВОГИ"}
          </h2>
          <p>
            {overlay.kind === "alert"
              ? c.cache?.payload?.started_at
                ? "Початок: " + time(c.cache.payload.started_at)
                : "Слідкуйте за офіційними повідомленнями"
              : "За свіжими даними alerts.in.ua"}
          </p>
          <small>Міська інформація продовжить показуватися</small>
        </div>
      )}
      {!preview && (
        <div className={"broadcast-tools " + (awake ? "visible" : "")}>
          <button
            aria-label="На весь екран"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await root.current?.requestFullscreen();
                setFullError("");
              } catch {
                setFullError("Для повного екрана натисніть F11");
              }
            }}
          >
            <Maximize2 />
            {fullscreen
              ? "Вийти з повного екрана"
              : "Увімкнути повноекранний режим"}
          </button>
          {cfg.fullscreen_default && !fullscreen && (
            <span>Натисніть, щоб запустити табло на весь екран</span>
          )}
          {fullError && <span role="status">{fullError}</span>}
        </div>
      )}
    </div>
  );
}
