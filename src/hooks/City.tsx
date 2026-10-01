import { createContext, useContext, useEffect, useRef, useState } from "react";
import { list, errorText } from "../services/data";
import type { Row } from "../config/types";
import { activeCity, alertState } from "../utils/city";
interface Feed {
  cache?: Row;
  city: Row[];
  announcements: Row[];
  now: number;
  loading: boolean;
  errors: { alerts: string; city: string; announcements: string };
  checked: { alerts?: number; city?: number; announcements?: number };
  reload: () => void;
  air: "active" | "inactive" | "unknown";
}
const Context = createContext<Feed>({
  city: [],
  announcements: [],
  now: Date.now(),
  loading: true,
  errors: { alerts: "", city: "", announcements: "" },
  checked: {},
  reload: () => {},
  air: "unknown",
});
export const useCity = () => useContext(Context);
export function CityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
      cache?: Row;
      city: Row[];
      announcements: Row[];
      loading: boolean;
      errors: Feed["errors"];
      checked: Feed["checked"];
    }>({
      city: [],
      announcements: [],
      loading: true,
      errors: { alerts: "", city: "", announcements: "" },
      checked: {},
    }),
    [now, setNow] = useState(Date.now());
  const alive = useRef(true),
    busy = useRef(false);
  async function reload() {
    if (busy.current) return;
    busy.current = true;
    const result = await Promise.allSettled([
      list("api_cache", { eq: { key: "alerts" }, size: 1 }),
      list("city_status", { eq: { is_active: true }, size: 100 }),
      list("announcements", { size: 100, order: "priority" }),
    ]);
    if (alive.current)
      setState((old) => {
        const next = {
          ...old,
          loading: false,
          errors: { ...old.errors },
          checked: { ...old.checked },
        };
        (["alerts", "city", "announcements"] as const).forEach((key, i) => {
          const r = result[i];
          if (r.status === "fulfilled") {
            next.errors[key] = "";
            next.checked[key] = Date.now();
            if (key === "alerts") next.cache = r.value.rows[0];
            else next[key] = r.value.rows;
          } else next.errors[key] = errorText(r.reason);
        });
        return next;
      });
    busy.current = false;
  }
  useEffect(() => {
    alive.current = true;
    void reload();
    const poll = setInterval(() => void reload(), 30000),
      clock = setInterval(() => setNow(Date.now()), 1000);
    const online = () => void reload();
    window.addEventListener("online", online);
    return () => {
      alive.current = false;
      clearInterval(poll);
      clearInterval(clock);
      window.removeEventListener("online", online);
    };
  }, []);
  const announcements = state.announcements
    .filter(
      (r) =>
        r.active &&
        (!r.start_at || Date.parse(r.start_at) <= now) &&
        (!r.end_at || Date.parse(r.end_at) > now),
    )
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  return (
    <Context.Provider
      value={{
        ...state,
        city: activeCity(state.city, now),
        announcements,
        now,
        reload,
        air: alertState(state.cache, now, !!state.errors.alerts),
      }}
    >
      {children}
    </Context.Provider>
  );
}
