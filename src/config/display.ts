export const displayScenes = [
  "news",
  "city",
  "announcements",
  "events",
  "services",
  "documents",
];
export const displayLabels: Record<string, string> = {
  news: "Новини",
  city: "Черкаси зараз",
  announcements: "Важлива інформація",
  events: "Події",
  services: "Послуги",
  documents: "Офіційні документи",
};
export const displayDefaults = {
  title: "Черкаси",
  blocks: displayScenes,
  interval: 15,
  durations: {
    news: 15,
    city: 12,
    announcements: 10,
    events: 12,
    services: 10,
    documents: 12,
  },
  news_count: 5,
  events_count: 3,
  ticker: true,
  show_clock: true,
  show_date: true,
  show_qr: true,
  background: "#0A0F0E",
  accent: "#44E0BC",
  fullscreen_default: false,
  news_image_mode: "cover",
  transition: "slide",
  qr_url: "",
};
export function displayConfig(value: Record<string, any> = {}) {
  const blocks = Array.isArray(value.blocks)
    ? [
        ...new Set(
          value.blocks.filter((v: string) => displayScenes.includes(v)),
        ),
      ]
    : displayScenes;
  const limit = (v: any, min: number, max: number, fallback: number) =>
    Math.max(min, Math.min(max, Number(v) || fallback));
  return {
    ...displayDefaults,
    ...value,
    blocks: blocks.length ? blocks : ["city"],
    interval: limit(value.interval, 5, 120, 15),
    news_count: limit(value.news_count, 3, 8, 5),
    events_count: limit(value.events_count, 2, 4, 3),
    durations:
      value.durations || (value.interval ? {} : displayDefaults.durations),
    background: /^#[0-9a-f]{6}$/i.test(value.background || "")
      ? value.background
      : displayDefaults.background,
    accent: /^#[0-9a-f]{6}$/i.test(value.accent || "")
      ? value.accent
      : displayDefaults.accent,
  };
}
export function sceneDuration(
  cfg: ReturnType<typeof displayConfig>,
  scene: string,
) {
  return (
    Math.max(5, Math.min(120, Number(cfg.durations[scene]) || cfg.interval)) *
    1000
  );
}
