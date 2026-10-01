export type Row = { id: string; [key: string]: any };
export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "address"
  | "file"
  | "image"
  | "pdf"
  | "confirmation"
  | "heading"
  | "information";
export interface FormField {
  id?: string;
  key: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  help_text?: string;
  validation: Record<string, any>;
  options: string[];
  sort_order: number;
}
export interface Profile extends Row {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  blocked: boolean;
}
export const statuses: Record<string, string> = {
  draft: "Чернетка",
  submitted: "Подано",
  received: "Прийнято",
  in_review: "На розгляді",
  needs_more_info: "Потрібна інформація",
  approved: "Схвалено",
  rejected: "Відхилено",
  completed: "Виконано",
  cancelled: "Скасовано",
  new: "Нове",
  forwarded: "Передано",
  in_progress: "У роботі",
  published: "Опубліковано",
  scheduled: "Заплановано",
  archived: "В архіві",
  pending: "Очікує",
  processing: "Опрацьовується",
};
export const roleLabels: Record<string, string> = {
  super_admin: "Головний адміністратор",
  admin: "Адміністратор",
  department_admin: "Керівник департаменту",
  operator: "Оператор заяв",
  editor: "Редактор",
  appeals_operator: "Оператор звернень",
  viewer: "Перегляд",
};
export const date = (v?: string) =>
  v
    ? new Intl.DateTimeFormat("uk-UA", {
        dateStyle: "long",
        timeZone: "Europe/Kyiv",
      }).format(new Date(v))
    : "—";
export const datetime = (v?: string) =>
  v
    ? new Intl.DateTimeFormat("uk-UA", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Kyiv",
      }).format(new Date(v))
    : "—";
