"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/**
 * The authenticated user's client-visible shape. Mirrors the `select` in
 * `getSessionUser()` (src/lib/auth.ts) and the body returned by GET /api/auth/me.
 * Plain primitives only — serializable across the RSC boundary from the server
 * (app)/layout, which seeds `initialUser` via a direct DB read (no first-paint
 * self-fetch — see eng-review P2).
 */
export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: string;
  credits: number;
  email: string | null;
};

type UserContextValue = {
  user: CurrentUser | null;
  /** Re-reads the live user from /api/auth/me and updates context state.
   *  The CQ-A self-heal: after a 402 (or an admin credit grant out-of-band),
   *  callers await this so the proactive gate reflects server truth. */
  refreshUser: () => Promise<CurrentUser | null>;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({
  user: initialUser,
  children,
}: {
  user: CurrentUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<CurrentUser | null>(initialUser);

  const refreshUser = useCallback(async () => {
    try {
      // GET /api/auth/me returns the auth-family envelope `{ user }` (or
      // `{ user: null }`), matching login/register — see src/app/api/auth/me.
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return null;
      const data: { user: CurrentUser | null } = await res.json();
      setUser(data.user);
      return data.user;
    } catch {
      return null;
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a UserProvider");
  return ctx;
}
