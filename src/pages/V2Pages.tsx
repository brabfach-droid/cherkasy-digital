import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSettings } from "../hooks/Settings";
import { useData } from "../hooks/useData";
import { list, rpc, errorText } from "../services/data";
import { siteUrl } from "../services/client";
import { datetime, type Row } from "../config/types";
import {
  Button,
  Empty,
  Modal,
  Pagination,
  State,
  useToast,
} from "../components/UI";
import {
  AnnouncementContent,
  APP_VERSION,
  PublicStatus,
  QR,
  useCityFeed,
} from "../components/V2";
import { CityNow } from "./PublicPages";
import { reveal } from "../config/motion";
export function StatusPage() {
  const { token } = useParams();
  return <PublicStatus token={token || ""} />;
}
export function RevisionHistory({
  table,
  id,
  onRestored,
}: {
  table: string;
  id: string;
  onRestored: () => void;
}) {
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false);
  const toast = useToast();
  const q = useData(
    () =>
      list("content_revisions", {
        eq: { entity_type: table, entity_id: id },
        order: "version",
        page,
      }),
    [table, id, page],
  );
  return (
    <>
      <State loading={q.loading} error={q.error}>
        {q.data?.rows.map((r, i) => {
          const previous = q.data?.rows[i + 1];
          return (
            <div className="panel" key={r.id}>
              <h3>Версія {r.version}</h3>
              <small>
                {datetime(r.created_at)} · {r.changed_by || "Початкова версія"}
              </small>
              <p>Змінено: {r.changed_fields.join(", ") || "Без зміни полів"}</p>
              <details>
                <summary>Порівняти зміни</summary>
                {r.changed_fields.map((field: string) => (
                  <div className="revision-diff" key={field}>
                    <strong>{field}</strong>
                    <div>
                      <small>Було</small>
                      <pre>
                        {previous
                          ? JSON.stringify(previous.snapshot[field], null, 2)
                          : "Попередня версія на іншій сторінці або відсутня"}
                      </pre>
                    </div>
                    <div>
                      <small>Стало</small>
                      <pre>{JSON.stringify(r.snapshot[field], null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </details>
              <Button
                className="secondary small"
                busy={busy}
                onClick={async () => {
                  if (
                    !confirm(
                      "Відновити цю версію? Поточний стан залишиться в історії.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await rpc("restore_content_revision", { p_revision: r.id });
                    q.reload();
                    onRestored();
                    toast("Версію відновлено");
                  } catch (e) {
                    toast(errorText(e), "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Відновити версію
              </Button>
            </div>
          );
        })}
        {!q.data?.count && <Empty text="Історія змін порожня" />}
        <Pagination page={page} count={q.data?.count || 0} onChange={setPage} />
      </State>
    </>
  );
}
export function Display() {
  const { settings } = useSettings(),
    feed = useCityFeed(),
    [now, setNow] = useState(new Date()),
    [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false),
    [fullError, setFullError] = useState("");
  const reduced = useReducedMotion();
  const cfg = settings.display || {};
  const available = ["city", "announcements", "events", "news", "services"];
  const blocks = (Array.isArray(cfg.blocks) ? cfg.blocks : available).filter(
    (x: string) => available.includes(x),
  );
  const safeBlocks = blocks.length ? blocks : ["city"];
  const critical = feed.data?.announcements.find(
    (r) => r.placement === "global" && r.type === "critical",
  );
  const q = useData(async () => {
    const [events, news, services] = await Promise.all([
      list("events", {
        visible: true,
        size: 30,
        order: "starts_at",
        ascending: true,
      }),
      list("news", { visible: true, size: 4 }),
      list("services", { visible: true, size: 4 }),
    ]);
    return {
      events: events.rows
        .filter((r) => r.starts_at && Date.parse(r.starts_at) >= Date.now())
        .slice(0, 4),
      news: news.rows,
      services: services.rows,
    };
  });
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (paused || critical) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % safeBlocks.length),
      Math.max(5, Math.min(120, Number(cfg.interval) || 15)) * 1000,
    );
    return () => clearInterval(t);
  }, [paused, critical?.id, cfg.interval, JSON.stringify(safeBlocks)]);
  useEffect(() => {
    const t = setInterval(q.reload, 60000);
    return () => clearInterval(t);
  }, []);
  const block = critical ? "critical" : safeBlocks[index % safeBlocks.length],
    titles: Record<string, string> = {
      city: "Черкаси зараз",
      announcements: "Важливі повідомлення",
      events: "Найближчі події",
      news: "Новини міста",
      services: "Міські послуги",
      critical: "Термінова інформація",
    };
  const qr = /^https?:\/\//.test(cfg.qr_url || "") ? cfg.qr_url : siteUrl();
  return (
    <div
      className={
        "display-mode " +
        (cfg.theme === "light" ? "light" : "dark") +
        (cfg.fullscreen_friendly === false ? " compact" : "")
      }
    >
      <header>
        <Link to="/">{cfg.title || settings.name}</Link>
        <div>
          <time>
            {now.toLocaleTimeString("uk-UA", {
              timeZone: "Europe/Kyiv",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
          <p>
            {now.toLocaleDateString("uk-UA", {
              timeZone: "Europe/Kyiv",
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
      </header>
      <main>
        <section>
          <AnimatePresence mode="wait">
            <motion.div
              key={block}
              {...reveal}
              transition={{ ...reveal.transition, duration: reduced ? 0 : 0.3 }}
            >
              <h1>{titles[block]}</h1>
              {block === "city" ? (
                <CityNow compact />
              ) : block === "critical" ? (
                <div className="display-critical">
                  <AnnouncementContent row={critical!} />
                </div>
              ) : block === "announcements" ? (
                <>
                  {feed.data?.announcements.slice(0, 3).map((r) => (
                    <article key={r.id} className={"announcement " + r.type}>
                      <AnnouncementContent row={r} />
                    </article>
                  ))}
                  {!feed.data?.announcements.length && (
                    <p>Активних оголошень немає</p>
                  )}
                </>
              ) : (
                <>
                  {(
                    q.data?.[block as "events" | "news" | "services"] || []
                  ).map((r: Row) => (
                    <article className="display-card" key={r.id}>
                      <h2>{r.title}</h2>
                      <p>{r.summary}</p>
                      {r.starts_at && (
                        <p>
                          {datetime(r.starts_at)} · {r.location}
                        </p>
                      )}
                    </article>
                  ))}
                  {!q.data?.[block as "events" | "news" | "services"]
                    ?.length && <p>Наразі немає опублікованих матеріалів</p>}
                </>
              )}
              {(q.error || feed.error) && (
                <p role="alert">
                  Не вдалося оновити інформацію. Перевірте з’єднання.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
        <aside>
          <QR value={qr} label="Відкрити портал" />
          <p>Послуги й інформація міста у вашому телефоні</p>
        </aside>
      </main>
      <footer>
        <span>
          {safeBlocks.map((b: string, i: number) => (
            <button
              key={b}
              className={i === index % safeBlocks.length ? "active" : ""}
              aria-label={titles[b]}
              onClick={() => setIndex(i)}
            >
              ●
            </button>
          ))}
        </span>
        <div>
          <Button
            className="secondary small"
            onClick={() => setPaused(!paused)}
          >
            {paused ? "Продовжити" : "Пауза"}
          </Button>
          <Button
            className="secondary small"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
                setFullError("");
              } catch {
                setFullError(
                  "Браузер не дозволив повний екран. Скористайтеся F11.",
                );
              }
            }}
          >
            На весь екран
          </Button>
          <small>{fullError}</small>
        </div>
        <small>v{APP_VERSION}</small>
      </footer>
    </div>
  );
}
