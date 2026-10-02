import { useCity } from "../hooks/City";
import { useEffect, useRef, useState, useMemo } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  Info,
  Wrench,
  Megaphone,
  ShieldAlert,
  X,
  Download,
  Activity,
  Bell,
  FileText,
  User,
  CheckCircle2,
} from "lucide-react";
import QRCode from "qrcode";
import { useAuth } from "../hooks/Auth";
import { useData } from "../hooks/useData";
import { list, rpc, errorText } from "../services/data";
import { configured, siteUrl } from "../services/client";
import { datetime, statuses, type Row } from "../config/types";
import { Button, Empty, Modal, Pagination, State, useToast } from "./UI";
import { motionTokens, reveal } from "../config/motion";
export const APP_VERSION = "3.0.1";
export function activeAnnouncements(rows: Row[]) {
  const now = Date.now();
  return rows
    .filter(
      (r) =>
        r.active &&
        (!r.start_at || Date.parse(r.start_at) <= now) &&
        (!r.end_at || Date.parse(r.end_at) > now),
    )
    .sort(
      (a, b) =>
        (b.priority || 0) - (a.priority || 0) ||
        String(b.updated_at).localeCompare(String(a.updated_at)),
    );
}
export function useCityFeed() {
  const c = useCity();
  const data = useMemo(
    () => ({ announcements: c.announcements, city: c.city }),
    [c.announcements, c.city],
  );
  return {
    data,
    loading: c.loading,
    error: c.errors.city || c.errors.announcements,
    reload: c.reload,
  };
}
const icons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  danger: ShieldAlert,
  critical: ShieldAlert,
  maintenance: Wrench,
  service: Megaphone,
};
export function AnnouncementContent({ row }: { row: Row }) {
  const Icon = icons[row.type] || Info;
  const valid =
    row.button_url &&
    (/^https?:\/\//.test(row.button_url) || /^\/(?!\/)/.test(row.button_url));
  return (
    <>
      <Icon size={24} />
      <div className="announcement-copy">
        <strong>{row.title}</strong>
        <p>{row.message}</p>
        {valid &&
          (row.button_url.startsWith("/") ? (
            <Link className="button secondary small" to={row.button_url}>
              {row.button_text || "Детальніше"}
            </Link>
          ) : (
            <a
              className="button secondary small"
              href={row.button_url}
              rel="noopener noreferrer"
            >
              {row.button_text || "Детальніше"}
            </a>
          ))}
      </div>
    </>
  );
}
export function GlobalAnnouncement() {
  const q = useCityFeed(),
    auth = useAuth(),
    reduced = useReducedMotion(),
    [hidden, setHidden] = useState<string[]>([]),
    [all, setAll] = useState(false);
  const owner = auth.session?.user.id || "browser";
  const key = (r: Row) =>
    `announcement:${owner}:${r.id}:${r.version || 1}:${r.type}:${r.priority || 0}`;
  useEffect(() => {
    setHidden(
      q.data?.announcements
        .filter((r) => localStorage.getItem(key(r)) === "dismissed")
        .map(key) || [],
    );
  }, [q.data, owner]);
  const rows = (q.data?.announcements || []).filter(
    (r) =>
      r.placement === "global" &&
      !(r.dismissible && r.type !== "critical" && hidden.includes(key(r))),
  );
  const row = rows[0];
  return (
    <>
      <AnimatePresence initial={false}>
        {row && (
          <motion.div
            key={key(row)}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: reduced ? 0 : motionTokens.slow,
              ease: motionTokens.ease,
            }}
            className={"global-announcement " + row.type}
          >
            <div
              className="global-announcement-inner"
              role={
                ["danger", "critical"].includes(row.type) ? "alert" : "status"
              }
            >
              <AnnouncementContent row={row} />
              <div className="announcement-actions">
                {rows.length > 1 && (
                  <button onClick={() => setAll(true)}>
                    Ще {rows.length - 1} важливих повідомлень
                  </button>
                )}
                {row.dismissible && row.type !== "critical" && (
                  <button
                    aria-label="Закрити важливе оголошення"
                    onClick={() => {
                      localStorage.setItem(key(row), "dismissed");
                      setHidden((v) => [...v, key(row)]);
                    }}
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {all && (
        <Modal title="Важливі повідомлення" onClose={() => setAll(false)}>
          {rows.map((r) => (
            <div className={"announcement " + r.type} key={r.id}>
              <AnnouncementContent row={r} />
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
export { CityStatus } from "./CityLive";
export function PageOutlet() {
  const l = useLocation();
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={l.pathname}
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : motionTokens.normal,
        ease: motionTokens.ease,
      }}
    >
      <Outlet />
    </motion.div>
  );
}
export function QR({
  value,
  label = "QR-код",
}: {
  value: string;
  label?: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    setUrl("");
    QRCode.toDataURL(value, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((v) => {
        if (alive) setUrl(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [value]);
  return url ? (
    <figure className="qr">
      <img src={url} alt={label} />
      <figcaption>{label}</figcaption>
      <a download="cherkasy-qr.png" href={url}>
        Зберегти QR
      </a>
    </figure>
  ) : (
    <p role="status">Готуємо QR…</p>
  );
}
export function ApplicationQR({ id,kind="application" }: { id: string;kind?:"application"|"appeal" }) {
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="panel">
      <h3>QR статусу заяви</h3>
      <p>
        Посилання показує лише номер, послугу, статус і дати. Кожен, хто має QR,
        зможе переглянути ці дані.
      </p>
      {token ? (
        <>
          <QR
            value={siteUrl() + (kind==="appeal"?"appeal-status/":"status/") + token}
            label="Перевірити статус заяви"
          />
          <Button
            className="secondary small"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await rpc("revoke_"+kind+"_public_token", { p_id: id });
                setToken("");
                toast("Посилання відкликано");
              } catch (e) {
                toast(errorText(e), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Відкликати посилання
          </Button>
        </>
      ) : (
        <Button
          className="secondary"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setToken(await rpc("get_"+kind+"_public_token", { p_id: id }));
            } catch (e) {
              toast(errorText(e), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Створити QR
        </Button>
      )}
    </div>
  );
}
export function PublicStatus({ token,kind="application" }: { token: string;kind?:"application"|"appeal" }) {
  const q = useData(
    () =>
      configured
        ? rpc("public_"+kind+"_status", { p_token: token })
        : Promise.resolve([]),
    [token,kind],
  );
  const r = q.data?.[0];
  return (
    <div className="container narrow">
      <h1>{kind==="appeal"?"Статус звернення":"Статус заяви"}</h1>
      <State loading={q.loading} error={q.error}>
        {r ? (
          <div className="panel">
            <h2>{r.number}</h2>
            <p>{r.type}</p>
            <strong>{statuses[r.status] || r.status}</strong>
            <p>Створено: {datetime(r.created_at)}</p>
            <p>Оновлено: {datetime(r.updated_at)}</p>
          </div>
        ) : (
          <Empty text="Посилання недійсне або відкликане" />
        )}
      </State>
    </div>
  );
}
export function ActivityTimeline() {
  const a = useAuth(),
    [page, setPage] = useState(1);
  const q = useData(
    () => list("user_activity", { page, eq: { user_id: a.session!.user.id } }),
    [page],
  );
  return (
    <>
      <h1>Центр активності</h1>
      <State loading={q.loading} error={q.error}>
        <div className="activity-timeline">
          {q.data?.rows.map((r, i) => {
            const Icon =
              r.kind === "profiles"
                ? User
                : r.kind === "user_documents"
                  ? FileText
                  : r.kind === "notifications"
                    ? Bell
                    : CheckCircle2;
            return (
              <motion.article
                key={r.id}
                {...reveal}
                transition={{
                  ...reveal.transition,
                  delay: Math.min(i * 0.035, 0.2),
                }}
              >
                <span className="timeline-icon">
                  <Icon size={18} />
                </span>
                <div>
                  <small>{datetime(r.created_at)}</small>
                  <h3>{r.title}</h3>
                  <p>{r.description}</p>
                  {r.link?.startsWith("/") && !r.link.startsWith("//") && (
                    <Link to={r.link}>Переглянути</Link>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
        {!q.data?.count && <Empty text="Тут з’явиться історія ваших дій" />}
        <Pagination page={page} count={q.data?.count || 0} onChange={setPage} />
      </State>
    </>
  );
}
export function VerificationStatus() {
  const a = useAuth();
  const q = useData(
    () =>
      list("account_verifications", {
        eq: { user_id: a.session!.user.id },
        size: 3,
      }),
    [a.session?.user.id],
  );
  return (
    <section className="panel">
      <h2>Статус акаунта</h2>
      <div className="verification-grid">
        {[
          ["email", "Email"],
          ["phone", "Телефон"],
          ["identity", "Особа"],
          ["address", "Адреса"],
        ].map(([kind, label]) => {
          const verified =
            kind === "email"
              ? !!a.session?.user.email_confirmed_at
              : q.data?.rows.some((r) => r.kind === kind && r.verified);
          return (
            <div key={kind}>
              <strong>{label}</strong>
              <span className={"badge " + (verified ? "completed" : "draft")}>
                {verified ? "Підтверджено" : "Не підтверджено"}
              </span>
            </div>
          );
        })}
      </div>
      <small>
        Телефон, особу й адресу може підтвердити адміністратор після ручної
        перевірки. Державні інтеграції поки не підключені.
      </small>
      {q.error && <p className="field-error">{q.error}</p>}
    </section>
  );
}
export function InstallPrompt() {
  const [event, setEvent] = useState<any>(null),
    [dismissed, setDismissed] = useState(
      () => Number(localStorage.getItem("pwa-prompt-after") || 0) > Date.now(),
    );
  useEffect(() => {
    const fn = (e: Event) => {
      e.preventDefault();
      setEvent(e);
    };
    window.addEventListener("beforeinstallprompt", fn);
    const done = () => setEvent(null);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", fn);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (!event || dismissed || matchMedia("(display-mode: standalone)").matches)
    return null;
  return (
    <div className="install-prompt">
      <Download size={18} />
      <span>Додати Черкаси Цифрові на головний екран</span>
      <Button
        className="secondary small"
        onClick={async () => {
          await event.prompt();
          setEvent(null);
        }}
      >
        Додати
      </Button>
      <button
        aria-label="Нагадати пізніше"
        onClick={() => {
          localStorage.setItem(
            "pwa-prompt-after",
            String(Date.now() + 30 * 86400000),
          );
          setDismissed(true);
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
export function NotificationBell({ count }: { count: number }) {
  const previous = useRef(count),
    [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (count > previous.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      previous.current = count;
      return () => clearTimeout(t);
    }
    previous.current = count;
  }, [count]);
  return (
    <>
      <Bell className={pulse ? "bell-pulse" : ""} size={20} />
      {count > 0 && (
        <span key={count} className="notification-dot">
          {count}
        </span>
      )}
    </>
  );
}
