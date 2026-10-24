import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { User } from "../api/types";

interface AuthState {
  /** undefined while asking the backend, null when nobody is logged in. */
  user: User | null | undefined;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // AUTH: who is logged in ({ id, email }). undefined = still asking the backend, null = nobody.
  // Set here from getSession, by useAuthSubmit (auth/AuthLayout.tsx) after log in or sign up, and to null by
  // Log out (settings/SettingsPage.tsx). Any screen reads it with useAuth().
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    // BACKEND: asks whether someone is still logged in from last time. Returns the user or null.
    api.getSession().then(setUser);
  }, []);

  // AUTH: what useAuth() hands out. Only changes when `user` does.
  const value = useMemo(() => ({ user, setUser }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  // AUTH: the `user` and `setUser` from AuthProvider above.
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
