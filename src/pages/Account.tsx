import { ActivityTimeline, VerificationStatus } from "../components/V2";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/Auth";
import { useData } from "../hooks/useData";
import {
  list,
  save,
  updateRow,
  remove,
  rpc,
  errorText,
} from "../services/data";
import { requireClient, siteUrl } from "../services/client";
import { deleteObject } from "../services/files";
import {
  Badge,
  Button,
  Card,
  Empty,
  FileLink,
  FileUpload,
  Media,
  Modal,
  Pagination,
  State,
  useToast,
} from "../components/UI";
import { datetime } from "../config/types";
import type { Row } from "../config/types";
export default function Account() {
  const { section } = useParams();
  if (section === "activity") return <ActivityTimeline />;
  return <AccountContent />;
}
function AccountContent() {
  const { section } = useParams(),
    auth = useAuth(),
    toast = useToast(),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<Row | null>(null),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [notificationType, setNotificationType] = useState("");
  const name = section || "overview";
  const q = useData<{
    rows: Row[];
    count: number;
    notes?: Row[];
    services?: Row[];
  }>(async () => {
    if (name === "overview") {
      const [apps, notes, services] = await Promise.all([
        list("applications", {
          size: 100,
          eq: { user_id: auth.session!.user.id },
        }),
        list("notifications", { size: 5 }),
        list("services", { size: 3, visible: true }),
      ]);
      return {
        rows: apps.rows,
        count: apps.count,
        notes: notes.rows,
        services: services.rows,
      };
    }
    if (name === "profile")
      return { rows: auth.profile ? [auth.profile] : [], count: 1 };
    if (name === "security")
      return list("account_deletion_requests", {
        size: 5,
        eq: { user_id: auth.session!.user.id },
      });
    if (name === "saved") {
      const [saved, services] = await Promise.all([
        list("saved_services", { page, size: 12 }),
        list("services", { size: 1000, visible: true }),
      ]);
      return {
        rows: saved.rows.map((s) => ({
          ...s,
          service: services.rows.find((r) => r.id === s.service_id),
        })),
        count: saved.count,
      };
    }
    return list(
      name === "addresses"
        ? "user_addresses"
        : name === "documents"
          ? "user_documents"
          : name === "appeals"
            ? "appeals"
            : name === "notifications"
              ? "notifications"
              : "applications",
      {
        page,
        eq: {
          user_id: auth.session!.user.id,
          ...(name === "drafts" ? { status: "draft" } : {}),
          ...(name === "notifications" && notificationType
            ? { type: notificationType }
            : {}),
        },
      },
    );
  }, [name, page, notificationType, auth.profile?.updated_at]);
  const headings: Record<string, string> = {
    overview: "Ваш кабінет",
    applications: "Мої заяви",
    drafts: "Чернетки",
    appeals: "Мої звернення",
    documents: "Мої документи",
    saved: "Збережені послуги",
    notifications: "Сповіщення",
    addresses: "Мої адреси",
    profile: "Профіль",
    security: "Безпека",
  };
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    try {
      await fn();
      q.reload();
      toast("Збережено");
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">Особистий простір</p>
      <div className="section-heading">
        <h1>{headings[name]}</h1>
        {name === "addresses" && (
          <Button
            onClick={() =>
              setModal({
                id: "",
                name: "Дім",
                city: "Черкаси",
                street: "",
                building: "",
                apartment: "",
                note: "",
              })
            }
          >
            Додати адресу
          </Button>
        )}
        {name === "notifications" && (
          <Button
            className="secondary"
            onClick={() => void run(() => rpc("set_notification_read"))}
          >
            Прочитати всі
          </Button>
        )}
      </div>
      {name === "notifications" && (
        <div className="filters">
          <select
            aria-label="Тип сповіщень"
            value={notificationType}
            onChange={(e) => {
              setNotificationType(e.target.value);
              setPage(1);
            }}
          >
            {[
              ["", "Усі"],
              ["application", "Заявки"],
              ["appeal", "Звернення"],
              ["service", "Послуги"],
              ["system", "Системні"],
              ["city", "Міські"],
              ["important", "Важливі"],
              ["emergency", "Термінові"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
      {name === "profile" && <VerificationStatus />}
      <State loading={q.loading} error={q.error}>
        {name === "overview" ? (
          <>
            <h2>Добрий день, {auth.profile?.first_name || "мешканцю"}!</h2>
            <div className="stats">
              {[
                [
                  "Активні заяви",
                  q.data?.rows.filter(
                    (r) =>
                      !["draft", "completed", "rejected", "cancelled"].includes(
                        r.status,
                      ),
                  ).length,
                ],
                [
                  "Завершені",
                  q.data?.rows.filter((r) => r.status === "completed").length,
                ],
                [
                  "Чернетки",
                  q.data?.rows.filter((r) => r.status === "draft").length,
                ],
                [
                  "Непрочитані",
                  ((q.data as any)?.notes || []).filter((r: Row) => !r.read_at)
                    .length,
                ],
              ].map(([label, count]) => (
                <div className="stat" key={String(label)}>
                  <strong>{count || 0}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <h2>Останні заяви</h2>
            <Records
              rows={q.data?.rows.slice(0, 5) || []}
              kind="applications"
            />
            <h2>Останні сповіщення</h2>
            {((q.data as any)?.notes || []).map((n: Row) => (
              <Link
                className="list-item"
                key={n.id}
                to={n.link || "/account/notifications"}
              >
                <h3>{n.title}</h3>
                <p>{n.message}</p>
              </Link>
            ))}
            <h2>Рекомендовані послуги</h2>
            <div className="grid three">
              {((q.data as any)?.services || []).map((r: Row) => (
                <Card key={r.id} row={r} to={"/services/" + r.slug} />
              ))}
            </div>
          </>
        ) : name === "profile" ? (
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await updateRow("profiles", {
                  id: auth.profile!.id,
                  first_name: f.get("first_name"),
                  last_name: f.get("last_name"),
                  middle_name: f.get("middle_name"),
                  phone: f.get("phone"),
                  birth_date: f.get("birth_date") || null,
                });
                await auth.refresh();
              });
            }}
          >
            <Media
              bucket="avatars"
              path={auth.profile?.avatar_path}
              alt="Ваш аватар"
            />
            <FileUpload
              bucket="avatars"
              prefix={auth.session!.user.id}
              kind="image"
              onUploaded={async (path) => {
                await updateRow("profiles", {
                  id: auth.profile!.id,
                  avatar_path: path,
                });
                await auth.refresh();
              }}
            />
            <div className="grid two">
              {[
                ["first_name", "Ім’я"],
                ["last_name", "Прізвище"],
                ["middle_name", "По батькові"],
                ["phone", "Телефон"],
                ["birth_date", "Дата народження"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type={
                      key === "birth_date"
                        ? "date"
                        : key === "phone"
                          ? "tel"
                          : "text"
                    }
                    name={key}
                    defaultValue={auth.profile?.[key] || ""}
                  />
                </label>
              ))}
            </div>
            <p>Email: {auth.profile?.email}</p>
            <Button busy={busy}>Зберегти профіль</Button>
          </form>
        ) : name === "security" ? (
          <>
            <form
              className="panel"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const { error } = await requireClient().auth.updateUser({
                    password,
                  });
                  if (error) throw error;
                  setPassword("");
                });
              }}
            >
              <h2>Зміна пароля</h2>
              <label>
                Новий пароль
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <Button busy={busy}>Змінити пароль</Button>
            </form>
            <form
              className="panel"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const { error } = await requireClient().auth.updateUser(
                    { email },
                    { emailRedirectTo: siteUrl() + "auth/verify" },
                  );
                  if (error) throw error;
                  toast("Підтвердьте зміну email за листом");
                });
              }}
            >
              <h2>Зміна email</h2>
              <label>
                Новий email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <Button busy={busy}>Надіслати підтвердження</Button>
            </form>
            <div className="panel">
              <h2>Видалення акаунта</h2>
              <p>
                Адміністратор опрацює запит і видалить акаунт та приватні файли
                за затвердженою політикою зберігання.
              </p>
              <Button
                className="secondary"
                busy={busy}
                disabled={
                  !!q.data?.rows.some((r) =>
                    ["pending", "processing"].includes(r.status),
                  )
                }
                onClick={() => {
                  if (confirm("Надіслати запит на видалення акаунта?"))
                    void run(() =>
                      save("account_deletion_requests", {
                        user_id: auth.session!.user.id,
                      }),
                    );
                }}
              >
                Запросити видалення
              </Button>
              <Button className="secondary" onClick={() => void auth.logout()}>
                Вийти з акаунта
              </Button>
            </div>
          </>
        ) : name === "notifications" ? (
          <>
            {q.data?.rows.map((n) => (
              <div
                className={"panel " + (!n.read_at ? "unread" : "")}
                key={n.id}
              >
                <div className="section-heading">
                  <h3>{n.title}</h3>
                  <small>{datetime(n.created_at)}</small>
                </div>
                <p>{n.message}</p>
                {n.link?.startsWith("/") && !n.link.startsWith("//") && (
                  <Link to={n.link}>Відкрити</Link>
                )}
                <Button
                  className="secondary small"
                  onClick={() =>
                    void run(() =>
                      rpc("set_notification_read", {
                        p_id: n.id,
                        p_read: !n.read_at,
                      }),
                    )
                  }
                >
                  {n.read_at ? "Позначити непрочитаним" : "Прочитано"}
                </Button>
              </div>
            ))}
            {!q.data?.count && <Empty text="Сповіщень ще немає" />}
          </>
        ) : name === "addresses" ? (
          <div className="grid two">
            {q.data?.rows.map((r) => (
              <div className="panel" key={r.id}>
                <h3>{r.name}</h3>
                <p>
                  {r.city}, {r.street}, {r.building}
                  {r.apartment ? ", кв. " + r.apartment : ""}
                </p>
                <p>{r.note}</p>
                <Button className="secondary small" onClick={() => setModal(r)}>
                  Редагувати
                </Button>
                <Button
                  className="secondary small"
                  onClick={() => {
                    if (confirm("Видалити адресу?"))
                      void run(() => remove("user_addresses", r.id));
                  }}
                >
                  Видалити
                </Button>
              </div>
            ))}
            {!q.data?.count && <Empty text="Адреси ще не додано" />}
          </div>
        ) : name === "documents" ? (
          <>
            <FileUpload
              bucket="service-documents"
              prefix={"personal/" + auth.session!.user.id}
              onUploaded={async (path, file) => {
                await save("user_documents", {
                  user_id: auth.session!.user.id,
                  path,
                  name: file.name,
                  mime_type: file.type,
                  size_bytes: file.size,
                });
                q.reload();
              }}
            />
            {q.data?.rows.map((r) => (
              <div className="panel row" key={r.id}>
                <FileLink
                  bucket="service-documents"
                  path={r.path}
                  name={r.name}
                />
                <Button
                  className="secondary small"
                  onClick={() => {
                    if (confirm("Видалити документ?"))
                      void run(async () => {
                        await remove("user_documents", r.id);
                        await deleteObject("service-documents", r.path);
                      });
                  }}
                >
                  Видалити
                </Button>
              </div>
            ))}
          </>
        ) : name === "saved" ? (
          <div className="grid three">
            {q.data?.rows.map((r) =>
              r.service ? (
                <div key={r.id}>
                  <Card row={r.service} to={"/services/" + r.service.slug} />
                  <Button
                    className="secondary small"
                    onClick={() =>
                      void run(() => remove("saved_services", r.id))
                    }
                  >
                    Прибрати зі збережених
                  </Button>
                </div>
              ) : (
                <p key={r.id}>Послугу прибрано з публічного каталогу.</p>
              ),
            )}
            {!q.data?.count && (
              <Empty text="Збережених послуг ще немає" to="/services" />
            )}
          </div>
        ) : (
          <Records
            rows={q.data?.rows || []}
            kind={name === "appeals" ? "appeals" : "applications"}
          />
        )}
        <Pagination page={page} count={q.data?.count || 0} onChange={setPage} />
      </State>
      {modal && (
        <Modal
          title={modal.id ? "Редагувати адресу" : "Нова адреса"}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const row = { ...modal, user_id: auth.session!.user.id };
                if (!row.id) delete (row as Partial<Row>).id;
                await save("user_addresses", row);
                setModal(null);
              });
            }}
          >
            {[
              ["name", "Назва"],
              ["city", "Місто"],
              ["street", "Вулиця"],
              ["building", "Будинок"],
              ["apartment", "Квартира"],
              ["note", "Примітка"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={modal[key] || ""}
                  required={["name", "city", "street", "building"].includes(
                    key,
                  )}
                  onChange={(e) =>
                    setModal({ ...modal, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <Button busy={busy}>Зберегти</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Records({ rows, kind }: { rows: Row[]; kind: string }) {
  return rows.length ? (
    <div className="record-list">
      {rows.map((r) => (
        <Link
          key={r.id}
          className="list-item row"
          to={"/account/" + kind + "/" + r.id}
        >
          <div>
            <h3>
              {r.number || "Чернетка"}
              {r.title ? " · " + r.title : ""}
            </h3>
            <small>{datetime(r.created_at)}</small>
          </div>
          <Badge value={r.status} />
        </Link>
      ))}
    </div>
  ) : (
    <Empty
      text="У вас ще немає записів"
      to={kind === "appeals" ? "/appeals" : "/services"}
      label={kind === "appeals" ? "Створити звернення" : "Перейти до послуг"}
    />
  );
}
