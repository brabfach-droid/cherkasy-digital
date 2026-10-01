import {ApplicationProgress,Deadline,DocumentPicker,LinkedDocuments,priorities} from "../components/V3";
import {Modal} from "../components/UI";
import { ApplicationQR } from "../components/V2";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../hooks/Auth";
import { useData } from "../hooks/useData";
import { get, list, save, rpc, errorText } from "../services/data";
import { deleteObject } from "../services/files";
import {
  Badge,
  Button,
  Empty,
  FileLink,
  FileUpload,
  State,
  useToast,
} from "../components/UI";
import { DynamicFields } from "../components/DynamicForm";
import { validateAnswers } from "../utils/validation";
import type { FormField, Row } from "../config/types";
import { datetime, statuses } from "../config/types";
export function Apply() {
  const { slug } = useParams(),
    [params] = useSearchParams(),
    a = useAuth(),
    toast = useToast(),
    navigate = useNavigate();
  const q = useData(async () => {
    const service = await get("services", "slug", slug!);
    const form = await get("service_forms", "service_id", service.id);
    const fields = await list("service_form_fields", {
      eq: { form_id: form.id },
      size: 100,
      order: "sort_order",
      ascending: true,
    });
    return { service, form, fields: fields.rows as FormField[] };
  }, [slug]);
  const [draftId, setDraftId] = useState(""),
    idRef = useRef(""),
    [data, setData] = useState<Record<string, any>>({}),
    dataRef = useRef<Record<string, any>>({}),
    [step, setStep] = useState(1),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [initialized, setInitialized] = useState(false),
    [initError, setInitError] = useState(""),
    [lastSaved, setLastSaved] = useState(""), [saveState,setSaveState]=useState("");
  const queue = useRef<Promise<any>>(Promise.resolve());
  const files = useData(
    () =>
      draftId
        ? list("application_files", {
            eq: { application_id: draftId },
            size: 100,
          })
        : Promise.resolve({ rows: [], count: 0 }),
    [draftId],
  );
  const linked=useData(()=>draftId?rpc("application_linked_documents",{p_id:draftId}):Promise.resolve([]),[draftId]);
  useEffect(() => {
    if (!q.data) return;
    let active = true;
    async function init() {
      try {
        if (params.get("draft")) {
          const draft = await get("applications", "id", params.get("draft")!);
          if (
            draft.service_id !== q.data!.service.id ||
            draft.status !== "draft"
          )
            throw new Error("Ця чернетка недоступна");
          if (active) {
            idRef.current = draft.id;
            setDraftId(draft.id);
            dataRef.current = draft.data;
            setData(draft.data);
          }
        } else {
          const id = await rpc("save_draft", {
            p_service: q.data!.service.id,
            p_data: {},
          });
          if (active) {
            idRef.current = id;
            setDraftId(id);
          }
        }
        if (active) setInitialized(true);
      } catch (e) {
        if (active) setInitError(errorText(e));
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [q.data?.service.id]);
  function persist() {
    setSaveState("Зберігаємо…");
    const payload = structuredClone(dataRef.current);
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        const id = await rpc("save_draft", {
          p_service: q.data!.service.id,
          p_data: payload,
          p_id: idRef.current,
        });
        idRef.current = id;
        setDraftId(id);
        setLastSaved(
          new Intl.DateTimeFormat("uk-UA", { timeStyle: "short" }).format(
            new Date(),
          ),
        );
        setSaveState("Збережено");
        return id;
      });
    return queue.current;
  }
  useEffect(() => {
    if (!initialized) return;
    const t = setTimeout(() => {
      void persist().catch((e) => setSaveState("Не вдалося зберегти: "+errorText(e)));
    }, 1000);
    return () => clearTimeout(t);
  }, [data, initialized]);
  const fields = q.data?.fields || [];
  async function next() {
    const errors = validateAnswers(
      fields.filter((f) =>
        step === 1 ? !["file", "pdf", "image"].includes(f.type) : true,
      ),
      data,
      [...(files.data?.rows || []),...(linked.data||[])],
    );
    if (Object.keys(errors).length) {
      setErrors(errors);
      toast("Перевірте обов’язкові поля", "error");
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await persist();
      setStep(step + 1);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page narrow">
      <Link to={"/services/" + slug}>← До послуги</Link>
      <h1>{q.data?.service.title || "Подання заяви"}</h1>
      <State
        loading={q.loading || (!initialized && !initError && !q.error)}
        error={q.error || initError}
      >
        <div className="steps">
          {["Дані", "Документи", "Перевірка", "Підтвердження"].map((s, i) => (
            <span key={s} className={step === i + 1 ? "active" : ""}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
        <div className="panel">
          {!!Object.keys(errors).length&&<div className="error-summary" role="alert"><strong>Перевірте {Object.keys(errors).length} поля</strong>{Object.entries(errors).map(([key,value])=><a key={key} href={"#field-"+key} onClick={()=>document.getElementById("field-"+key)?.focus()}>{value}</a>)}</div>}
          {step === 1 && (
            <DynamicFields
              fields={fields}
              data={data}
              errors={errors}
              onChange={(k, v) => {
                const n = { ...dataRef.current, [k]: v };
                dataRef.current = n;
                setData(n);
              }}
            />
          )}
          {step === 2 && (
            <>
              {fields
                .filter((f) => ["file", "pdf", "image"].includes(f.type))
                .map((f) => (
                  <div className="field" key={f.key}>
                    <h3>
                      {f.label}
                      {f.required ? " *" : ""}
                    </h3>
                    <p>{f.help_text}</p>
                    <FileUpload
                      bucket="application-files"
                      prefix={a.session!.user.id + "/" + draftId}
                      kind={f.type}
                      multiple={!!f.validation.multiple}
                      maxFiles={f.validation.maxFiles||10}
                      onUploaded={async (path, file) => {
                        try {
                          await save("application_files", {
                            application_id: draftId,
                            user_id: a.session!.user.id,
                            field_key: f.key,
                            name: file.name,
                            path,
                            mime_type: file.type,
                            size_bytes: file.size,
                          });
                          files.reload();
                        } catch (e) {
                          await deleteObject("application-files", path).catch(
                            () => {},
                          );
                          throw e;
                        }
                      }}
                    />
                    <DocumentPicker application={draftId} field={f.key} kind={f.type} onChange={linked.reload}/>
                    {errors[f.key] && (
                      <p className="field-error">{errors[f.key]}</p>
                    )}
                  </div>
                ))}
              {!fields.some((f) =>
                ["file", "pdf", "image"].includes(f.type),
              ) && <p>Ця послуга не вимагає файлів.</p>}
              <LinkedDocuments application={draftId} editable onChange={linked.reload}/>
              {files.data?.rows.map((f) => (
                <div className="row" key={f.id}>
                  <FileLink
                    bucket="application-files"
                    path={f.path}
                    name={f.name}
                  />
                  <Button
                    className="secondary small"
                    onClick={async () => {
                      try {
                        await import("../services/data").then((m) =>
                          m.remove("application_files", f.id),
                        );
                        await deleteObject("application-files", f.path);
                        files.reload();
                      } catch (e) {
                        toast(errorText(e), "error");
                      }
                    }}
                  >
                    Видалити
                  </Button>
                </div>
              ))}
            </>
          )}
          {step === 3 && (
            <>
              <h2>Перевірте вашу заяву</h2>
              <dl>
                {fields
                  .filter(
                    (f) =>
                      ![
                        "heading",
                        "information",
                        "file",
                        "pdf",
                        "image",
                      ].includes(f.type),
                  )
                  .map((f) => (
                    <div key={f.key}>
                      <dt>{f.label}</dt>
                      <dd>
                        {typeof data[f.key] === "boolean"
                          ? data[f.key]
                            ? "Так"
                            : "Ні"
                          : Array.isArray(data[f.key])
                            ? data[f.key].join(", ")
                            : String(data[f.key] || "—")}
                      </dd>
                    </div>
                  ))}
              </dl>
              <p>Додано файлів: {(files.data?.count || 0)+(linked.data?.length||0)}</p>
            </>
          )}
          {step === 4 && (
            <>
              <h2>Готові надіслати?</h2>
              <p>
                Після надсилання редагування основних відповідей буде
                заблоковано. Статус і повідомлення з’являться у вашому кабінеті.
              </p>
              <label className="check">
                <input type="checkbox" required id="submit-confirm" />
                Підтверджую правильність даних
              </label>
            </>
          )}
          <div className="actions">
            {step > 1 && (
              <Button className="secondary" onClick={() => setStep(step - 1)}>
                Назад
              </Button>
            )}
            <Button
              className="secondary"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await persist();
                  toast("Чернетку збережено");
                } catch (e) {
                  toast(errorText(e), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Зберегти чернетку
            </Button>
            {step < 4 ? (
              <Button busy={busy} onClick={() => void next()}>
                Далі
              </Button>
            ) : (
              <Button
                busy={busy}
                onClick={async () => {
                  if (
                    !(
                      document.getElementById(
                        "submit-confirm",
                      ) as HTMLInputElement
                    ).checked
                  ) {
                    toast("Підтвердіть правильність даних", "error");
                    return;
                  }
                  setBusy(true);
                  try {
                    await persist();
                    const n = await rpc("submit_application", {
                      p_id: draftId,
                    });
                    toast("Заяву " + n + " надіслано");
                    navigate("/account/applications/" + draftId);
                  } catch (e) {
                    toast(errorText(e), "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Надіслати заяву
              </Button>
            )}
          </div>
          <small className="muted">
            {saveState|| (lastSaved
              ? "Автозбережено о " + lastSaved
              : "Чернетка створена. Зміни збережуться автоматично.")}
          </small>
        </div>
      </State>
    </div>
  );
}
const transitions: Record<string, string[]> = {
  submitted: ["received", "cancelled"],
  received: ["in_review", "needs_more_info", "rejected", "cancelled"],
  in_review: ["needs_more_info", "approved", "rejected", "cancelled"],
  needs_more_info: ["in_review", "rejected", "cancelled"],
  approved: ["completed", "cancelled"],
};
export function ApplicationDetail(){
 const {id}=useParams(),auth=useAuth(),toast=useToast();const staff=!window.location.pathname.includes("/account/");
 const q=useData(async()=>{const app=await get("applications","id",id!);const [service,files,messages,history,profile,assignees,deps,transfers]=await Promise.all([rpc("application_service",{p_id:id}),list("application_files",{eq:{application_id:id},size:100}),list("application_messages",{eq:{application_id:id},size:100,ascending:true}),list("application_status_history",{eq:{application_id:id},size:100,ascending:true}),get("profiles","user_id",app.user_id),staff?rpc("application_assignees",{p_id:id}):Promise.resolve([]),list("departments",{size:100}),list("application_transfers",{eq:{application_id:id},size:100,ascending:true})]);return {app,service:service[0]||{title:"Послуга",slug:""},files:files.rows,messages:messages.rows,history:history.rows,profile,assignees,deps:deps.rows,transfers:transfers.rows}},[id]);
 const [tab,setTab]=useState("overview"),[message,setMessage]=useState(""),[target,setTarget]=useState(""),[note,setNote]=useState(""),[assignee,setAssignee]=useState(""),[assigneeSearch,setAssigneeSearch]=useState(""),[priority,setPriority]=useState("normal"),[deadline,setDeadline]=useState(""),[busy,setBusy]=useState(false),[transfer,setTransfer]=useState(false),[department,setDepartment]=useState(""),[reason,setReason]=useState(""),[attachmentIds,setAttachmentIds]=useState<string[]>([]);
 const app=q.data?.app;const canProcess=staff&&auth.roles.some(r=>["super_admin","admin","department_admin","operator"].includes(r));
 useEffect(()=>{setAssignee(app?.assignee_id||"");setTarget(app?.status||"");setPriority(app?.priority||"normal");setDeadline(app?.deadline?new Date(app.deadline).toISOString().slice(0,16):"")},[app?.status,app?.assignee_id,app?.priority,app?.deadline]);
 useEffect(()=>{const t=setInterval(q.reload,30000);return()=>clearInterval(t)},[id]);
 async function run(fn:()=>Promise<any>){setBusy(true);try{await fn();q.reload();toast("Збережено")}catch(e){toast(errorText(e),"error")}finally{setBusy(false)}}
 const tabs=[["overview","Огляд"],["files","Файли"],["chat","Чат"],["history","Історія"],...(staff?[["internal","Внутрішні нотатки"]]:[])];
 return <State loading={q.loading} error={q.error}>{q.data&&<><Link to={staff?"/staff/applications":"/account/applications"}>← Усі заяви</Link><div className="section-heading application-heading"><h1>{app!.number||"Чернетка"}</h1><div><Badge value={app!.status}/><small>{priorities[app!.priority||"normal"]}</small><Deadline value={app!.deadline}/></div></div><p>{q.data.service.title} · {datetime(app!.created_at)}</p>{app!.status==="needs_more_info"&&!staff&&<div className="alert" role="status"><strong>Потрібна ваша відповідь</strong><p>Перегляньте повідомлення оператора та додайте необхідні документи.</p><Button onClick={()=>setTab("chat")}>Відкрити чат</Button></div>}<ApplicationProgress status={app!.status}/>{app!.status==="draft"&&!staff&&<Link className="button" to={"/services/"+q.data.service.slug+"/apply?draft="+id}>Продовжити заповнення</Link>}{app!.status!=="draft"&&(!staff||auth.roles.some(r=>["admin","super_admin"].includes(r)))&&<ApplicationQR id={app!.id}/>}
 <div className="app-tabs" role="tablist">{tabs.map(([v,l])=><button key={v} role="tab" aria-selected={tab===v} className={tab===v?"active":""} onClick={()=>setTab(v)}>{l}</button>)}</div><div className="detail-grid"><div role="tabpanel">
 {tab==="overview"&&<div className="panel"><h2>Дані заяви</h2><p>Заявник: {q.data.profile.first_name} {q.data.profile.last_name} · {q.data.profile.email}</p><dl>{(app!.form_snapshot||[]).filter((f:FormField)=>!["heading","information","file","image","pdf"].includes(f.type)).map((f:FormField)=><div key={f.key}><dt>{f.label}</dt><dd>{Array.isArray(app!.data[f.key])?app!.data[f.key].join(", "):typeof app!.data[f.key]==="boolean"?(app!.data[f.key]?"Так":"Ні"):String(app!.data[f.key]??"—")}</dd></div>)}</dl></div>}
 {tab==="files"&&<div className="panel"><h2>Документи</h2>{q.data.files.map(f=><div className="list-item" key={f.id}><FileLink bucket="application-files" path={f.path} name={f.name}/><small>{datetime(f.created_at)} · {Math.ceil((f.size_bytes||0)/1024)} КБ</small></div>)}<LinkedDocuments application={id!}/>{!q.data.files.length&&<p>Нових завантажень немає. Вибрані власні документи показано вище.</p>}{app!.status==="needs_more_info"&&!staff&&<FileUpload bucket="application-files" prefix={auth.session!.user.id+"/"+id} onUploaded={async(path,file)=>{await save("application_files",{application_id:id,user_id:auth.session!.user.id,path,name:file.name,mime_type:file.type,size_bytes:file.size});q.reload()}}/>}</div>}
 {(tab==="chat"||tab==="internal")&&app!.status!=="draft"&&<div className="panel"><h2>{tab==="internal"?"Внутрішні нотатки — користувач їх не бачить":"Повідомлення користувачу"}</h2>{q.data.messages.filter(m=>!!m.internal===(tab==="internal")).map(m=><div key={m.id} className={"message "+(m.internal?"internal":m.user_id===auth.session?.user.id?"own":"")}><small>{m.internal?"Внутрішня нотатка":m.user_id===app!.user_id?"Користувач":"Працівник"} · {datetime(m.created_at)}</small><p className="pre-wrap">{m.message}</p>{(m.file_ids||[]).map((fid:string)=>{const f=q.data!.files.find(f=>f.id===fid);return f?<FileLink key={fid} bucket="application-files" path={f.path} name={f.name}/>:null})}</div>)}{!q.data.messages.some(m=>!!m.internal===(tab==="internal"))&&<p>Повідомлень ще немає.</p>}{(!staff||canProcess)&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{await save("application_messages",{application_id:id,user_id:auth.session!.user.id,message,internal:tab==="internal",file_ids:tab==="internal"?[]:attachmentIds});setMessage("");setAttachmentIds([])})}}><label>{tab==="internal"?"Текст внутрішньої нотатки":"Повідомлення користувачу / оператору"}<textarea value={message} onChange={e=>setMessage(e.target.value)} required maxLength={10000}/></label>{tab==="chat"&&<><FileUpload bucket="application-files" prefix={auth.session!.user.id+"/"+id} onUploaded={async(path,file)=>{const f=await save("application_files",{application_id:id,user_id:auth.session!.user.id,path,name:file.name,mime_type:file.type,size_bytes:file.size});setAttachmentIds(v=>[...v,f.id]);q.reload()}}/>{attachmentIds.length>0&&<p>Додано вкладень: {attachmentIds.length}</p>}</>}<Button busy={busy}>{tab==="internal"?"Зберегти внутрішню нотатку":"Надіслати повідомлення"}</Button></form>}</div>}
 {tab==="history"&&<div className="panel"><h2>Історія</h2><ol className="timeline">{q.data.history.map(h=><li key={h.id}><b>{statuses[h.new_status]||h.new_status}</b><small>{datetime(h.created_at)}</small><p>{h.note}</p></li>)}{q.data.transfers.map(h=><li key={h.id}><b>Передано: {q.data!.deps.find(d=>d.id===h.old_department)?.name||"Попередній департамент"} → {q.data!.deps.find(d=>d.id===h.new_department)?.name||"Новий департамент"}</b><small>{datetime(h.created_at)}</small><p>{h.reason}</p></li>)}</ol></div>}
 </div><aside><div className="panel"><h3>Відомості</h3><p>{q.data.deps.find(d=>d.id===app!.department_id)?.name||"Департамент не вказано"}</p><small>Оновлено: {datetime(app!.updated_at)}</small><Deadline value={app!.deadline}/></div>{canProcess&&app!.status!=="draft"&&<form className="panel" onSubmit={e=>{e.preventDefault();void run(async()=>{await rpc("change_application",{p_id:id,p_status:target,p_note:note,p_assignee:assignee||null});await rpc("set_application_metadata",{p_id:id,p_priority:priority,p_deadline:deadline?new Date(deadline+"Z").toISOString():null});setNote("")})}}><h2>Опрацювання</h2><label>Статус<select value={target} onChange={e=>setTarget(e.target.value)}>{[app!.status,...(transitions[app!.status]||[])].map(s=><option key={s} value={s}>{statuses[s]}</option>)}</select></label><label>Знайти працівника<input placeholder="Ім’я або прізвище" value={assigneeSearch} onChange={e=>setAssigneeSearch(e.target.value)}/></label><label>Відповідальний<select value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Не призначено</option>{q.data.assignees.filter((s:any)=>s.user_id===assignee||s.name.toLowerCase().includes(assigneeSearch.toLowerCase())).map((s:any)=><option key={s.user_id} value={s.user_id}>{s.name||"Працівник"}</option>)}</select></label><label>Пріоритет<select aria-label="Пріоритет" value={priority} onChange={e=>setPriority(e.target.value)}>{Object.entries(priorities).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Очікуваний термін (UTC)<input type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><label>Повідомлення заявнику<textarea value={note} onChange={e=>setNote(e.target.value)}/></label><Button busy={busy}>Зберегти</Button><Button type="button" className="secondary" onClick={()=>setTransfer(true)}>Передати департаменту</Button></form>}{!staff&&["draft","submitted","received","needs_more_info"].includes(app!.status)&&<Button className="secondary" busy={busy} onClick={()=>{if(confirm("Скасувати цю заяву?"))void run(()=>rpc("cancel_application",{p_id:id}))}}>Скасувати заяву</Button>}</aside></div>
 {transfer&&<Modal title="Передати заяву іншому департаменту" onClose={()=>setTransfer(false)}><p>Зараз: {q.data.deps.find(d=>d.id===app!.department_id)?.name}</p><form onSubmit={e=>{e.preventDefault();void run(async()=>{await rpc("transfer_application",{p_id:id,p_department:department,p_reason:reason});setTransfer(false)})}}><label>Новий департамент<select required value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Виберіть</option>{q.data.deps.filter(d=>d.active&&d.id!==app!.department_id).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Причина<textarea required minLength={3} value={reason} onChange={e=>setReason(e.target.value)}/></label><Button busy={busy}>Підтвердити передачу</Button></form></Modal>}
 </>}</State>
}
export function Appeals() {
  const auth = useAuth(),
    toast = useToast(),
    navigate = useNavigate();
  const q = useData(() => list("appeal_categories", { size: 100 }));
  const [form, setForm] = useState({
      category: "",
      title: "",
      location: "",
      message: "",
    }),
    [busy, setBusy] = useState(false),
    [id, setId] = useState("");
  return (
    <div className="container page narrow">
      <p className="eyebrow">Ваш голос важливий</p>
      <h1>Звернення мешканців</h1>
      <p className="lead">Повідомте про проблему або поставте запитання.</p>
      {!auth.session ? (
        <div className="panel">
          <p>Для надсилання звернення увійдіть у кабінет.</p>
          <Link className="button" to="/auth/login?next=/appeals">
            Увійти
          </Link>
        </div>
      ) : (
        <State loading={q.loading} error={q.error}>
          {id ? (
            <div className="panel">
              <h2>Звернення створено</h2>
              <p>Можете додати фото або файл перед переходом до кабінету.</p>
              <FileUpload
                bucket="appeal-files"
                prefix={auth.session.user.id + "/" + id}
                onUploaded={async (path, file) => {
                  await save("appeal_files", {
                    appeal_id: id,
                    user_id: auth.session!.user.id,
                    path,
                    name: file.name,
                    mime_type: file.type,
                    size_bytes: file.size,
                  });
                }}
              />
              <Button onClick={() => navigate("/account/appeals/" + id)}>
                Переглянути звернення
              </Button>
            </div>
          ) : (
            <form
              className="panel"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const aid = await rpc("create_appeal", {
                    p_category: form.category,
                    p_title: form.title,
                    p_location: form.location,
                    p_message: form.message,
                  });
                  setId(aid);
                  toast("Звернення надіслано");
                } catch (err) {
                  toast(errorText(err), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Категорія
                <select
                  required
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  <option value="">Виберіть категорію</option>
                  {q.data?.rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              {[
                ["title", "Тема"],
                ["location", "Місце"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                    required={key === "title"}
                    minLength={key === "title" ? 3 : undefined}
                  />
                </label>
              ))}
              <label>
                Текст звернення
                <textarea
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  required
                  minLength={10}
                  maxLength={10000}
                />
              </label>
              <Button busy={busy}>Надіслати звернення</Button>
            </form>
          )}
        </State>
      )}
    </div>
  );
}
export function AppealDetail() {
  const { id } = useParams(),
    a = useAuth(),
    toast = useToast();
  const staff = !window.location.pathname.includes("/account/");
  const q = useData(async () => {
    const appeal = await get("appeals", "id", id!);
    const [files, history, deps] = await Promise.all([
      list("appeal_files", { eq: { appeal_id: id }, size: 100 }),
      list("appeal_status_history", {
        eq: { appeal_id: id },
        size: 100,
        ascending: true,
      }),
      list("departments", { size: 100 }),
    ]);
    return {
      appeal,
      files: files.rows,
      history: history.rows,
      deps: deps.rows,
    };
  }, [id]);
  const [status, setStatus] = useState(""),
    [response, setResponse] = useState(""),
    [department, setDepartment] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.data) {
      setStatus(q.data.appeal.status);
      setResponse(q.data.appeal.response || "");
      setDepartment(q.data.appeal.department_id || "");
    }
  }, [q.data?.appeal.updated_at]);
  const canWrite =
    staff &&
    a.roles.some((r) =>
      ["super_admin", "admin", "department_admin", "appeals_operator"].includes(
        r,
      ),
    );
  return (
    <State loading={q.loading} error={q.error}>
      {q.data && (
        <>
          <h1>{q.data.appeal.number}</h1>
          <Badge value={q.data.appeal.status} />
          {(!staff||a.roles.some(r=>["admin","super_admin"].includes(r)))&&<ApplicationQR id={q.data.appeal.id} kind="appeal"/>}
          <div className="detail-grid">
            <div className="panel">
              <h2>{q.data.appeal.title}</h2>
              <p>{q.data.appeal.location}</p>
              <p className="pre-wrap">{q.data.appeal.message}</p>
              {q.data.files.map((f) => (
                <FileLink
                  key={f.id}
                  bucket="appeal-files"
                  path={f.path}
                  name={f.name}
                />
              ))}
              {q.data.appeal.response && (
                <div className="alert">
                  <h3>Відповідь</h3>
                  <p>{q.data.appeal.response}</p>
                </div>
              )}
              {canWrite && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      await rpc("change_appeal", {
                        p_id: id,
                        p_status: status,
                        p_response: response,
                        p_department: department || null,
                      });
                      q.reload();
                      toast("Збережено");
                    } catch (err) {
                      toast(errorText(err), "error");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Статус
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {[
                        "new",
                        "received",
                        "forwarded",
                        "in_progress",
                        "completed",
                        "rejected",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {statuses[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {a.roles.some((r) =>
                    ["super_admin", "admin", "department_admin"].includes(r),
                  ) && (
                    <label>
                      Департамент
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                      >
                        {q.data.deps.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Відповідь
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                    />
                  </label>
                  <Button busy={busy}>Зберегти</Button>
                </form>
              )}
            </div>
            <div className="panel">
              <h2>Історія звернення</h2>
              <ol className="timeline">
                {q.data.history.map((h) => (
                  <li key={h.id}>
                    <b>{statuses[h.new_status]}</b>
                    <small>{datetime(h.created_at)}</small>
                    <p>{h.note}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      )}
    </State>
  );
}
