import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { reveal, motionTokens } from "../config/motion";
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
import { fileUrl, upload, validateFile, deleteObject } from "../services/files";
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
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionTokens.normal }}
    >
      {children}
    </motion.div>
  );
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
function eventRelative(value:string){const now=new Date().toLocaleDateString("en-CA",{timeZone:"Europe/Kyiv"}),day=new Date(value).toLocaleDateString("en-CA",{timeZone:"Europe/Kyiv"}),diff=Math.round((Date.parse(day)-Date.parse(now))/86400000);return diff===0?"Сьогодні":diff===1?"Завтра":diff>1?"Через "+diff+" дн.":"Подія завершилась"}
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
      {row.cover_path&&<Media bucket={to.startsWith("/events")?"events":"news"} path={row.cover_path} alt={row.title}/>}
      {row.starts_at&&<div className="event-date"><strong>{new Date(row.starts_at).toLocaleDateString("uk-UA",{day:"numeric",timeZone:"Europe/Kyiv"})}</strong><span>{new Date(row.starts_at).toLocaleDateString("uk-UA",{month:"short",timeZone:"Europe/Kyiv"})}</span><small>{eventRelative(row.starts_at)}</small></div>}
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
        <AnimatePresence>
          {items.map((x) => (
            <motion.div
              {...reveal}
              layout
              key={x.id}
              className={"toast " + x.kind}
            >
              {x.text}
              <button
                aria-label="Закрити"
                onClick={() => setItems((v) => v.filter((i) => i.id !== x.id))}
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
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
  const [closing, setClosing] = useState(false);
  const reduced = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function close() {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(
      onClose,
      reduced ? 0 : motionTokens.normal * 1000,
    );
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: reduced ? 0 : motionTokens.normal }}
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: reduced ? 1 : 0.98 }}
        animate={{
          opacity: closing ? 0 : 1,
          scale: closing && !reduced ? 0.98 : 1,
        }}
        transition={{
          duration: reduced ? 0 : motionTokens.normal,
          ease: motionTokens.ease,
        }}
        className="modal"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
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
          <button aria-label="Закрити вікно" onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
type StagedFile={key:string;file:File;url:string;progress:number;state:"ready"|"uploading"|"done"|"error";error:string};
export function FileUpload({bucket,prefix,onUploaded,kind="file",multiple=true,maxFiles=10}:{bucket:string;prefix:string;onUploaded:(path:string,file:File)=>Promise<void>|void;kind?:string;multiple?:boolean;maxFiles?:number}){
 const [items,setItems]=useState<StagedFile[]>([]),[drag,setDrag]=useState(false),[error,setError]=useState("");const refs=useRef<string[]>([]),toast=useToast();const busy=items.some(v=>v.state==="uploading");const limit=multiple?Math.min(20,Math.max(1,maxFiles)):1;
 useEffect(()=>()=>refs.current.forEach(v=>URL.revokeObjectURL(v)),[]);
 function stage(files:File[]){setError("");const pending=items.filter(v=>v.state!=="done");if(pending.length+files.length>limit){setError("Дозволено до "+limit+" файлів за раз");return}const added:StagedFile[]=[];for(const file of files){try{const ext=validateFile(file,kind);if(ext==="ico"&&bucket!=="site-assets")throw new Error("ICO дозволено лише для favicon.");const url=URL.createObjectURL(file);refs.current.push(url);added.push({key:crypto.randomUUID(),file,url,progress:0,state:"ready",error:""})}catch(e){setError(errorText(e))}}setItems(v=>[...v.filter(x=>x.state!=="done"),...added])}
 const patch=(key:string,value:Partial<StagedFile>)=>setItems(v=>v.map(x=>x.key===key?{...x,...value}:x));
 async function send(){for(const item of items.filter(v=>["ready","error"].includes(v.state))){let path="";patch(item.key,{state:"uploading",progress:0,error:""});try{path=await upload(bucket,prefix,item.file,n=>patch(item.key,{progress:n}),kind);await onUploaded(path,item.file);patch(item.key,{state:"done",progress:100});toast("Файл завантажено")}catch(e){if(path)await deleteObject(bucket,path).catch(()=>{});patch(item.key,{state:"error",error:errorText(e)})}}}
 return <div className={"file-upload staged "+(drag?"drag-over":"")} onDragOver={e=>{e.preventDefault();if(!busy)setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(!busy)stage(Array.from(e.dataTransfer.files))}}><label><FileUp size={22}/> Вибрати файли або перетягнути сюди<input type="file" disabled={busy} multiple={multiple} accept={kind==="pdf"?".pdf":kind==="image"?".jpg,.jpeg,.png,.webp":".pdf,.docx,.jpg,.jpeg,.png,.webp"+(bucket==="site-assets"?",.ico":"")} onChange={e=>{stage(Array.from(e.target.files||[]));e.target.value=""}}/></label>{kind!=="pdf"&&<label className="camera-picker">Зробити фото<input type="file" accept="image/*" capture="environment" disabled={busy} onChange={e=>{stage(Array.from(e.target.files||[]));e.target.value=""}}/></label>}<small>До 10 МБ · PDF, DOCX, JPG, PNG, WEBP · Спочатку виберіть, потім натисніть «Завантажити».</small>{items.map((v,i)=><div key={v.key} className="staged-file" draggable={!busy&&v.state==="ready"} onDragStart={e=>e.dataTransfer.setData("text/plain",String(i))} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();if(busy)return;const from=Number(e.dataTransfer.getData("text/plain"));if(!Number.isInteger(from)||from<0||from>=items.length)return;setItems(arr=>{const copy=[...arr];copy.splice(i,0,copy.splice(from,1)[0]);return copy})}}>{v.file.type.startsWith("image/")?<img src={v.url} alt={v.file.name}/>:<FileUp size={24}/>}<div><strong>{v.file.name}</strong><small>{Math.ceil(v.file.size/1024)} КБ · {v.state==="done"?"Завантажено ✓":v.state==="uploading"?v.progress+"%":v.state==="error"?"Помилка":"Готовий до завантаження"}</small>{v.file.type==="application/pdf"&&<a href={v.url} target="_blank" rel="noreferrer">Переглянути PDF</a>}{v.state==="uploading"&&<progress max={100} value={v.progress}/>} {v.error&&<p role="alert" className="field-error">{v.error}</p>}</div>{!busy&&<Button type="button" className="ghost small" onClick={()=>setItems(a=>a.filter(x=>x.key!==v.key))}>Прибрати</Button>}</div>)}{items.some(v=>["ready","error"].includes(v.state))&&<Button type="button" busy={busy} onClick={()=>void send()}>Завантажити</Button>}{error&&<p className="field-error" role="alert">{error}</p>}</div>
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
export function Accordion({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false),
    reduced = useReducedMotion();
  return (
    <section className="accordion">
      <button
        type="button"
        className="accordion-title"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : motionTokens.normal }}
        >
          ⌄
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              duration: reduced ? 0 : motionTokens.normal,
              ease: motionTokens.ease,
            }}
            className="accordion-body"
          >
            <div>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
export function Popover({
  trigger,
  children,
  label,
  className = "",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className={"user-menu popover " + className}>
      <button
        aria-label={label}
        aria-expanded={open}
        className="popover-trigger icon-button"
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 4 }}
            transition={{
              duration: reduced ? 0 : motionTokens.normal,
              ease: motionTokens.ease,
            }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a,button")) setOpen(false);
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
