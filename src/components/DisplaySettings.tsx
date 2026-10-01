import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  displayConfig,
  displayDefaults,
  displayLabels,
  displayScenes,
} from "../config/display";
export function DisplaySettings({
  value,
  onChange,
}: {
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}) {
  const cfg = displayConfig(value),
    [preview, setPreview] = useState(false),
    [revision, setRevision] = useState(0),
    [scale, setScale] = useState(0.5),
    frame = useRef<HTMLDivElement>(null);
  const patch = (key: string, v: any) => onChange({ ...cfg, [key]: v });
  const order = [
    ...cfg.blocks,
    ...displayScenes.filter((s) => !cfg.blocks.includes(s)),
  ];
  useEffect(() => {
    if (!preview || !frame.current) return;
    const ro = new ResizeObserver(([e]) =>
      setScale(e.contentRect.width / 1920),
    );
    ro.observe(frame.current);
    return () => ro.disconnect();
  }, [preview]);
  const show = () => {
    sessionStorage.setItem("display-preview", JSON.stringify(cfg));
    setPreview(true);
    setRevision((r) => r + 1);
  };
  return (
    <section className="display-settings">
      <p>
        Увімкніть сцени, змініть їхній порядок і тривалість. Тривога показується
        постійно у верхній смузі та не зупиняє ротацію.
      </p>
      <div className="display-options">
        <label>
          Назва екрана
          <input
            value={cfg.title}
            maxLength={40}
            onChange={(e) => patch("title", e.target.value)}
          />
        </label>
        <label>
          Загальний інтервал, секунд
          <input
            type="number"
            min={5}
            max={120}
            value={cfg.interval}
            onChange={(e) => patch("interval", Number(e.target.value))}
          />
        </label>
        <label>
          Кількість новин
          <input
            type="number"
            min={3}
            max={8}
            value={cfg.news_count}
            onChange={(e) => patch("news_count", Number(e.target.value))}
          />
        </label>
        <label>
          Кількість подій
          <input
            type="number"
            min={2}
            max={4}
            value={cfg.events_count}
            onChange={(e) => patch("events_count", Number(e.target.value))}
          />
        </label>
        <label>
          Фон
          <input
            type="color"
            value={cfg.background}
            onChange={(e) => patch("background", e.target.value)}
          />
        </label>
        <label>
          Акцент
          <input
            type="color"
            value={cfg.accent}
            onChange={(e) => patch("accent", e.target.value)}
          />
        </label>
        <label>
          Зображення новин
          <select
            value={cfg.news_image_mode}
            onChange={(e) => patch("news_image_mode", e.target.value)}
          >
            <option value="fullbleed">На весь екран із затемненням</option><option value="cover">Заповнює зону</option>
            <option value="contain">Повністю вміщується</option>
          </select>
        </label>
        <label>
          Перехід сцен
          <select
            value={cfg.transition}
            onChange={(e) => patch("transition", e.target.value)}
          >
            <option value="slide">Плавне зміщення та згасання</option>
            <option value="fade">Згасання</option>
          </select>
        </label>
        <label>
          Адреса загального QR
          <input
            type="url"
            placeholder="https://…"
            value={cfg.qr_url}
            onChange={(e) => patch("qr_url", e.target.value)}
          />
        </label>
      </div>
      <h3>Сцени: порядок та тривалість</h3>
      {order.map((scene, i) => (
        <div className="display-scene-config" key={scene}>
          <label className="check">
            <input
              type="checkbox"
              checked={cfg.blocks.includes(scene)}
              onChange={(e) => {
                const selected = e.target.checked
                  ? order.filter((s) => cfg.blocks.includes(s) || s === scene)
                  : cfg.blocks.filter((s) => s !== scene);
                if (selected.length) patch("blocks", selected);
              }}
            />
            {displayLabels[scene]}
          </label>
          <label>
            Секунд
            <input
              aria-label={"Тривалість: " + displayLabels[scene]}
              type="number"
              min={5}
              max={120}
              value={cfg.durations[scene] || cfg.interval}
              onChange={(e) =>
                patch("durations", {
                  ...cfg.durations,
                  [scene]: Number(e.target.value),
                })
              }
            />
          </label>
          <button
            type="button"
            aria-label={"Підняти: " + displayLabels[scene]}
            disabled={i === 0 || !cfg.blocks.includes(scene)}
            onClick={() => {
              const next = [...cfg.blocks],
                at = next.indexOf(scene);
              if (at > 0) {
                [next[at - 1], next[at]] = [next[at], next[at - 1]];
                patch("blocks", next);
              }
            }}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={"Опустити: " + displayLabels[scene]}
            disabled={
              !cfg.blocks.includes(scene) ||
              cfg.blocks.indexOf(scene) === cfg.blocks.length - 1
            }
            onClick={() => {
              const next = [...cfg.blocks],
                at = next.indexOf(scene);
              if (at >= 0 && at < next.length - 1) {
                [next[at + 1], next[at]] = [next[at], next[at + 1]];
                patch("blocks", next);
              }
            }}
          >
            ↓
          </button>
        </div>
      ))}
      <div className="display-options">
        {[
          ["ticker", "Інформаційна стрічка"],
          ["show_clock", "Годинник"],
          ["show_date", "Дата"],
          ["show_qr", "QR-код"],
          ["fullscreen_default", "Пропонувати повноекранний запуск"],
        ].map(([key, label]) => (
          <label className="check" key={key}>
            <input
              type="checkbox"
              checked={!!cfg[key as keyof typeof cfg]}
              onChange={(e) => patch(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>
      <p>
        Браузер дозволяє повноекранний режим після натискання кнопки. Важливі
        оголошення автоматично додаються до ротації.
      </p>
      <div className="row preview-toggle">
        <button type="button" className="button" onClick={show}>
          {preview ? "Оновити preview" : "Відкрити preview display"}
        </button>
        <Link to="/display" target="_blank">
          Відкрити екран
        </Link>
        <button type="button" onClick={() => onChange({ ...displayDefaults })}>
          Типові налаштування
        </button>
      </div>
      {preview && (
        <>
          <p>
            Точний preview 1920×1080 (16:9), масштабований до ширини панелі.
            Зміни ще не збережено на сайті.
          </p>
          <div ref={frame} className="display-preview-frame">
            <iframe
              key={revision}
              title="Preview display 16:9"
              src={import.meta.env.BASE_URL + "display?preview=1"}
              style={{ transform: `scale(${scale})` }}
            />
          </div>
        </>
      )}
    </section>
  );
}
