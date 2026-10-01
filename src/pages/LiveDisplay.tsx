import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Activity,
  BusFront,
  Construction,
  CalendarDays,
  ShieldAlert,
  ShieldCheck,
  CloudOff,
  Radio,
  Pause,
  Play,
  Maximize2,
  Newspaper,
  MapPin,
  Clock3,
} from "lucide-react";
import { useCity } from "../hooks/City";
import { useSettings } from "../hooks/Settings";
import { useData } from "../hooks/useData";
import { list } from "../services/data";
import { siteUrl, configured } from "../services/client";
import { datetime, type Row } from "../config/types";
import {
  ageLabel,
  citySeverity,
  todayEvents,
  kyivDayBounds,
} from "../utils/city";
import { APP_VERSION, QR } from "../components/V2";
import { Freshness } from "../components/CityLive";
import { motionTokens } from "../config/motion";
const scenes = ["city", "announcements", "events", "services", "news"];
const labels: Record<string, string> = {
  city: "Черкаси зараз",
  announcements: "Важливі повідомлення",
  events: "Події сьогодні",
  services: "Міські сервіси",
  news: "Останні новини",
};
function Count({ value }: { value: number }) {
  const [shown, setShown] = useState(value),
    previous = useRef(value),
    reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      setShown(value);
      previous.current = value;
      return;
    }
    const from = previous.current,
      start = performance.now();
    let frame: number;
    function tick(at: number) {
      const p = Math.min(1, (at - start) / 400);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    previous.current = value;
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <span>{shown}</span>;
}
export default function LiveDisplay() {
  const c = useCity(),
    { settings } = useSettings(),
    reduced = useReducedMotion(),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [fullscreenError, setFullscreenError] = useState(""),
    [clearUntil, setClearUntil] = useState(0),
    lastConfirmed = useRef<"active" | "inactive" | null>(null);
  const cfg = settings.display || {},
    date = new Date(c.now),
    interval = Math.max(5, Math.min(120, Number(cfg.interval) || 15));
  const blocks = (Array.isArray(cfg.blocks) ? cfg.blocks : scenes).filter(
    (v: string) => scenes.includes(v),
  );
  const order: string[] = blocks.length ? blocks : ["city"];
  const q = useData(async () => {
    const bounds = kyivDayBounds();
    const [events, news, services] = await Promise.all([
      list("events", {
        visible: true,
        size: 4,
        order: "starts_at",
        ascending: true,
        gte: { starts_at: bounds.start },
        lte: { starts_at: bounds.end },
      }),
      list("news", { visible: true, size: 5, order: "published_at" }),
      list("services", { visible: true, size: 5, eq: { available: true } }),
    ]);
    return {
      events: events.rows,
      eventsCount: events.count,
      news: news.rows,
      services: services.rows,
      checkedAt: Date.now(),
    };
  });
  useEffect(() => {
    const t = setInterval(q.reload, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (c.air === "unknown") return;
    if (lastConfirmed.current === "active" && c.air === "inactive")
      setClearUntil(Date.now() + 8000);
    if (c.air === "active") setClearUntil(0);
    lastConfirmed.current = c.air;
  }, [c.air]);
  const allClear = c.air === "inactive" && c.now < clearUntil,
    criticalAnnouncement = c.announcements.find((r) => r.type === "critical"),
    criticalCity = c.city.find((r) => r.severity === "critical");
  const critical = criticalAnnouncement || criticalCity;
  const mode =
    c.air === "active"
      ? "alert"
      : allClear
        ? "all-clear"
        : critical
          ? "critical"
          : citySeverity(c.city, c.announcements) === "warning"
            ? "warning"
            : c.air === "unknown"
              ? "unknown"
              : "normal";
  const priority = ["alert", "all-clear", "critical"].includes(mode);
  const scene = priority ? mode : order[index % order.length];
  useEffect(() => {
    if (paused || priority) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % order.length),
      interval * 1000,
    );
    return () => clearInterval(t);
  }, [paused, priority, interval, JSON.stringify(order)]);
  const today = todayEvents(q.data?.events || [], c.now),
    works = c.city.filter((r) => /робот|відключ/i.test(r.type)),
    roads = c.city.filter((r) => /перекрит/i.test(r.type)),
    transport = c.city.filter((r) => /транспорт/i.test(r.type));
  const headline =
    scene === "alert"
      ? "ПОВІТРЯНА\nТРИВОГА"
      : scene === "all-clear"
        ? "ВІДБІЙ ПОВІТРЯНОЇ\nТРИВОГИ"
        : scene === "critical"
          ? critical?.title || "Термінова інформація"
          : scene === "city"
            ? mode === "warning"
              ? "Місто реагує\nна події"
              : c.errors.city
                ? "Міські дані\nнедоступні"
                : !c.checked.city
                  ? "Отримуємо\nміські дані"
                  : configured
                    ? "Черкаси працюють\nу штатному режимі"
                    : "Черкаси —\nдемоперегляд"
            : labels[scene];
  const latestCity = c.city
      .map((r) => r.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1),
    qr = priority
      ? siteUrl() + "now"
      : /^https?:\/\//.test(cfg.qr_url || "")
        ? cfg.qr_url
        : siteUrl();
  const feedItems = [
    ...c.city.map((r) => ({ id: "c" + r.id, at: r.updated_at, text: r.title })),
    ...c.announcements.map((r) => ({
      id: "a" + r.id,
      at: r.updated_at || r.start_at,
      text: r.title,
    })),
  ]
    .filter((r) => r.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 6);
  const dotLabel =
    c.air === "active"
      ? "ПОВІТРЯНА ТРИВОГА"
      : c.air === "inactive"
        ? "Тривоги немає"
        : "Тривога: стан невідомий";
  const sceneRows =
    scene === "announcements"
      ? c.announcements.slice(0, 3)
      : scene === "events"
        ? today.slice(0, 3)
        : scene === "services"
          ? q.data?.services.slice(0, 3) || []
          : scene === "news"
            ? q.data?.news.slice(0, 3) || []
            : [];
  return (
    <div
      className={
        "live-display " +
        mode +
        (cfg.theme === "light" ? " display-light" : "") +
        (cfg.fullscreen_friendly === false ? " display-compact" : "")
      }
    >
      <div className="display-atmosphere" aria-hidden="true">
        <span />
        <span />
        <i />
      </div>
      <header className="display-top">
        <div className="display-identity">
          <Link to="/">
            Черкаси<span>{cfg.title || settings.name}</span>
          </Link>
          <div className="display-source">
            <Radio size={13} />
            {configured
              ? "Міський інформаційний екран"
              : "Демонстраційний екран"}
            <span>ЧЕРКАСЬКИЙ РАЙОН · ОБЛАСТЬ</span>
          </div>
        </div>
        <div className="display-top-status">
          <span className={"display-air " + c.air}>
            <span className="status-dot" />
            {dotLabel}
          </span>
          <Freshness at={c.cache?.refreshed_at} error={!!c.errors.alerts} />
          <span className="display-city-state">
            <Activity size={13} />
            {c.errors.city
              ? "Міські дані недоступні"
              : critical
                ? "Термінова міська інформація"
                : citySeverity(c.city, c.announcements) === "warning"
                  ? "Є важливі міські повідомлення"
                  : c.checked.city
                    ? "Міські повідомлення перевірено"
                    : "Отримуємо дані"}
          </span>
        </div>
        <div className="display-clock">
          <time>
            {date.toLocaleTimeString("uk-UA", {
              timeZone: "Europe/Kyiv",
              hour: "2-digit",
              minute: "2-digit",
            })}
            <span>
              {date.toLocaleTimeString("uk-UA", {
                timeZone: "Europe/Kyiv",
                second: "2-digit",
              })}
            </span>
          </time>
          <div>
            {date.toLocaleDateString("uk-UA", {
              timeZone: "Europe/Kyiv",
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </header>
      <main className="display-stage">
        <div className="display-main-zone">
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={scene}
              initial={{ opacity: 0, y: reduced ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -8 }}
              transition={{
                duration: reduced ? 0 : motionTokens.slow,
                ease: motionTokens.ease,
              }}
              className={"display-scene " + (priority ? "priority" : "")}
            >
              <div className="display-scene-meta">
                <span>
                  {scene === "alert" ? (
                    <ShieldAlert />
                  ) : scene === "all-clear" ? (
                    <ShieldCheck />
                  ) : scene === "critical" ? (
                    <ShieldAlert />
                  ) : (
                    <Radio />
                  )}
                  {priority
                    ? "ОПЕРАТИВНА ІНФОРМАЦІЯ"
                    : `${String((index % order.length) + 1).padStart(2, "0")} / ${String(order.length).padStart(2, "0")}`}
                </span>
                <Freshness
                  at={priority ? c.cache?.refreshed_at : latestCity}
                  checked={c.checked.city}
                  error={priority ? !!c.errors.alerts : !!c.errors.city}
                />
              </div>
              <h1>{headline}</h1>
              {scene === "alert" ? (
                <div className="display-alert-detail">
                  <p>Черкаси · Черкаський район та Черкаська область</p>
                  <div>
                    <span>
                      ПОЧАТОК
                      <strong>{datetime(c.cache?.payload?.started_at)}</strong>
                    </span>
                    <span>
                      ОСТАННЄ ОНОВЛЕННЯ
                      <strong>{datetime(c.cache?.refreshed_at)}</strong>
                    </span>
                  </div>
                  <p className="display-guidance">
                    Слідкуйте за офіційними повідомленнями
                  </p>
                </div>
              ) : scene === "all-clear" ? (
                <div className="display-clear-detail">
                  <p>
                    Активну тривогу не зафіксовано за свіжими даними
                    alerts.in.ua.
                  </p>
                  <p>Повертаємося до міської інформації.</p>
                </div>
              ) : scene === "critical" ? (
                <div className="display-critical">
                  <p>
                    {criticalAnnouncement?.message || criticalCity?.description}
                  </p>
                  <small>
                    {datetime(critical?.updated_at || critical?.start_at)}
                  </small>
                </div>
              ) : scene === "city" ? (
                <div className="display-city-overview">
                  <p>
                    {mode === "unknown"
                      ? "Актуальний стан тривоги не підтверджено. Слідкуйте за офіційними повідомленнями."
                      : mode === "warning"
                        ? "Оперативні повідомлення міста — в нижній частині екрана."
                        : "Послуги, події та оперативна інформація в одному місці."}
                  </p>
                  <div className="display-city-line">
                    <MapPin size={20} />
                    <span>
                      {c.errors.city ? "Очікуємо зв’язок" : "Місто на зв’язку"}
                    </span>
                    <Freshness
                      at={latestCity}
                      checked={c.checked.city}
                      error={!!c.errors.city}
                    />
                  </div>
                </div>
              ) : (
                <div className="display-editorial-list">
                  {sceneRows.map((r, i) => (
                    <article key={r.id}>
                      <span className="display-row-index">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h2>{r.title}</h2>
                        <p>{r.message || r.summary}</p>
                        {scene === "events" && (
                          <small>
                            <Clock3 size={14} />
                            {datetime(r.starts_at)} · {r.location}
                          </small>
                        )}
                      </div>
                      <ArrowUpRight size={24} />
                    </article>
                  ))}
                  {scene === "announcements" && c.errors.announcements ? (
                    <p>Не вдалося оновити оголошення</p>
                  ) : q.error && scene !== "announcements" ? (
                    <p>Не вдалося оновити матеріали. Перевірте з’єднання.</p>
                  ) : (
                    !sceneRows.length && (
                      <p>
                        {q.loading && scene !== "announcements"
                          ? "Отримуємо матеріали…"
                          : scene === "events"
                            ? "На сьогодні немає опублікованих подій"
                            : scene === "announcements"
                              ? "Активних оголошень немає"
                              : "Наразі немає опублікованих матеріалів"}
                      </p>
                    )
                  )}
                </div>
              )}
            </motion.section>
          </AnimatePresence>
        </div>
        <aside className="display-side-zone">
          <div className="display-signal">
            <span className="display-signal-ring">
              <span />
            </span>
            <span>
              {c.air === "active"
                ? "РЕЖИМ ТРИВОГИ"
                : c.air === "inactive"
                  ? "МІСЬКИЙ МОНІТОРИНГ"
                  : "ОЧІКУЄМО ПІДТВЕРДЖЕННЯ"}
            </span>
            <small>
              {c.cache?.refreshed_at
                ? `Джерело оновлено ${ageLabel(c.cache.refreshed_at, c.now)}`
                : "Дані тривоги ще не отримано"}
            </small>
          </div>
          <div className="display-qr">
            <QR value={qr} label="Відкрити Черкаси Цифрові" />
            <span>
              {priority
                ? "Актуальна інформація про стан міста"
                : "Міський портал у вашому телефоні"}
            </span>
          </div>
        </aside>
      </main>
      <section className="display-live-modules" aria-label="Оперативні модулі">
        {[
          {
            label: "ТРАНСПОРТ",
            Icon: BusFront,
            value: transport.length,
            text: transport.length
              ? "активних повідомлень"
              : "повідомлень немає",
            error: !!c.errors.city,
          },
          {
            label: "КОМУНАЛЬНІ РОБОТИ",
            Icon: Construction,
            value: works.length,
            text: "активних повідомлень",
            error: !!c.errors.city,
          },
          {
            label: "ПЕРЕКРИТТЯ",
            Icon: MapPin,
            value: roads.length,
            text: "активних повідомлень",
            error: !!c.errors.city,
          },
          {
            label: "ПОДІЇ СЬОГОДНІ",
            Icon: CalendarDays,
            value: q.data?.eventsCount || 0,
            text: "опублікованих подій",
            error: !!q.error,
          },
        ].map((m) => (
          <article key={m.label}>
            <div>
              <m.Icon size={21} />
              <span>{m.label}</span>
            </div>
            <strong>
              {m.error ||
              (m.label === "ПОДІЇ СЬОГОДНІ"
                ? q.loading && !q.data
                : c.loading) ? (
                "—"
              ) : (
                <Count value={m.value} />
              )}
            </strong>
            <p>
              {m.error
                ? "Дані недоступні"
                : (
                      m.label === "ПОДІЇ СЬОГОДНІ"
                        ? q.loading && !q.data
                        : c.loading
                    )
                  ? "Отримуємо дані"
                  : m.text}
            </p>
            <small>
              {m.label === "ПОДІЇ СЬОГОДНІ"
                ? q.data
                  ? `Перевірено ${ageLabel(q.data.checkedAt, c.now)}`
                  : "Очікуємо дані"
                : latestCity
                  ? `Остання зміна ${ageLabel(latestCity, c.now)}`
                  : c.checked.city
                    ? `Перевірено ${ageLabel(c.checked.city, c.now)}`
                    : "Очікуємо дані"}
            </small>
          </article>
        ))}
      </section>
      <div className="display-ticker">
        <span className="ticker-label">
          <Radio size={15} />
          МІСЬКА СТРІЧКА
        </span>
        <div className="ticker-window">
          <div
            className={
              feedItems.length > 2 && !reduced
                ? "ticker-track moving"
                : "ticker-track"
            }
          >
            {(feedItems.length
              ? feedItems
              : [
                  {
                    id: "empty",
                    at: "",
                    text:
                      c.errors.city || c.errors.announcements
                        ? "Оновлення міських повідомлень недоступне"
                        : "Нових оперативних повідомлень немає",
                  },
                ]
            ).map((r) => (
              <span key={r.id}>
                {r.at && (
                  <time>
                    {new Date(r.at).toLocaleTimeString("uk-UA", {
                      timeZone: "Europe/Kyiv",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                )}
                <span>{r.text}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <footer className="display-controls">
        <nav aria-label="Сцени інформаційного екрана">
          {order.map((b, i) => (
            <button
              key={b}
              disabled={priority}
              aria-label={labels[b]}
              aria-pressed={!priority && index % order.length === i}
              className={
                !priority && index % order.length === i ? "active" : ""
              }
              onClick={() => setIndex(i)}
            >
              <span />
              {labels[b]}
            </button>
          ))}
        </nav>
        <div>
          <button
            aria-label={paused ? "Продовжити ротацію" : "Призупинити ротацію"}
            disabled={priority}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            aria-label="На весь екран"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
                setFullscreenError("");
              } catch {
                setFullscreenError("Скористайтеся F11 для повного екрана");
              }
            }}
          >
            <Maximize2 size={16} />
          </button>
          <small>v{APP_VERSION}</small>
        </div>
        {fullscreenError && <span role="status">{fullscreenError}</span>}
      </footer>
    </div>
  );
}
