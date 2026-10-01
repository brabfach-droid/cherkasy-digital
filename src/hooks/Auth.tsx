import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../services/client";
import { list } from "../services/data";
import type { Profile } from "../config/types";
const Context = createContext<{
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  session: null,
  profile: null,
  roles: [],
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [roles, setRoles] = useState<string[]>([]),
    [loading, setLoading] = useState(true);
  async function refresh() {
    if (!supabase) return;
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    setSession(s);
    if (s) {
      const [p, r] = await Promise.all([
        list("profiles", { eq: { user_id: s.user.id }, size: 1 }),
        list("user_roles", { eq: { user_id: s.user.id }, size: 20 }),
      ]);
      setProfile((p.rows[0] as Profile) || null);
      setRoles(r.rows.map((x) => x.role_name));
    } else {
      setProfile(null);
      setRoles([]);
    }
  }
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    let generation = 0;
    let resolvedUser: string | null | undefined;
    const c = supabase;
    async function sync(s: Session | null) {
      const g = ++generation;
      if (!active) return;
      setSession(s);
      if (resolvedUser === undefined || resolvedUser !== (s?.user.id || null))
        setLoading(true);
      if (!s) {
        setProfile(null);
        setRoles([]);
        resolvedUser = null;
        setLoading(false);
        return;
      }
      try {
        const [p, r] = await Promise.all([
          list("profiles", { eq: { user_id: s.user.id }, size: 1 }),
          list("user_roles", { eq: { user_id: s.user.id }, size: 20 }),
        ]);
        if (active && g === generation) {
          setProfile((p.rows[0] as Profile) || null);
          setRoles(r.rows.map((x) => x.role_name));
          resolvedUser = s.user.id;
        }
      } catch {
        if (active && g === generation) {
          setProfile(null);
          setRoles([]);
        }
      } finally {
        if (active && g === generation) setLoading(false);
      }
    }
    c.auth.getSession().then(({ data }) => sync(data.session));
    const {
      data: { subscription },
    } = c.auth.onAuthStateChange((_e, s) => {
      setTimeout(() => {
        void sync(s);
      }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        session,
        profile,
        roles,
        loading,
        refresh,
        logout: async () => {
          await supabase?.auth.signOut();
          setSession(null);
          setProfile(null);
          setRoles([]);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
