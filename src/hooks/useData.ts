import { useEffect, useRef, useState } from "react";
import { errorText } from "../services/data";
export function useData<T>(loader: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const resolved = useRef<string | null>(null);
  const key = JSON.stringify(deps);
  useEffect(() => {
    let active = true;
    if (resolved.current !== key) setLoading(true);
    setError("");
    loader()
      .then((v) => {
        if (active) { resolved.current = key; setData(v); }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [...deps, version]);
  return { data, loading, error, reload: () => setVersion((v) => v + 1) };
}
export function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
