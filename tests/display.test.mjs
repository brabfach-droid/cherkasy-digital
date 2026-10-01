import test from "node:test";
import assert from "node:assert/strict";
import { displayConfig, sceneDuration } from "../src/config/display.ts";
test("Display settings preserve scene order, reject invalid scenes and bound rotation", () => {
  const cfg = displayConfig({
    blocks: ["documents", "news", "invalid", "news"],
    interval: 999,
    news_count: 20,
    events_count: 1,
    background: "broken",
  });
  assert.deepEqual(cfg.blocks, ["documents", "news"]);
  assert.equal(cfg.interval, 120);
  assert.equal(cfg.news_count, 8);
  assert.equal(cfg.events_count, 2);
  assert.equal(cfg.background, "#0A0F0E");
  assert.equal(sceneDuration(displayConfig({ interval: 5 }), "news"), 5000);
  assert.equal(
    sceneDuration(displayConfig({ durations: { news: 12 } }), "news"),
    12000,
  );
  assert.equal(
    sceneDuration(displayConfig({ durations: { news: -1 } }), "news"),
    5000,
  );
  assert.deepEqual(displayConfig({ blocks: [] }).blocks, ["city"]);
});
