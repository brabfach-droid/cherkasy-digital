import type { Row } from "../config/types";
export type AirState = "active" | "inactive" | "unknown";
export const ALERT_MAX_AGE_MS = 120000;
export function alertState(
  cache: Row | undefined,
  now = Date.now(),
  failed = false,
): AirState {
  const at = Date.parse(cache?.refreshed_at || "");
  if (
    failed ||
    !Number.isFinite(at) ||
    at > now + 60000 ||
    now - at > ALERT_MAX_AGE_MS
  )
    return "unknown";
  return cache?.payload?.state === "active"
    ? "active"
    : cache?.payload?.state === "inactive"
      ? "inactive"
      : "unknown";
}
export function ageLabel(value: string | number | undefined, now = Date.now()) {
  const at = typeof value === "number" ? value : Date.parse(value || "");
  if (!Number.isFinite(at)) return "ще не оновлено";
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  return seconds < 10
    ? "щойно"
    : seconds < 60
      ? `${seconds} сек тому`
      : seconds < 3600
        ? `${Math.floor(seconds / 60)} хв тому`
        : `${Math.floor(seconds / 3600)} год тому`;
}
export function citySeverity(city: Row[], announcements: Row[]) {
  if (
    city.some((r) => r.severity === "critical") ||
    announcements.some((r) => r.type === "critical")
  )
    return "critical";
  if (
    city.some((r) => ["warning", "danger"].includes(r.severity)) ||
    announcements.some((r) =>
      ["warning", "danger", "maintenance"].includes(r.type),
    )
  )
    return "warning";
  return "normal";
}
export function activeCity(rows: Row[], now = Date.now()) {
  return rows.filter(
    (r) =>
      r.is_active &&
      (!r.started_at || Date.parse(r.started_at) <= now) &&
      (!r.ended_at || Date.parse(r.ended_at) > now),
  );
}
export function todayEvents(rows: Row[], now = Date.now()) {
  const day = (at: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(at);
  return rows.filter(
    (r) => r.starts_at && day(Date.parse(r.starts_at)) === day(now),
  );
}
export function kyivDayBounds(now = Date.now()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = (at: number) =>
    Object.fromEntries(
      formatter
        .formatToParts(at)
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, Number(p.value)]),
    );
  const local = parts(now),
    wall = Date.UTC(local.year, local.month - 1, local.day);
  const midnight = (target: number) => {
    let at = target;
    for (let i = 0; i < 3; i++) {
      const p = parts(at);
      const offset =
        Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
        Math.floor(at / 1000) * 1000;
      at = target - offset;
    }
    return at;
  };
  return {
    start: new Date(midnight(wall)).toISOString(),
    end: new Date(midnight(wall + 86400000) - 1).toISOString(),
  };
}
