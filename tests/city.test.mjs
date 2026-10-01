import test from "node:test";
import assert from "node:assert/strict";
import {
  alertState,
  ageLabel,
  activeCity,
  citySeverity,
  todayEvents,
  kyivDayBounds,
} from "../src/utils/city.ts";
const now = Date.parse("2026-10-01T08:00:00Z"),
  cache = (state, at = now) => ({
    id: "cache",
    payload: { state },
    refreshed_at: new Date(at).toISOString(),
  });
test("Alert freshness never converts missing, failed, stale, future or malformed data to all-clear", () => {
  assert.equal(alertState(cache("active"), now), "active");
  assert.equal(alertState(cache("inactive"), now), "inactive");
  assert.equal(alertState(cache("inactive", now - 120001), now), "unknown");
  assert.equal(alertState(undefined, now), "unknown");
  assert.equal(alertState(cache("active"), now, true), "unknown");
  assert.equal(alertState(cache("inactive", now + 120000), now), "unknown");
  assert.equal(alertState(cache("garbage"), now), "unknown");
});
test("Freshness text uses source timestamp and active city windows", () => {
  assert.equal(ageLabel(now - 480000, now), "8 хв тому");
  assert.equal(ageLabel(undefined, now), "ще не оновлено");
  assert.equal(
    activeCity(
      [
        {
          id: "expired",
          is_active: true,
          ended_at: new Date(now - 1000).toISOString(),
        },
        {
          id: "future",
          is_active: true,
          started_at: new Date(now + 1000).toISOString(),
        },
        { id: "open", is_active: true },
      ],
      now,
    ).length,
    1,
  );
  assert.equal(
    citySeverity([{ id: "critical", severity: "critical" }], []),
    "critical",
  );
});
test("Today events follows Kyiv day boundaries", () => {
  const rows = [
    { id: "today", starts_at: "2026-09-30T22:00:00Z" },
    { id: "yesterday", starts_at: "2026-09-30T20:00:00Z" },
    { id: "tomorrow", starts_at: "2026-10-01T22:00:00Z" },
  ];
  assert.deepEqual(
    todayEvents(rows, now).map((r) => r.id),
    ["today"],
  );
});

test("Kyiv query bounds cover exact local day including DST", () => {
  assert.deepEqual(kyivDayBounds(now), {
    start: "2026-09-30T21:00:00.000Z",
    end: "2026-10-01T20:59:59.999Z",
  });
  for (const [date, hours] of [
    ["2026-03-29T12:00:00Z", 23],
    ["2026-10-25T12:00:00Z", 25],
  ]) {
    const b = kyivDayBounds(Date.parse(date));
    assert.equal(Date.parse(b.end) + 1 - Date.parse(b.start), hours * 3600000);
  }
});
