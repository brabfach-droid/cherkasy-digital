import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Radio,
  Clock3,
  CloudOff,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCity } from "../hooks/City";
import { configured } from "../services/client";
import { ageLabel, citySeverity } from "../utils/city";
import { datetime } from "../config/types";
import { motionTokens } from "../config/motion";
import { Modal } from "./UI";
import { useState } from "react";
export function AirAlertStatus() {
  const c = useCity(),
    [panel, setPanel] = useState(false),
    reduced = useReducedMotion();
  const state = c.air,
    Icon =
      state === "active"
        ? ShieldAlert
        : state === "inactive"
          ? ShieldCheck
          : CloudOff;
  const title =
    state === "active"
      ? "ПОВІТРЯНА ТРИВОГА · ЧЕРКАСИ"
      : state === "inactive"
        ? "Черкаси · тривоги немає"
        : "Статус тривоги недоступний";
  return (
    <>
      <button
        className={"air-alert-status " + state}
        onClick={() => setPanel(true)}
        aria-label={title}
        title={title}
      >
        <Icon size={17} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state}
            initial={{ opacity: 0, y: reduced ? 0 : 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -3 }}
            transition={{ duration: reduced ? 0 : motionTokens.fast }}
          >
            <span className="air-label-full">{title}</span>
            <span className="air-label-short">
              {state === "active"
                ? "Тривога"
                : state === "inactive"
                  ? "Без тривоги"
                  : "Невідомо"}
            </span>
          </motion.span>
        </AnimatePresence>
        <span className="air-dot" />
      </button>
      {panel && (
        <Modal title="Повітряна тривога" onClose={() => setPanel(false)}>
          <div className={"air-detail " + state}>
            <Icon size={36} />
            <h2>
              {state === "active"
                ? "Активна"
                : state === "inactive"
                  ? "Активну тривогу не зафіксовано"
                  : "Поточний стан невідомий"}
            </h2>
            <dl>
              <dt>Регіон</dt>
              <dd>
                {c.cache?.payload?.scope ||
                  "Черкаський район та Черкаська область"}
              </dd>
              {state === "active" && (
                <>
                  <dt>Початок</dt>
                  <dd>{datetime(c.cache?.payload?.started_at)}</dd>
                </>
              )}
              <dt>Останнє оновлення джерела</dt>
              <dd>
                {datetime(c.cache?.refreshed_at)} ·{" "}
                {ageLabel(c.cache?.refreshed_at, c.now)}
              </dd>
            </dl>
            <p>
              Джерело: alerts.in.ua. Статус враховує тривоги району та області,
              до яких належать Черкаси.
            </p>
            {state === "unknown" && (
              <p>
                Не вдалося підтвердити актуальний стан. Слідкуйте за офіційними
                повідомленнями.
              </p>
            )}
            <Link className="button" to="/now" onClick={() => setPanel(false)}>
              Детальніше <ArrowUpRight size={16} />
            </Link>
          </div>
        </Modal>
      )}
    </>
  );
}
export function CityStatus() {
  const c = useCity(),
    severity = citySeverity(c.city, c.announcements),
    label = c.errors.city
      ? "Міські дані недоступні"
      : !c.checked.city
        ? "Перевіряємо місто"
        : severity === "critical"
          ? "Термінова міська інформація"
          : c.city.length || c.announcements.length
            ? "Є міські повідомлення"
            : configured
              ? "Черкаси · штатний режим"
              : "Черкаси · демоперегляд";
  return (
    <Link to="/now" className={"city-indicator " + severity}>
      <Activity size={13} />
      <span key={label}>{label}</span>
    </Link>
  );
}
export function Freshness({
  at,
  checked,
  error = false,
  label = "Оновлено",
}: {
  at?: string;
  checked?: number;
  error?: boolean;
  label?: string;
}) {
  const c = useCity();
  return (
    <span className={"freshness " + (error ? "offline" : "")}>
      <Signal size={12} />
      {error
        ? "Оновлення недоступне"
        : at
          ? `${label} ${ageLabel(at, c.now)}`
          : checked
            ? `Перевірено ${ageLabel(checked, c.now)}`
            : "Очікуємо дані"}
    </span>
  );
}
export function CityStrip() {
  const c = useCity();
  const works = c.city.filter((r) => /робот|відключ/i.test(r.type)).length,
    roads = c.city.filter((r) => /перекрит/i.test(r.type)).length,
    transport = c.city.filter((r) => /транспорт/i.test(r.type));
  return (
    <section className="city-live-strip" aria-label="Міський статус">
      <Link to="/now" className="strip-heading">
        <Radio size={16} />
        Черкаси зараз
      </Link>
      <Link to="/now" className={"strip-air " + c.air}>
        <span className="status-dot" />
        {c.air === "active"
          ? "Повітряна тривога"
          : c.air === "inactive"
            ? "Тривоги немає"
            : "Тривога: стан невідомий"}
      </Link>
      <Link to="/now">
        {c.errors.city
          ? "Міські дані недоступні"
          : `${works} комунальних робіт`}
      </Link>
      <Link to="/now">{roads} перекриттів</Link>
      <Link to="/now">
        Транспорт:{" "}
        {c.errors.city
          ? "невідомо"
          : transport.length
            ? `${transport.length} повідомлень`
            : "повідомлень немає"}
      </Link>
      <Freshness at={c.cache?.refreshed_at} error={!!c.errors.alerts} />
    </section>
  );
}
export function HeroLive() {
  const c = useCity(),
    now = new Date(c.now);
  return (
    <div className={"hero-live " + c.air}>
      <div>
        <Clock3 size={15} />
        <time>
          {now.toLocaleTimeString("uk-UA", {
            timeZone: "Europe/Kyiv",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
        <span>Черкаси сьогодні</span>
      </div>
      <Link to="/now">
        <span className="status-dot" />
        {c.air === "active"
          ? "У Черкасах повітряна тривога"
          : c.air === "inactive"
            ? "Активну тривогу не зафіксовано"
            : "Перевірте офіційні повідомлення"}
        <ArrowUpRight size={16} />
      </Link>
    </div>
  );
}
