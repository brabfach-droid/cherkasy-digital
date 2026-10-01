export interface EditField {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
  table?: string;
  bucket?: string;
}
export interface Resource {
  table: string;
  title: string;
  fields: EditField[];
  content?: boolean;
}
const publication: EditField[] = [
  {
    key: "status",
    label: "Публікація",
    type: "select",
    options: ["draft", "published", "scheduled", "archived"],
  },
  { key: "published_at", label: "Час публікації", type: "datetime-local" },
  { key: "is_demo", label: "Демонстраційний матеріал", type: "checkbox" },
];
const basic: EditField[] = [
  { key: "title", label: "Назва", required: true },
  { key: "slug", label: "Адреса (slug)", required: true },
  { key: "summary", label: "Короткий опис", type: "textarea" },
  { key: "content", label: "Матеріал", type: "markdown" },
];
const category = (table: string): EditField => ({
  key: "category_id",
  label: "Категорія",
  type: "relation",
  table,
});
export const resources: Record<string, Resource> = {
  services: {
    table: "services",
    title: "Послуги",
    content: true,
    fields: [
      ...basic,
      category("service_categories"),
      {
        key: "department_id",
        label: "Відповідальний департамент",
        type: "relation",
        table: "departments",
      },
      {
        key: "format",
        label: "Формат",
        type: "select",
        options: ["online", "offline", "hybrid"],
      },
      { key: "audience", label: "Для кого (коди через кому)", type: "tags" },
      { key: "duration", label: "Термін" },
      { key: "cost", label: "Вартість" },
      { key: "eligibility", label: "Хто може отримати", type: "markdown" },
      { key: "requirements", label: "Необхідні документи", type: "markdown" },
      { key: "steps", label: "Інструкція", type: "markdown" },
      { key: "result", label: "Результат", type: "markdown" },
      { key: "legal_basis", label: "Підстава", type: "markdown" },
      { key: "contacts", label: "Контакти", type: "textarea" },
      { key: "faq", label: "FAQ послуги [{question, answer}]", type: "json" },
      { key: "available", label: "Доступна", type: "checkbox" },
      { key: "featured", label: "Популярна", type: "checkbox" },
      ...publication,
    ],
  },
  news: {
    table: "news",
    title: "Новини",
    content: true,
    fields: [
      ...basic,
      category("news_categories"),
      { key: "author", label: "Автор" },
      { key: "featured", label: "Головна новина", type: "checkbox" },
      { key: "cover_path", label: "Обкладинка", type: "image", bucket: "news" },
      {
        key: "gallery",
        label: "Галерея (список шляхів)",
        type: "gallery",
        bucket: "news",
      },
      ...publication,
    ],
  },
  documents: {
    table: "documents",
    title: "Документи",
    content: true,
    fields: [
      ...basic.filter((f) => !["summary", "content"].includes(f.key)),
      { key: "description", label: "Опис", type: "textarea" },
      { key: "document_number", label: "Номер" },
      { key: "date", label: "Дата", type: "date" },
      category("document_categories"),
      { key: "tags", label: "Теги через кому", type: "tags" },
      {
        key: "file_path",
        label: "PDF / DOCX",
        type: "file",
        bucket: "documents",
      },
      ...publication,
    ],
  },
  events: {
    table: "events",
    title: "Події",
    content: true,
    fields: [
      ...basic,
      { key: "starts_at", label: "Дата й час", type: "datetime-local" },
      { key: "location", label: "Місце" },
      { key: "category", label: "Категорія" },
      { key: "organizer", label: "Організатор" },
      { key: "registration_url", label: "Посилання реєстрації", type: "url" },
      {
        key: "cover_path",
        label: "Зображення",
        type: "image",
        bucket: "events",
      },
      ...publication,
    ],
  },
  announcements: {
    table: "announcements",
    title: "Оголошення",
    fields: [
      { key: "title", label: "Назва", required: true },
      {
        key: "message",
        label: "Повідомлення",
        type: "textarea",
        required: true,
      },
      { key: "type", label: "Тип" },
      { key: "start_at", label: "Початок", type: "datetime-local" },
      { key: "end_at", label: "Кінець", type: "datetime-local" },
      { key: "priority", label: "Пріоритет", type: "number" },
      {
        key: "placement",
        label: "Відображення",
        type: "select",
        options: ["banner", "modal", "pinned", "global"],
      },
      { key: "active", label: "Активне", type: "checkbox" },
      { key: "dismissible", label: "Дозволити закриття", type: "checkbox" },
      { key: "button_text", label: "Текст кнопки" },
      { key: "button_url", label: "Посилання кнопки", type: "url" },
    ],
  },
  city: {
    table: "city_status",
    title: "Черкаси зараз",
    fields: [
      { key: "title", label: "Заголовок", required: true },
      {
        key: "type",
        label: "Тип",
        type: "select",
        options: [
          "Транспорт",
          "Роботи",
          "Відключення",
          "Аварія",
          "Перекриття",
          "Інше",
        ],
      },
      { key: "status", label: "Стан" },
      {
        key: "severity",
        label: "Важливість",
        type: "select",
        options: ["normal", "info", "warning", "danger", "critical"],
      },
      { key: "description", label: "Опис", type: "textarea" },
      { key: "started_at", label: "Початок", type: "datetime-local" },
      { key: "ended_at", label: "Кінець", type: "datetime-local" },
      { key: "is_active", label: "Активне", type: "checkbox" },
      { key: "source_label", label: "Джерело" },
    ],
  },
  departments: {
    table: "departments",
    title: "Департаменти",
    fields: [
      { key: "name", label: "Назва", required: true },
      { key: "slug", label: "Slug", required: true },
      { key: "description", label: "Опис", type: "textarea" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Телефон" },
      { key: "active", label: "Активний", type: "checkbox" },
    ],
  },
  faqs: {
    table: "faqs",
    title: "Допомога / FAQ",
    fields: [
      { key: "question", label: "Запитання", required: true },
      { key: "answer", label: "Відповідь", type: "markdown", required: true },
      { key: "category", label: "Категорія" },
      { key: "sort_order", label: "Порядок", type: "number" },
      { key: "published", label: "Опубліковано", type: "checkbox" },
      { key: "is_demo", label: "Демо", type: "checkbox" },
    ],
  },
  deletions: {
    table: "account_deletion_requests",
    title: "Запити видалення акаунтів",
    fields: [
      {
        key: "status",
        label: "Стан",
        type: "select",
        options: ["pending", "processing", "completed", "rejected"],
      },
      { key: "note", label: "Службова примітка", type: "textarea" },
    ],
  },
};
for (const [key, table, title] of [
  ["service-categories", "service_categories", "Категорії послуг"],
  ["news-categories", "news_categories", "Категорії новин"],
  ["document-categories", "document_categories", "Категорії документів"],
  ["appeal-categories", "appeal_categories", "Категорії звернень"],
])
  resources[key] = {
    table,
    title,
    fields: [
      { key: "name", label: "Назва", required: true },
      { key: "slug", label: "Slug", required: true },
      { key: "description", label: "Опис", type: "textarea" },
      ...(table === "appeal_categories"
        ? [
            {
              key: "department_id",
              label: "Департамент",
              type: "relation",
              table: "departments",
            },
          ]
        : []),
    ],
  };

resources["important-announcements"] = {
  ...resources.announcements,
  title: "Важливі оголошення",
  fields: resources.announcements.fields
    .filter((f) => f.key !== "placement")
    .map((f) =>
      f.key === "type"
        ? {
            ...f,
            type: "select",
            options: [
              "info",
              "warning",
              "danger",
              "critical",
              "maintenance",
              "service",
            ],
          }
        : f,
    )
    .concat([
      {
        key: "version",
        label: "Версія (збільште, щоб показати повідомлення повторно)",
        type: "number",
      },
    ]),
};
resources.verifications = {
  table: "account_verifications",
  title: "Ручне підтвердження акаунтів",
  fields: [
    { key: "user_id", label: "UUID користувача", required: true },
    {
      key: "kind",
      label: "Що перевірено",
      type: "select",
      options: ["phone", "identity", "address"],
    },
    {
      key: "verified",
      label: "Підтверджено після ручної перевірки",
      type: "checkbox",
    },
  ],
};
