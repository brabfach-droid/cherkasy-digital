import { useRef, useState } from "react";
import { Button, Markdown } from "./UI";
export function Editor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null),
    [preview, setPreview] = useState(false);
  function insert(before: string, after = "") {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    onChange(
      value.slice(0, start) +
        before +
        value.slice(start, end) +
        after +
        value.slice(end),
    );
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }
  return (
    <div className="editor">
      <div className="editor-toolbar">
        {[
          ["Заголовок", "## ", ""],
          ["Жирний", "**", "**"],
          ["Курсив", "_", "_"],
          ["Посилання", "[", "](https://)"],
          ["Список", "- ", ""],
          ["Цитата", "> ", ""],
          ["Зображення", "![Опис](", ")"],
        ].map(([label, b, a]) => (
          <Button
            key={label}
            type="button"
            className="secondary small"
            onClick={() => insert(b, a)}
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          className="secondary small"
          onClick={() => setPreview(!preview)}
        >
          {preview ? "Редагувати" : "Перегляд"}
        </Button>
      </div>
      {preview ? (
        <Markdown value={value} />
      ) : (
        <textarea
          ref={ref}
          rows={10}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <small>
        Markdown. HTML проходить очищення. Завантажені зображення можна додати
        за посиланням із медіатеки.
      </small>
    </div>
  );
}
