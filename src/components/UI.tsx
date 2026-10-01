import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  X,
  LoaderCircle,
  FileUp,
} from "lucide-react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { errorText } from "../services/data";
import { fileUrl, upload } from "../services/files";
import type { Row } from "../config/types";
import { statuses } from "../config/types";
export function Button({
  children,
  className = "",
  busy,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={"button " + className}
    >
      {busy ? <LoaderCircle className="spin" size={18} /> : null}
      {children}
    </button>
  );
}
export function Badge({ value }: { value: string }) {
  return <span className={"badge " + value}>{statuses[value] || value}</span>;
}
export function Empty({
  text = "Поки що немає записів",
  to,
  label,
}: {
  text?: string;
  to?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <CheckCircle2 size={30} />
      <h3>{text}</h3>
      {to && (
        <Link className="button" to={to}>
          {label || "Перейти до послуг"}
        </Link>
      )}
    </div>
  );
}
export function State({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string;
  children: React.ReactNode;
}) {
  if (loading)
    return <div role="status" aria-label="Завантаження" className="skeleton" />;
  if (error)
    return (
      <div role="alert" className="alert error">
        {error}
      </div>
    );
  return <>{children}</>;
}
export function Pagination({
  page,
  count,
  size = 12,
  onChange,
}: {
  page: number;
  count: number;
  size?: number;
  onChange: (p: number) => void;
}) {
  return count > size ? (
    <nav className="pagination" aria-label="Сторінки">
      <Button disabled={page === 1} onClick={() => onChange(page - 1)}>
        Назад
      </Button>
      <span>
        {page} / {Math.ceil(count / size)}
      </span>
      <Button
        disabled={page * size >= count}
        onClick={() => onChange(page + 1)}
      >
        Далі
      </Button>
    </nav>
  ) : null;
}
export function Markdown({ value }: { value?: string }) {
  return (
    <div
      className="prose"
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(
          marked.parse(value || "", { async: false }) as string,
          { FORBID_TAGS: ["iframe", "style", "form"], FORBID_ATTR: ["style"] },
        ),
      }}
    />
  );
}
export function SearchBar({
  value,
  onChange,
  placeholder = "Пошук…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      aria-label={placeholder}
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
export function Card({
  row,
  to,
  subtitle,
}: {
  row: Row;
  to: string;
  subtitle?: string;
}) {
  return (
    <Link className="card" to={to}>
      <div className="card-top">
        <span className="eyebrow">{subtitle || "Міський портал"}</span>
        <ArrowUpRight size={20} />
      </div>
      {row.is_demo && <Badge value="Демо" />}
      <h3>{row.title || row.name}</h3>
      <p>{row.summary || row.description}</p>
      <span className="card-link">
        Детальніше <span>→</span>
      </span>
    </Link>
  );
}
const ToastContext = createContext<(text: string, kind?: string) => void>(
  () => {},
);
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<
    { id: number; text: string; kind: string }[]
  >([]);
  return (
    <ToastContext.Provider
      value={(text, kind = "success") => {
        const id = Date.now() + Math.random();
        setItems((v) => [...v, { id, text, kind }]);
        setTimeout(() => setItems((v) => v.filter((x) => x.id !== id)), 6500);
      }}
    >
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((x) => (
          <div key={x.id} className={"toast " + x.kind}>
            {x.text}
            <button
              aria-label="Закрити"
              onClick={() => setItems((v) => v.filter((i) => i.id !== x.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = old;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const els = ref.current?.querySelectorAll<HTMLElement>(
              'button,a,input,select,textarea,[tabindex="0"]',
            );
            if (!els?.length) return;
            const first = els[0],
              last = els[els.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button aria-label="Закрити вікно" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function FileUpload({
  bucket,
  prefix,
  onUploaded,
  kind = "file",
}: {
  bucket: string;
  prefix: string;
  onUploaded: (path: string, file: File) => Promise<void> | void;
  kind?: string;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const toast = useToast();
  return (
    <div className="file-upload">
      <label>
        <FileUp size={18} /> Додати{" "}
        {kind === "pdf" ? "PDF" : kind === "image" ? "зображення" : "файл"}
        <input
          type="file"
          disabled={progress !== null}
          accept={
            kind === "pdf"
              ? ".pdf"
              : kind === "image"
                ? ".jpg,.jpeg,.png,.webp"
                : ".pdf,.docx,.jpg,.jpeg,.png,.webp,.ico"
          }
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setProgress(0);
            try {
              const p = await upload(bucket, prefix, f, setProgress, kind);
              await onUploaded(p, f);
              toast("Файл завантажено");
            } catch (err) {
              toast(errorText(err), "error");
            } finally {
              setProgress(null);
              e.target.value = "";
            }
          }}
        />
      </label>
      {progress !== null && (
        <progress value={progress} max="100" aria-label="Завантаження файлу" />
      )}
      <small>До 10 МБ. PDF, DOCX, JPG, PNG, WEBP.</small>
    </div>
  );
}
export function FileLink({
  bucket,
  path,
  name = "Відкрити файл",
  download = false,
}: {
  bucket: string;
  path: string;
  name?: string;
  download?: boolean;
}) {
  const toast = useToast();
  return (
    <Button
      className="secondary small"
      onClick={async () => {
        const tab = window.open("about:blank", "_blank");
        try {
          const url = await fileUrl(bucket, path, download ? name : undefined);
          if (tab) {
            tab.opener = null;
            tab.location.href = url;
          }
        } catch (e) {
          tab?.close();
          toast(errorText(e), "error");
        }
      }}
    >
      {name}
    </Button>
  );
}
export function Media({
  bucket,
  path,
  alt,
}: {
  bucket: string;
  path?: string;
  alt: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    if (path)
      fileUrl(bucket, path)
        .then((u) => {
          if (active) setUrl(u);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [bucket, path]);
  return url ? (
    <img className="cover" src={url} alt={alt} loading="lazy" />
  ) : null;
}
