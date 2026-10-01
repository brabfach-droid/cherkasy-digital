import { createContext, useContext, useEffect } from "react";
import { list } from "../services/data";
import { useData } from "./useData";
import { configured, requireClient } from "../services/client";
const defaults: Record<string, any> = {
  name: "Черкаси Цифрові",
  hero_title: "Черкаси — місто онлайн",
  hero_description: "Міські послуги, документи та сервіси в одному місці",
  primary_color: "#087F72",
  accent_color: "#13B8A6",
  footer_text: "Демонстраційна платформа міських сервісів",
  homepage_blocks: [],
};
const Context = createContext<{
  settings: Record<string, any>;
  reload: () => void;
}>({ settings: defaults, reload: () => {} });
export const useSettings = () => useContext(Context);
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const q = useData(() => list("site_settings", { size: 100 }));
  const settings = {
    ...defaults,
    ...Object.fromEntries((q.data?.rows || []).map((r) => [r.key, r.value])),
  };
  useEffect(() => {
    if (/^#[0-9a-f]{6}$/i.test(settings.primary_color))
      document.documentElement.style.setProperty(
        "--primary",
        settings.primary_color,
      );
    if (/^#[0-9a-f]{6}$/i.test(settings.accent_color))
      document.documentElement.style.setProperty(
        "--accent",
        settings.accent_color,
      );
    if (configured && settings.favicon_path) {
      const link = document.querySelector(
        'link[rel="icon"]',
      ) as HTMLLinkElement;
      link.href = requireClient()
        .storage.from("site-assets")
        .getPublicUrl(settings.favicon_path).data.publicUrl;
    }
  }, [settings.primary_color, settings.accent_color, settings.favicon_path]);
  return (
    <Context.Provider value={{ settings, reload: q.reload }}>
      {children}
    </Context.Provider>
  );
}
