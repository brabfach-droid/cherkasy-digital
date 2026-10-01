import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAlerts } from "../supabase/functions/alerts/provider.ts";
import { validateAnswers } from "../src/utils/validation.ts";
test("An oblast-wide alert applies to the district; unrelated districts do not", () => {
  const base = {
    alert_type: "air_raid",
    location_uid: "999",
    location_type: "raion",
    location_title: "Інший район",
  };
  assert.equal(
    normalizeAlerts({ alerts: [base] }, ["152"], "Черкаська область").state,
    "inactive",
  );
  assert.equal(
    normalizeAlerts(
      { alerts: [{ ...base, location_uid: "152" }] },
      ["152"],
      "Черкаська область",
    ).state,
    "active",
  );
  assert.equal(
    normalizeAlerts(
      {
        alerts: [
          {
            ...base,
            location_type: "oblast",
            location_title: "Черкаська область",
          },
        ],
      },
      ["152"],
      "Черкаська область",
    ).state,
    "active",
  );
  assert.equal(
    normalizeAlerts(
      {
        alerts: [
          { ...base, location_uid: "152", alert_type: "artillery_shelling" },
        ],
      },
      ["152"],
      "Черкаська область",
    ).state,
    "inactive",
  );
});
test("Malformed API data cannot become an all-clear", () => {
  assert.throws(() => normalizeAlerts({}, ["152"], "Черкаська область"));
  assert.throws(() =>
    normalizeAlerts({ alerts: [{}] }, ["152"], "Черкаська область"),
  );
});
test("Finished alerts are not active", () => {
  assert.equal(
    normalizeAlerts(
      {
        alerts: [
          {
            alert_type: "air_raid",
            location_uid: "152",
            finished_at: "2026-09-01",
          },
        ],
      },
      ["152"],
      "Черкаська область",
    ).state,
    "inactive",
  );
});
test("Required fields, consent, bounds and attachments are validated", () => {
  const f = (key, type, validation = {}) => ({
    key,
    type,
    label: key,
    required: true,
    validation,
    options: [],
    sort_order: 0,
  });
  const fs = [
    f("email", "email"),
    f("consent", "confirmation"),
    f("age", "number", { min: 18, max: 90 }),
    f("pdf", "pdf"),
  ];
  assert.equal(
    Object.keys(validateAnswers(fs, { email: "bad", consent: false, age: 12 }))
      .length,
    4,
  );
  assert.deepEqual(
    validateAnswers(fs, { email: "x@y.ua", consent: true, age: 25 }, [
      { field_key: "pdf" },
    ]),
    {},
  );
});
