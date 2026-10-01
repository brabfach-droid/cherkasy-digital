import { DisplaySettings } from "../components/DisplaySettings";
import { RevisionHistory } from "./V2Pages";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/Auth";
import { useSettings } from "../hooks/Settings";
import { useData, useDebounce } from "../hooks/useData";
import { list, save, remove, rpc, errorText } from "../services/data";
import { requireClient } from "../services/client";
import { fileUrl, deleteObject } from "../services/files";
import { resources } from "../config/cms";
import type { EditField } from "../config/cms";
import type { FormField, Row, FieldType } from "../config/types";
import { datetime, roleLabels, statuses } from "../config/types";
import {
  Badge,
  Button,
  Empty,
  FileLink,
  FileUpload,
  Markdown,
  Modal,
  Pagination,
  SearchBar,
  State,
  useToast,
} from "../components/UI";
import { Editor } from "../components/Editor";
import { DynamicFields } from "../components/DynamicForm";
export function Dashboard() {
  const a = useAuth();
  const q = useData(async () => {
    const stats = await Promise.all(
      [
        "profiles",
        "applications",
        "appeals",
        "services",
        "news",
        "documents",
      ].map(async (t) => ({ table: t, ...(await list(t, { size: 5 })) })),
    );
    const audit = a.roles.some((r) => ["super_admin", "admin"].includes(r))
      ? await list("audit_logs", { size: 10 })
      : { rows: [], count: 0 };
    return { stats, audit };
  });
  return (
    <>
      <p className="eyebrow">Робочий простір</p>
      <h1>Огляд порталу</h1>
      <State loading={q.loading} error={q.error}>
        <div className="stats">
          {q.data?.stats.map((r) => (
            <div className="stat" key={r.table}>
              <strong>{r.count}</strong>
              <span>
                {
                  {
                    profiles: "Користувачі",
                    applications: "Заяви",
                    appeals: "Звернення",
                    services: "Послуги",
                    news: "Новини",
                    documents: "Документи",
                  }[r.table]
                }
              </span>
            </div>
          ))}
        </div>
        <h2>Останні дії</h2>
        {q.data?.audit.rows.length ? (
          q.data.audit.rows.map((r) => (
            <div className="list-item" key={r.id}>
              <b>
                {r.entity} · {r.action}
              </b>
              <small>{datetime(r.created_at)}</small>
            </div>
          ))
        ) : (
          <p className="muted">Журнал аудиту доступний адміністраторам.</p>
        )}
      </State>
    </>
  );
}
export function StaffList({ kindName }: { kindName?: string } = {}) {
  const params = useParams(),
    kind = kindName || params.kind,
    table = kind === "appeals" ? "appeals" : "applications";
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [dep, setDep] = useState(""),
    [service, setService] = useState(""),
    [assignee, setAssignee] = useState(""),
    [sort, setSort] = useState("created_at");
  const d = useDebounce(search),
    q = useData(
      () =>
        list(table, {
          page,
          search: d,
          searchColumns:
            table === "appeals" ? ["number", "title", "message"] : ["number"],
          order: sort,
          ascending: sort === "number",
          eq: {
            ...(status ? { status } : {}),
            ...(dep ? { department_id: dep } : {}),
            ...(service && table === "applications"
              ? { service_id: service }
              : {}),
            ...(assignee ? { assignee_id: assignee } : {}),
          },
        }),
      [table, page, d, status, dep, service, assignee, sort],
    );
  const refs = useData(async () => {
    const [deps, services] = await Promise.all([
      list("departments", { size: 100 }),
      list("services", { size: 1000 }),
    ]);
    return { deps: deps.rows, services: services.rows };
  });
  const base = window.location.pathname.startsWith("/admin")
    ? "admin"
    : "staff";
  return (
    <>
      <h1>{table === "appeals" ? "Звернення" : "Заяви"}</h1>
      <div className="filters">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Пошук за номером"
        />
        <select
          aria-label="Статус"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Усі статуси</option>
          {(table === "appeals"
            ? [
                "new",
                "received",
                "forwarded",
                "in_progress",
                "completed",
                "rejected",
              ]
            : [
                "draft",
                "submitted",
                "received",
                "in_review",
                "needs_more_info",
                "approved",
                "rejected",
                "completed",
                "cancelled",
              ]
          ).map((s) => (
            <option key={s} value={s}>
              {statuses[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Департамент"
          value={dep}
          onChange={(e) => {
            setDep(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Усі департаменти</option>
          {refs.data?.deps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {table === "applications" && (
          <select
            aria-label="Послуга"
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Усі послуги</option>
            {refs.data?.services.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        )}
        <input
          aria-label="UUID відповідального"
          placeholder="UUID відповідального"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        />
        <select
          aria-label="Сортування"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="created_at">За датою</option>
          <option value="number">За номером</option>
        </select>
      </div>
      <State loading={q.loading} error={q.error}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Номер</th>
                <th>Заявник</th>
                <th>Послуга / тема</th>
                <th>Дата</th>
                <th>Статус</th>
                <th>Відповідальний</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="Номер">
                    <Link to={"/" + base + "/" + table + "/" + r.id}>
                      {r.number || "Чернетка"}
                    </Link>
                  </td>
                  <td data-label="Заявник">{r.user_id}</td>
                  <td data-label="Послуга">
                    {r.title ||
                      refs.data?.services.find((s) => s.id === r.service_id)
                        ?.title ||
                      "Послуга"}
                  </td>
                  <td data-label="Дата">{datetime(r.created_at)}</td>
                  <td data-label="Статус">
                    <Badge value={r.status} />
                  </td>
                  <td data-label="Відповідальний">
                    {r.assignee_id || "Не призначено"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!q.data?.count && <Empty text="Записів немає" />}
        <Pagination page={page} count={q.data?.count || 0} onChange={setPage} />
      </State>
    </>
  );
}
export function Crud({ resourceName }: { resourceName?: string } = {}) {
  const auth = useAuth();
  const params = useParams(),
    resource = resourceName || params.resource,
    config = resources[resource || ""],
    toast = useToast(),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("created_at"),
    [editing, setEditing] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [revision, setRevision] = useState<Row | null>(null);
  const d = useDebounce(search);
  const q = useData(
    () =>
      list(config?.table || "services", {
        page,
        search: d,
        searchColumns:
          config?.table === "account_verifications"
            ? ["kind"]
            : config?.fields.some((f) => f.key === "title")
              ? ["title"]
              : config?.table === "faqs"
                ? ["question", "answer"]
                : config?.table === "account_deletion_requests"
                  ? ["status"]
                  : ["name"],
        eq: {
          ...(status ? { status } : {}),
          ...(resource === "important-announcements"
            ? { placement: "global" }
            : {}),
        },
        order: sort,
      }),
    [resource, d, page, status, sort],
  );
  if (!config) return <Empty text="Розділ не знайдено" />;
  const allowed =
    auth.roles.some((r) => ["super_admin", "admin"].includes(r)) ||
    (["news", "documents", "events"].includes(config.table) &&
      auth.roles.includes("editor")) ||
    (config.table === "services" && auth.roles.includes("department_admin"));
  if (!allowed) return <Empty text="Немає прав для цього розділу" />;
  const canCreate = config.table !== "account_deletion_requests";
  return (
    <>
      <p className="eyebrow">Керування контентом</p>
      <div className="section-heading">
        <h1>{config.title}</h1>
        {canCreate && (
          <Button
            onClick={() => {
              const row: Row = { id: crypto.randomUUID() };
              for (const f of config.fields) {
                row[f.key] =
                  f.type === "checkbox"
                    ? [
                        "available",
                        "active",
                        "is_active",
                        "published",
                      ].includes(f.key)
                    : f.type === "json"
                      ? f.key === "faq"
                        ? []
                        : {}
                      : f.type === "tags" || f.type === "gallery"
                        ? []
                        : f.type === "select"
                          ? f.options?.[0] || ""
                          : f.type === "number"
                            ? 0
                            : f.type === "datetime-local"
                              ? new Date().toISOString()
                              : "";
              }
              if (resource === "important-announcements") {
                row.end_at = null;
                row.placement = "global";
                row.version = 1;
                row.dismissible = true;
              }
              setEditing(row);
            }}
          >
            Створити
          </Button>
        )}
      </div>
      <div className="filters">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
        {config.content && (
          <select
            aria-label="Стан публікації"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Усі стани, включно з архівом</option>
            {["draft", "published", "scheduled", "archived"].map((s) => (
              <option key={s} value={s}>
                {statuses[s]}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Сортування"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="created_at">За датою</option>
          <option
            value={
              config.fields.some((f) => f.key === "title")
                ? "title"
                : config.table === "faqs"
                  ? "question"
                  : "status"
            }
          >
            За назвою / станом
          </option>
        </select>
      </div>
      <State loading={q.loading} error={q.error}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Назва</th>
                <th>Статус</th>
                <th>Оновлено</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.rows.map((r) => (
                <tr key={r.id}>
                  <td data-label="Назва">
                    {r.title || r.name || r.question || r.user_id}
                  </td>
                  <td data-label="Статус">
                    <Badge
                      value={r.status || (r.published ? "published" : "Запис")}
                    />
                  </td>
                  <td data-label="Оновлено">{datetime(r.updated_at)}</td>
                  <td data-label="Дії">
                    <Button
                      className="secondary small"
                      onClick={() => setEditing(r)}
                    >
                      Редагувати
                    </Button>
                    {[
                      "services",
                      "news",
                      "documents",
                      "events",
                      "faqs",
                      "announcements",
                    ].includes(config.table) && (
                      <Button
                        className="secondary small"
                        onClick={() => setRevision(r)}
                      >
                        Історія змін
                      </Button>
                    )}
                    {config.content && (
                      <Button
                        className="secondary small"
                        onClick={async () => {
                          try {
                            await save(config.table, {
                              id: r.id,
                              status: "archived",
                            });
                            q.reload();
                          } catch (e) {
                            toast(errorText(e), "error");
                          }
                        }}
                      >
                        Архів
                      </Button>
                    )}
                    {canCreate && (
                      <Button
                        className="secondary small"
                        onClick={async () => {
                          if (
                            !confirm(
                              config.content
                                ? "Перемістити до кошика?"
                                : "Видалити запис?",
                            )
                          )
                            return;
                          try {
                            if (config.content)
                              await save(config.table, {
                                id: r.id,
                                deleted_at: new Date().toISOString(),
                                status: "archived",
                              });
                            else await remove(config.table, r.id);
                            q.reload();
                          } catch (e) {
                            toast(errorText(e), "error");
                          }
                        }}
                      >
                        {config.content ? "До кошика" : "Видалити"}
                      </Button>
                    )}
                    {r.deleted_at && (
                      <Button
                        className="secondary small"
                        onClick={async () => {
                          try {
                            await save(config.table, {
                              id: r.id,
                              deleted_at: null,
                              status: "draft",
                            });
                            q.reload();
                          } catch (e) {
                            toast(errorText(e), "error");
                          }
                        }}
                      >
                        Відновити
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!q.data?.count && <Empty />}
        <Pagination page={page} count={q.data?.count || 0} onChange={setPage} />
      </State>
      {revision && (
        <Modal title="Історія змін" onClose={() => setRevision(null)}>
          <RevisionHistory
            table={config.table}
            id={revision.id}
            onRestored={() => q.reload()}
          />
        </Modal>
      )}
      {editing && (
        <Modal
          title={config.title + " — редактор"}
          onClose={() => {
            setEditing(null);
            setPreview(false);
          }}
        >
          {preview ? (
            <>
              <h1>{editing.title || editing.name || editing.question}</h1>
              <p>{editing.summary || editing.description}</p>
              <Markdown value={editing.content || editing.answer} />
              <Button onClick={() => setPreview(false)}>
                Назад до редактора
              </Button>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const clean: Partial<Row> = { id: editing.id };
                  for (const f of config.fields) {
                    const v = editing[f.key];
                    clean[f.key] =
                      [
                        "relation",
                        "date",
                        "datetime-local",
                        "url",
                        "email",
                      ].includes(f.type || "") && v === ""
                        ? null
                        : v;
                  }
                  if (resource === "important-announcements")
                    clean.placement = "global";
                  if (config.table === "account_verifications")
                    clean.verified_by = auth.session!.user.id;
                  if (editing.filename) clean.filename = editing.filename;
                  await save(config.table, clean);
                  setEditing(null);
                  q.reload();
                  toast("Збережено");
                } catch (err) {
                  toast(errorText(err), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {config.fields.map((f) => (
                <CmsField
                  key={f.key}
                  field={f}
                  row={editing}
                  onChange={(key, v) =>
                    setEditing((r) => (r ? { ...r, [key]: v } : r))
                  }
                />
              ))}
              <div className="actions">
                <Button busy={busy}>Зберегти</Button>
                {config.content && (
                  <Button
                    type="button"
                    className="secondary"
                    onClick={() => setPreview(true)}
                  >
                    Попередній перегляд
                  </Button>
                )}
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
function CmsField({
  field: f,
  row,
  onChange,
}: {
  field: EditField;
  row: Row;
  onChange: (k: string, v: any) => void;
}) {
  const refs = useData(
    () =>
      f.table
        ? list(f.table, { size: 1000 })
        : Promise.resolve({ rows: [], count: 0 }),
    [f.table],
  );
  const v = row[f.key] ?? "";
  const t = f.type || "text";
  if (t === "markdown")
    return (
      <div className="field">
        <label>{f.label}</label>
        <Editor value={v} onChange={(v) => onChange(f.key, v)} />
      </div>
    );
  if (["image", "file", "gallery"].includes(t))
    return (
      <div className="field">
        <h3>{f.label}</h3>
        {v && t !== "gallery" && (
          <FileLink bucket={f.bucket!} path={v} name="Поточний файл" />
        )}
        {t === "gallery" &&
          (Array.isArray(v) ? v : []).map((p: string) => (
            <div key={p} className="row">
              <FileLink bucket={f.bucket!} path={p} />
              <Button
                type="button"
                className="secondary small"
                onClick={() =>
                  onChange(
                    f.key,
                    v.filter((x: string) => x !== p),
                  )
                }
              >
                Прибрати з галереї
              </Button>
            </div>
          ))}
        <FileUpload
          bucket={f.bucket!}
          prefix={row.id}
          kind={t === "image" || t === "gallery" ? "image" : "file"}
          onUploaded={(p, file) => {
            onChange(
              f.key,
              t === "gallery" ? [...(Array.isArray(v) ? v : []), p] : p,
            );
            if (t === "file") onChange("filename", file.name);
          }}
        />
      </div>
    );
  if (t === "json")
    return (
      <JsonField
        label={f.label}
        value={v}
        onChange={(v) => onChange(f.key, v)}
      />
    );
  let control;
  if (t === "textarea")
    control = (
      <textarea
        value={v}
        required={f.required}
        onChange={(e) => onChange(f.key, e.target.value)}
      />
    );
  else if (t === "checkbox")
    control = (
      <input
        type="checkbox"
        checked={v === true}
        onChange={(e) => onChange(f.key, e.target.checked)}
      />
    );
  else if (t === "select" || t === "relation")
    control = (
      <select
        value={v}
        required={f.required}
        onChange={(e) => onChange(f.key, e.target.value)}
      >
        {t === "relation" && <option value="">Не вибрано</option>}
        {t === "relation"
          ? refs.data?.rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name || r.title}
              </option>
            ))
          : f.options?.map((o) => (
              <option value={o} key={o}>
                {statuses[o] ||
                  (
                    {
                      online: "Онлайн",
                      offline: "Офлайн",
                      hybrid: "Онлайн + офлайн",
                      normal: "Нормальний",
                      info: "Інформація",
                      warning: "Увага",
                      danger: "Небезпека",
                      critical: "Критичний",
                      banner: "Банер",
                      modal: "Вікно",
                      pinned: "Закріплене",
                    } as Record<string, string>
                  )[o] ||
                  o}
              </option>
            ))}
      </select>
    );
  else if (t === "tags")
    control = (
      <input
        value={Array.isArray(v) ? v.join(", ") : v}
        onChange={(e) =>
          onChange(
            f.key,
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    );
  else
    control = (
      <input
        type={t}
        value={
          t === "datetime-local" && v
            ? new Date(
                new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000,
              )
                .toISOString()
                .slice(0, 16)
            : v
        }
        required={f.required}
        onChange={(e) =>
          onChange(
            f.key,
            t === "number"
              ? Number(e.target.value)
              : t === "datetime-local" && e.target.value
                ? new Date(e.target.value).toISOString()
                : e.target.value,
          )
        }
      />
    );
  return (
    <label className={t === "checkbox" ? "check" : ""}>
      {t === "checkbox" ? control : null}
      {f.label}
      {f.required ? " *" : ""}
      {t !== "checkbox" ? control : null}
    </label>
  );
}
function JsonField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value || {}, null, 2)),
    [error, setError] = useState("");
  return (
    <label>
      {label}
      <textarea
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setError("");
          } catch {
            setError("Перевірте JSON");
          }
        }}
        onBlur={() => {
          if (error) setText(JSON.stringify(value, null, 2));
        }}
      />
      <small className="field-error">{error}</small>
    </label>
  );
}
export function FormBuilder() {
  const toast = useToast();
  const [service, setService] = useState(""),
    [fields, setFields] = useState<FormField[]>([]),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [previewData, setPreviewData] = useState({});
  const services = useData(() => list("services", { size: 1000 }));
  const q = useData(async () => {
    if (!service) return null;
    const forms = await list("service_forms", {
      eq: { service_id: service },
      size: 1,
    });
    if (!forms.rows[0]) return [];
    return (
      await list("service_form_fields", {
        eq: { form_id: forms.rows[0].id },
        size: 100,
        order: "sort_order",
        ascending: true,
      })
    ).rows as FormField[];
  }, [service]);
  useEffect(() => {
    if (q.data) setFields(q.data);
    else if (!q.loading) setFields([]);
  }, [q.data, q.loading]);
  const types: FieldType[] = [
    "text",
    "textarea",
    "email",
    "phone",
    "number",
    "date",
    "select",
    "multiselect",
    "radio",
    "checkbox",
    "address",
    "file",
    "image",
    "pdf",
    "confirmation",
    "heading",
    "information",
  ];
  function change(i: number, key: string, value: any) {
    setFields((fs) => fs.map((f, j) => (i === j ? { ...f, [key]: value } : f)));
  }
  return (
    <>
      <p className="eyebrow">Без зміни коду</p>
      <h1>Конструктор форм</h1>
      <label>
        Послуга
        <select value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">Виберіть послугу</option>
          {services.data?.rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      {service && (
        <State loading={q.loading} error={q.error}>
          {fields.map((f, i) => (
            <div className="panel" key={i}>
              <div className="section-heading">
                <h3>Поле {i + 1}</h3>
                <div className="actions">
                  <Button
                    className="secondary small"
                    disabled={i === 0}
                    onClick={() =>
                      setFields((fs) => {
                        const n = [...fs];
                        [n[i], n[i - 1]] = [n[i - 1], n[i]];
                        return n;
                      })
                    }
                  >
                    ↑
                  </Button>
                  <Button
                    className="secondary small"
                    disabled={i === fields.length - 1}
                    onClick={() =>
                      setFields((fs) => {
                        const n = [...fs];
                        [n[i], n[i + 1]] = [n[i + 1], n[i]];
                        return n;
                      })
                    }
                  >
                    ↓
                  </Button>
                  <Button
                    className="secondary small"
                    onClick={() =>
                      setFields((fs) => fs.filter((_, j) => j !== i))
                    }
                  >
                    Видалити
                  </Button>
                </div>
              </div>
              <div className="grid two">
                <label>
                  Ключ
                  <input
                    value={f.key}
                    pattern="[a-zA-Z][a-zA-Z0-9_]*"
                    onChange={(e) => change(i, "key", e.target.value)}
                  />
                </label>
                <label>
                  Тип
                  <select
                    value={f.type}
                    onChange={(e) => change(i, "type", e.target.value)}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Підпис
                  <input
                    value={f.label}
                    onChange={(e) => change(i, "label", e.target.value)}
                  />
                </label>
                <label>
                  Placeholder
                  <input
                    value={f.placeholder || ""}
                    onChange={(e) => change(i, "placeholder", e.target.value)}
                  />
                </label>
              </div>
              <label>
                Пояснення
                <textarea
                  value={f.help_text || ""}
                  onChange={(e) => change(i, "help_text", e.target.value)}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => change(i, "required", e.target.checked)}
                />
                Обов’язкове поле
              </label>
              {["select", "multiselect", "radio"].includes(f.type) && (
                <label>
                  Опції, кожна з нового рядка
                  <textarea
                    value={f.options.join("\n")}
                    onChange={(e) =>
                      change(i, "options", e.target.value.split("\n"))
                    }
                  />
                </label>
              )}
              {f.type === "date" && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!f.validation.noFuture}
                    onChange={(e) =>
                      change(i, "validation", {
                        ...f.validation,
                        noFuture: e.target.checked,
                      })
                    }
                  />
                  Дата не може бути в майбутньому
                </label>
              )}
              <label>
                Показувати після відповіді в іншому полі (ключ поля)
                <input
                  value={f.validation.showWhen?.field || ""}
                  onChange={(e) => {
                    const v = { ...f.validation };
                    if (e.target.value)
                      v.showWhen = {
                        field: e.target.value,
                        equals: v.showWhen?.equals || "",
                      };
                    else delete v.showWhen;
                    change(i, "validation", v);
                  }}
                />
              </label>
              {f.validation.showWhen?.field && (
                <label>
                  Значення відповіді (для checkbox: true або false)
                  <input
                    value={String(f.validation.showWhen.equals)}
                    onChange={(e) =>
                      change(i, "validation", {
                        ...f.validation,
                        showWhen: {
                          ...f.validation.showWhen,
                          equals:
                            e.target.value === "true"
                              ? true
                              : e.target.value === "false"
                                ? false
                                : e.target.value,
                        },
                      })
                    }
                  />
                </label>
              )}
              <div className="grid two">
                {["min", "max", "minLength", "maxLength", "pattern"].map(
                  (k) => (
                    <label key={k}>
                      {
                        (
                          {
                            min: "Мінімум числа",
                            max: "Максимум числа",
                            minLength: "Мінімальна довжина",
                            maxLength: "Максимальна довжина",
                            pattern: "Регулярний вираз",
                          } as Record<string, string>
                        )[k]
                      }
                      <input
                        type={k === "pattern" ? "text" : "number"}
                        value={f.validation[k] ?? ""}
                        onChange={(e) => {
                          const n = { ...f.validation };
                          if (!e.target.value) delete n[k];
                          else
                            n[k] =
                              k === "pattern"
                                ? e.target.value
                                : Number(e.target.value);
                          change(i, "validation", n);
                        }}
                      />
                    </label>
                  ),
                )}
              </div>
            </div>
          ))}
          <div className="actions">
            <Button
              className="secondary"
              onClick={() =>
                setFields((fs) => [
                  ...fs,
                  {
                    key: "field_" + (fs.length + 1),
                    type: "text",
                    label: "Нове поле",
                    required: false,
                    options: [],
                    validation: {},
                    sort_order: fs.length,
                  },
                ])
              }
            >
              Додати поле
            </Button>
            <Button className="secondary" onClick={() => setPreview(true)}>
              Переглянути форму
            </Button>
            <Button
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (
                    fields.some(
                      (f) => !f.label || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(f.key),
                    ) ||
                    new Set(fields.map((f) => f.key)).size !== fields.length
                  )
                    throw new Error(
                      "Перевірте підписи й унікальні ключі полів",
                    );
                  await rpc("replace_service_form", {
                    p_service: service,
                    p_fields: fields.map((f, i) => ({ ...f, sort_order: i })),
                  });
                  q.reload();
                  toast("Форму збережено");
                } catch (e) {
                  toast(errorText(e), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Зберегти форму
            </Button>
          </div>
        </State>
      )}
      {preview && (
        <Modal
          title="Попередній перегляд форми"
          onClose={() => setPreview(false)}
        >
          <DynamicFields
            fields={fields}
            data={previewData}
            onChange={(k, v) => setPreviewData((d) => ({ ...d, [k]: v }))}
          />
          {fields
            .filter((f) => ["file", "image", "pdf"].includes(f.type))
            .map((f) => (
              <p key={f.key}>
                {f.label} · вкладення {f.type}
                {f.required ? " (обов’язкове)" : ""}
              </p>
            ))}
        </Modal>
      )}
    </>
  );
}
export function UserManagement() {
  const toast = useToast(),
    auth = useAuth();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [user, setUser] = useState<Row | null>(null),
    [roles, setRoles] = useState<string[]>([]),
    [deps, setDeps] = useState<string[]>([]),
    [blocked, setBlocked] = useState(false),
    [busy, setBusy] = useState(false);
  const d = useDebounce(search);
  const q = useData(
    () =>
      list("profiles", {
        search: d,
        searchColumns: ["email", "first_name", "last_name"],
        page,
      }),
    [d, page],
  );
  const departments = useData(() => list("departments", { size: 100 }));
  return (
    <>
      <h1>Користувачі та службові ролі</h1>
      <p>
        Змінювати ролі й блокування може головний адміністратор. Остання
        активність Supabase Auth не збирається.
      </p>
      <SearchBar value={search} onChange={setSearch} />
      <State loading={q.loading} error={q.error}>
        {q.data?.rows.map((r) => (
          <div className="list-item row" key={r.id}>
            <div>
              <h3>
                {r.first_name} {r.last_name}
              </h3>
              <p>
                {r.email} · {r.blocked ? "Заблоковано" : "Активний"} ·{" "}
                {datetime(r.created_at)}
              </p>
            </div>
            <Button
              className="secondary"
              disabled={!auth.roles.includes("super_admin")}
              onClick={async () => {
                try {
                  const [ur, sd] = await Promise.all([
                    list("user_roles", {
                      eq: { user_id: r.user_id },
                      size: 20,
                    }),
                    list("staff_departments", {
                      eq: { user_id: r.user_id },
                      size: 100,
                    }),
                  ]);
                  setRoles(ur.rows.map((x) => x.role_name));
                  setDeps(sd.rows.map((x) => x.department_id));
                  setBlocked(r.blocked);
                  setUser(r);
                } catch (e) {
                  toast(errorText(e), "error");
                }
              }}
            >
              Права доступу
            </Button>
          </div>
        ))}
        <Pagination page={page} count={q.data?.count || 0} onChange={setPage} />
      </State>
      {user && (
        <Modal title={"Права: " + user.email} onClose={() => setUser(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await rpc("set_staff", {
                  p_user: user.user_id,
                  p_roles: roles,
                  p_departments: deps,
                  p_blocked: blocked,
                });
                setUser(null);
                q.reload();
                toast("Права оновлено");
              } catch (err) {
                toast(errorText(err), "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {Object.entries(roleLabels).map(([key, label]) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={roles.includes(key)}
                  onChange={(e) =>
                    setRoles(
                      e.target.checked
                        ? [...roles, key]
                        : roles.filter((r) => r !== key),
                    )
                  }
                />
                {label}
              </label>
            ))}
            <h3>Департаменти</h3>
            {departments.data?.rows.map((r) => (
              <label key={r.id} className="check">
                <input
                  type="checkbox"
                  checked={deps.includes(r.id)}
                  onChange={(e) =>
                    setDeps(
                      e.target.checked
                        ? [...deps, r.id]
                        : deps.filter((d) => d !== r.id),
                    )
                  }
                />
                {r.name}
              </label>
            ))}
            <label className="check">
              <input
                type="checkbox"
                checked={blocked}
                onChange={(e) => setBlocked(e.target.checked)}
              />
              Заблокований профіль
            </label>
            <Button busy={busy}>Зберегти права</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Settings() {
  const auth = useAuth();
  const { settings, reload } = useSettings(),
    toast = useToast();
  const [values, setValues] = useState(settings),
    [busy, setBusy] = useState(false);
  if (!auth.roles.some((r) => ["super_admin", "admin"].includes(r)))
    return <Empty text="Доступ обмежено" />;
  return (
    <>
      <h1>Налаштування порталу</h1>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            for (const [key, value] of Object.entries(values)) {
              const existing = await list("site_settings", {
                eq: { key },
                size: 1,
              });
              await save("site_settings", {
                ...(existing.rows[0] ? { id: existing.rows[0].id } : {}),
                key,
                value,
              });
            }
            reload();
            toast("Налаштування збережено");
          } catch (err) {
            toast(errorText(err), "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          ["name", "Назва"],
          ["short_name", "Коротка назва"],
          ["description", "Опис"],
          ["hero_title", "Заголовок головної"],
          ["hero_description", "Підзаголовок"],
          ["primary_color", "Основний колір"],
          ["accent_color", "Акцентний колір"],
          ["contact_email", "Контактний email"],
          ["footer_text", "Текст footer"],
          ["maintenance_notice", "Повідомлення про роботи"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type={
                key.includes("color")
                  ? "color"
                  : key === "contact_email"
                    ? "email"
                    : "text"
              }
              value={values[key] || ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </label>
        ))}
        {[
          ["logo_path", "Логотип"],
          ["favicon_path", "Favicon"],
        ].map(([key, label]) => (
          <div className="field" key={key}>
            <h3>{label}</h3>
            <FileUpload
              bucket="site-assets"
              prefix="branding"
              onUploaded={(p) => setValues((v) => ({ ...v, [key]: p }))}
            />
          </div>
        ))}
        {[
          ["privacy_text", "Політика конфіденційності"],
          ["terms_text", "Умови використання"],
        ].map(([key, label]) => (
          <div className="field" key={key}>
            <h3>{label}</h3>
            <Editor
              value={values[key] || ""}
              onChange={(s) => setValues((v) => ({ ...v, [key]: s }))}
            />
          </div>
        ))}
        <JsonField
          label="Соціальні мережі [{label,url}]"
          value={values.social_links || []}
          onChange={(social_links) =>
            setValues((v) => ({ ...v, social_links }))
          }
        />
        <h2>Режим великого екрана</h2>
        <DisplaySettings
          value={values.display || {}}
          onChange={(display) => setValues((v) => ({ ...v, display }))}
        />
        <h2>Блоки головної сторінки</h2>
        {(values.homepage_blocks || []).map((b: any, i: number) => (
          <div key={b.key} className="row">
            <label className="check">
              <input
                type="checkbox"
                checked={b.enabled}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    homepage_blocks: v.homepage_blocks.map(
                      (x: any, j: number) =>
                        j === i ? { ...x, enabled: e.target.checked } : x,
                    ),
                  }))
                }
              />
              {(
                {
                  popular: "Популярні послуги",
                  categories: "Категорії",
                  now: "Черкаси зараз",
                  announcements: "Оголошення",
                  news: "Новини",
                  events: "Події",
                  documents: "Документи",
                  help: "Допомога",
                } as Record<string, string>
              )[b.key] || b.key}
            </label>
            <label>
              Порядок
              <input
                type="number"
                value={b.sort_order}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    homepage_blocks: v.homepage_blocks.map(
                      (x: any, j: number) =>
                        j === i
                          ? { ...x, sort_order: Number(e.target.value) }
                          : x,
                    ),
                  }))
                }
              />
            </label>
          </div>
        ))}
        <Button busy={busy}>Зберегти налаштування</Button>
      </form>
    </>
  );
}
export function Audit() {
  const [page, setPage] = useState(1);
  const q = useData(() => list("audit_logs", { page }), [page]);
  return (
    <>
      <h1>Журнал аудиту</h1>
      <State loading={q.loading} error={q.error}>
        {q.data?.rows.map((r) => (
          <div className="panel" key={r.id}>
            <b>
              {r.action} · {r.entity}
            </b>
            <p>{r.entity_id}</p>
            <small>
              Працівник: {r.actor_id || "SQL / сервер"} ·{" "}
              {datetime(r.created_at)}
            </small>
            <pre>{JSON.stringify(r.metadata, null, 2)}</pre>
          </div>
        ))}
        <Pagination page={page} count={q.data?.count || 0} onChange={setPage} />
      </State>
    </>
  );
}
export function Files() {
  const toast = useToast(),
    a = useAuth(),
    [bucket, setBucket] = useState("news"),
    [prefix, setPrefix] = useState(""),
    [url, setUrl] = useState("");
  const q = useData(async () => {
    const { data, error } = await requireClient()
      .storage.from(bucket)
      .list(prefix, { limit: 100 });
    if (error) throw error;
    return data;
  }, [bucket, prefix]);
  return (
    <>
      <h1>Медіатека та файли</h1>
      <div className="filters">
        <select
          aria-label="Bucket"
          value={bucket}
          onChange={(e) => {
            setBucket(e.target.value);
            setPrefix("");
          }}
        >
          {[
            "news",
            "events",
            "documents",
            "site-assets",
            "service-documents",
            "application-files",
            "appeal-files",
            "avatars",
          ].map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <input
          aria-label="Шлях папки"
          placeholder="Папка (шлях)"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        />
      </div>
      <p className="muted">
        Приватні файли відображаються лише за серверними правами. Кожна папка
        показує до 100 об’єктів.
      </p>
      {["news", "events", "documents", "site-assets"].includes(bucket) && (
        <FileUpload
          bucket={bucket}
          prefix={prefix || a.session!.user.id}
          kind={["news", "events"].includes(bucket) ? "image" : "file"}
          onUploaded={() => q.reload()}
        />
      )}
      <State loading={q.loading} error={q.error}>
        {q.data?.map((f) => (
          <div className="list-item row" key={f.name}>
            <span>{f.name}</span>
            {!f.id ? (
              <Button
                className="secondary small"
                onClick={() => setPrefix((prefix ? prefix + "/" : "") + f.name)}
              >
                Відкрити папку
              </Button>
            ) : (
              <div className="actions">
                <FileLink
                  bucket={bucket}
                  path={(prefix ? prefix + "/" : "") + f.name}
                />
                <Button
                  className="secondary small"
                  onClick={async () => {
                    try {
                      const u = await fileUrl(
                        bucket,
                        (prefix ? prefix + "/" : "") + f.name,
                      );
                      setUrl(u);
                    } catch (e) {
                      toast(errorText(e), "error");
                    }
                  }}
                >
                  Посилання
                </Button>
                <Button
                  className="secondary small"
                  onClick={async () => {
                    if (
                      !confirm(
                        "Видалити файл? Переконайтеся, що його не використовує опублікований матеріал.",
                      )
                    )
                      return;
                    try {
                      await deleteObject(
                        bucket,
                        (prefix ? prefix + "/" : "") + f.name,
                      );
                      q.reload();
                    } catch (e) {
                      toast(errorText(e), "error");
                    }
                  }}
                >
                  Видалити
                </Button>
              </div>
            )}
          </div>
        ))}
      </State>
      {url && (
        <label>
          Посилання (приватне діє 5 хвилин)
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
      )}
    </>
  );
}

export function DisplayAdmin() {
  const auth = useAuth(),
    { settings, reload } = useSettings(),
    toast = useToast(),
    [value, setValue] = useState(settings.display || {}),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setValue(settings.display || {});
  }, [JSON.stringify(settings.display), dirty]);
  if (!auth.roles.some((r) => ["admin", "super_admin"].includes(r)))
    return <Empty text="Доступ обмежено" />;
  return (
    <>
      <h1>Міське інформаційне табло</h1>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const existing = await list("site_settings", {
              eq: { key: "display" },
              size: 1,
            });
            await save("site_settings", {
              ...(existing.rows[0] ? { id: existing.rows[0].id } : {}),
              key: "display",
              value,
            });
            reload();
            toast("Налаштування табло збережено");
          } catch (err) {
            toast(errorText(err), "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <DisplaySettings
          value={value}
          onChange={(v) => {
            setDirty(true);
            setValue(v);
          }}
        />
        <Button busy={busy}>Зберегти табло</Button>
      </form>
    </>
  );
}
