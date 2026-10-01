import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSettings } from "../hooks/Settings";
import { useData } from "../hooks/useData";
import { list, rpc, errorText } from "../services/data";
import { siteUrl } from "../services/client";
import { datetime, type Row } from "../config/types";
import {
  Button,
  Empty,
  Modal,
  Pagination,
  State,
  useToast,
} from "../components/UI";
import {
  AnnouncementContent,
  APP_VERSION,
  PublicStatus,
  QR,
  useCityFeed,
} from "../components/V2";
import { CityNow } from "./PublicPages";
import { reveal } from "../config/motion";
export function StatusPage() {
  const { token } = useParams();
  return <PublicStatus token={token || ""} />;
}
export function RevisionHistory({
  table,
  id,
  onRestored,
}: {
  table: string;
  id: string;
  onRestored: () => void;
}) {
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false);
  const toast = useToast();
  const q = useData(
    () =>
      list("content_revisions", {
        eq: { entity_type: table, entity_id: id },
        order: "version",
        page,
      }),
    [table, id, page],
  );
  return (
    <>
      <State loading={q.loading} error={q.error}>
        {q.data?.rows.map((r, i) => {
          const previous = q.data?.rows[i + 1];
          return (
            <div className="panel" key={r.id}>
              <h3>Версія {r.version}</h3>
              <small>
                {datetime(r.created_at)} · {r.changed_by || "Початкова версія"}
              </small>
              <p>Змінено: {r.changed_fields.join(", ") || "Без зміни полів"}</p>
              <details>
                <summary>Порівняти зміни</summary>
                {r.changed_fields.map((field: string) => (
                  <div className="revision-diff" key={field}>
                    <strong>{field}</strong>
                    <div>
                      <small>Було</small>
                      <pre>
                        {previous
                          ? JSON.stringify(previous.snapshot[field], null, 2)
                          : "Попередня версія на іншій сторінці або відсутня"}
                      </pre>
                    </div>
                    <div>
                      <small>Стало</small>
                      <pre>{JSON.stringify(r.snapshot[field], null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </details>
              <Button
                className="secondary small"
                busy={busy}
                onClick={async () => {
                  if (
                    !confirm(
                      "Відновити цю версію? Поточний стан залишиться в історії.",
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await rpc("restore_content_revision", { p_revision: r.id });
                    q.reload();
                    onRestored();
                    toast("Версію відновлено");
                  } catch (e) {
                    toast(errorText(e), "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Відновити версію
              </Button>
            </div>
          );
        })}
        {!q.data?.count && <Empty text="Історія змін порожня" />}
        <Pagination page={page} count={q.data?.count || 0} onChange={setPage} />
      </State>
    </>
  );
}
export { default as Display } from "./LiveDisplay";
