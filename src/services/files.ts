import { requireClient } from "./client";
const allowed: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ico: "image/x-icon",
};
export function validateFile(file: File, kind = "file") {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (
    !allowed[ext] ||
    (file.type &&
      file.type !== allowed[ext] &&
      !(ext === "ico" && file.type === "image/vnd.microsoft.icon"))
  )
    throw new Error("Дозволено PDF, DOCX, JPG, PNG, WEBP; для favicon — ICO.");
  if (kind === "pdf" && ext !== "pdf") throw new Error("Потрібен PDF.");
  if (kind === "image" && !["jpg", "jpeg", "png", "webp"].includes(ext))
    throw new Error("Потрібне зображення JPG, PNG або WEBP.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Файл має бути не більшим за 10 МБ.");
  return ext;
}
export async function upload(
  bucket: string,
  prefix: string,
  file: File,
  onProgress?: (n: number) => void,
  kind = "file",
) {
  const ext = validateFile(file, kind);
  if (
    ["avatars", "site-assets"].includes(bucket) &&
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Для аватара й assets ліміт — 5 МБ.");
  if (ext === "ico" && bucket !== "site-assets") throw new Error("ICO дозволено лише для favicon.");
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const c = requireClient();
  const {
    data: { session },
  } = await c.auth.getSession();
  if (!session) throw new Error("Увійдіть для завантаження.");
  const url =
    import.meta.env.VITE_SUPABASE_URL +
    "/storage/v1/object/" +
    bucket +
    "/" +
    path;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", "Bearer " + session.access_token);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", file.type || allowed[ext]);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status < 300
        ? resolve()
        : reject(
            new Error(
              xhr.status === 413
                ? "Файл завеликий."
                : "Не вдалося завантажити файл. Перевірте тип та права доступу.",
            ),
          );
    xhr.onerror = () =>
      reject(new Error("Помилка мережі під час завантаження."));
    xhr.send(file);
  });
  return path;
}
export async function fileUrl(
  bucket: string,
  path: string,
  download?: string | boolean,
) {
  if (["news", "events", "site-assets"].includes(bucket))
    return requireClient().storage.from(bucket).getPublicUrl(path).data
      .publicUrl;
  const { data, error } = await requireClient()
    .storage.from(bucket)
    .createSignedUrl(path, 300, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
export async function deleteObject(bucket: string, path: string) {
  const { error } = await requireClient().storage.from(bucket).remove([path]);
  if (error) throw error;
}
