import type { FormField } from "../config/types.ts";
export function validateAnswers(
  fields: FormField[],
  data: Record<string, any>,
  files: { field_key?: string; [key: string]: any }[] = [],
) {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!fieldVisible(f, data)) continue;
    if (["heading", "information"].includes(f.type)) continue;
    const v = data[f.key];
    const empty =
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0);
    if (["file", "image", "pdf"].includes(f.type)) {
      if (f.required && !files.some((x) => x.field_key === f.key))
        errors[f.key] = "Додайте файл";
      continue;
    }
    if (
      f.required &&
      (empty || (["checkbox", "confirmation"].includes(f.type) && v !== true))
    ) {
      errors[f.key] = "Обов’язкове поле";
      continue;
    }
    if (empty) continue;
    if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      errors[f.key] = "Перевірте email";
    if (f.type === "phone" && !/^\+?[\d\s()-]{7,20}$/.test(v))
      errors[f.key] = "Перевірте номер телефону";
    if (f.type === "address" && String(v).trim().length < 8)
      errors[f.key] = "Вкажіть місто, вулицю та номер будинку";
    if (
      f.type === "date" &&
      f.validation.noFuture &&
      String(v) > new Date().toISOString().slice(0, 10)
    )
      errors[f.key] = "Дата не може бути в майбутньому";
    if (f.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) errors[f.key] = "Потрібне число";
      if (f.validation.min !== undefined && n < Number(f.validation.min))
        errors[f.key] = "Менше мінімального значення";
      if (f.validation.max !== undefined && n > Number(f.validation.max))
        errors[f.key] = "Більше максимального значення";
    }
    if (f.validation.minLength && String(v).length < f.validation.minLength)
      errors[f.key] = "Текст закороткий";
    if (f.validation.maxLength && String(v).length > f.validation.maxLength)
      errors[f.key] = "Текст задовгий";
    if (f.validation.pattern) {
      try {
        if (!new RegExp(f.validation.pattern).test(String(v)))
          errors[f.key] = "Невірний формат";
      } catch {
        errors[f.key] =
          "Некоректне правило поля. Зверніться до адміністратора.";
      }
    }
    if (["select", "radio"].includes(f.type) && !f.options.includes(v))
      errors[f.key] = "Виберіть опцію";
  }
  return errors;
}

export function fieldVisible(f: FormField, data: Record<string, any>) {
  const c = f.validation?.showWhen;
  return !c || !c.field || data[c.field] === c.equals;
}
