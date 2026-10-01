import { configured, requireClient } from "./client";
import type { Row } from "../config/types";
let demo: Promise<Record<string, Row[]>> | null = null;
export type Query = {
  search?: string;
  searchColumns?: string[];
  eq?: Record<string, any>;
  gte?: Record<string, string>;
  lte?: Record<string, string>;
  page?: number;
  size?: number;
  order?: string;
  ascending?: boolean;
  visible?: boolean;
  contains?: Record<string, any[]>;
};
export async function list(table: string, q: Query = {}) {
  const size = q.size || 12,
    page = q.page || 1;
  if (!configured) {
    demo ??= fetch(`${import.meta.env.BASE_URL}demo.json`).then((r) =>
      r.json(),
    );
    let rows = [...((await demo)[table] || [])];
    if (q.visible)
      rows = rows.filter(
        (r) =>
          ["published", "scheduled"].includes(r.status) &&
          !r.deleted_at &&
          new Date(r.published_at || 0) <= new Date(),
      );
    for (const [k, v] of Object.entries(q.contains || {}))
      rows = rows.filter((r) => v.every((i) => r[k]?.includes(i)));
    for (const [k, v] of Object.entries(q.eq || {}))
      rows = rows.filter((r) => r[k] === v);
    for (const [k, v] of Object.entries(q.gte || {}))
      rows = rows.filter((r) => r[k] && String(r[k]) >= v);
    for (const [k, v] of Object.entries(q.lte || {}))
      rows = rows.filter((r) => r[k] && String(r[k]) <= v);
    if (q.search)
      rows = rows.filter((r) =>
        (q.searchColumns || ["title", "name", "question"]).some((k) =>
          String(r[k] || "")
            .toLowerCase()
            .includes(q.search!.toLowerCase()),
        ),
      );
    rows.sort(
      (a, b) =>
        String(a[q.order || "created_at"] || "").localeCompare(
          String(b[q.order || "created_at"] || ""),
        ) * (q.ascending ? 1 : -1),
    );
    return {
      rows: rows.slice((page - 1) * size, page * size),
      count: rows.length,
    };
  }
  let b = requireClient().from(table).select("*", { count: "exact" });
  if (q.visible)
    b = b
      .in("status", ["published", "scheduled"])
      .lte("published_at", new Date().toISOString())
      .is("deleted_at", null);
  for (const [k, v] of Object.entries(q.contains || {})) b = b.contains(k, v);
  for (const [k, v] of Object.entries(q.eq || {}))
    b = v === null ? b.is(k, null) : b.eq(k, v);
  for (const [k, v] of Object.entries(q.gte || {})) b = b.gte(k, v);
  for (const [k, v] of Object.entries(q.lte || {})) b = b.lte(k, v);
  if (q.search) {
    const term = q.search.replace(/[,%()\\]/g, " ").slice(0, 100);
    b = b.or(
      (q.searchColumns || ["title"])
        .map((k) => `${k}.ilike.%${term}%`)
        .join(","),
    );
  }
  const { data, error, count } = await b
    .order(q.order || "created_at", { ascending: q.ascending || false })
    .range((page - 1) * size, page * size - 1);
  if (error) throw error;
  return { rows: (data || []) as Row[], count: count || 0 };
}
export async function get(table: string, key: string, value: string) {
  const { rows } = await list(table, { eq: { [key]: value }, size: 1 });
  if (!rows[0]) throw new Error("Запис не знайдено або доступ обмежено.");
  return rows[0];
}
export async function save(table: string, row: Partial<Row>) {
  const { data, error } = await requireClient()
    .from(table)
    .upsert(row)
    .select()
    .single();
  if (error) throw error;
  return data as Row;
}
export async function remove(table: string, id: string) {
  const { error } = await requireClient().from(table).delete().eq("id", id);
  if (error) throw error;
}
export async function rpc(name: string, args: Record<string, any> = {}) {
  const { data, error } = await requireClient().rpc(name, args);
  if (error) throw error;
  return data;
}
export function errorText(e: any) {
  const msg = e?.message || "";
  if (msg.includes("Invalid login")) return "Неправильний email або пароль.";
  if (msg.includes("Email not confirmed"))
    return "Підтвердьте email за посиланням у листі.";
  if (msg.includes("rate limit")) return "Забагато спроб. Спробуйте пізніше.";
  if (msg.includes("row-level security") || msg.includes("permission denied"))
    return "У вас немає доступу до цієї дії.";
  if (msg.includes("Failed to fetch"))
    return "Не вдалося з’єднатися із сервером. Перевірте інтернет.";
  if (/[а-яіїєґ]/i.test(msg)) return msg;
  return "Не вдалося виконати дію. Перевірте налаштування та спробуйте знову.";
}
