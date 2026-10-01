export interface AlertRecord {
  location_uid?: string | number;
  location_title?: string;
  location_type?: string;
  location_oblast?: string;
  alert_type?: string;
  started_at?: string;
  finished_at?: string | null;
}
export function normalizeAlerts(
  body: any,
  locationUids: string[],
  oblastTitle: string,
) {
  if (!body || !Array.isArray(body.alerts))
    throw new Error("Invalid alerts payload");
  if (
    body.alerts.some(
      (a: any) =>
        !a ||
        typeof a !== "object" ||
        typeof a.alert_type !== "string" ||
        a.location_uid === undefined,
    )
  )
    throw new Error("Invalid alert record");
  const alerts = (body.alerts as AlertRecord[]).filter(
    (a) =>
      a.alert_type === "air_raid" &&
      !a.finished_at &&
      (locationUids.includes(String(a.location_uid)) ||
        (a.location_type === "oblast" && a.location_title === oblastTitle)),
  );
  return {
    state: alerts.length ? "active" : "inactive",
    scope: "Черкаський район та " + oblastTitle,
    started_at:
      alerts
        .map((a) => a.started_at)
        .filter(Boolean)
        .sort()[0] || null,
    source: "alerts.in.ua",
    regions: alerts.map((a) => a.location_title),
  };
}
