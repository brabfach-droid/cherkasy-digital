import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const configured =
  !!url && !url.includes("YOUR_") && !!key && !key.includes("YOUR_");
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export const requireClient = () => {
  if (!supabase)
    throw new Error(
      "Підключіть Supabase за інструкцією SETUP_FOR_BEGINNER.md.",
    );
  return supabase;
};
export const siteUrl = () =>
  import.meta.env.VITE_SITE_URL ||
  new URL(import.meta.env.BASE_URL, location.origin).href;
