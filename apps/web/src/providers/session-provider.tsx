"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { UserRole, UserStatus } from "@tickethub/shared";
import { authApi, type LoginResponseData } from "@/lib/api/auth";
import { getAccessToken } from "@/lib/api/client";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}

export interface SessionContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginResponseData) => void;
  logout: () => Promise<void>;
  refreshSession: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

const AUTH_CHANGE_EVENT = "tickethub:auth-change";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const token = getAccessToken();
      const storedUser = localStorage.getItem("tickethub_user");

      if (token && storedUser) {
        const parsed = JSON.parse(storedUser) as AuthUser;
        setUser(parsed);
      } else if (!token) {
        setUser(null);
        localStorage.removeItem("tickethub_user");
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    syncFromStorage();

    const handleStorageChange = () => {
      syncFromStorage();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(AUTH_CHANGE_EVENT, handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(AUTH_CHANGE_EVENT, handleStorageChange);
    };
  }, [syncFromStorage]);

  const login = useCallback((data: LoginResponseData) => {
    if (data?.user) {
      setUser(data.user);
      if (typeof window !== "undefined") {
        localStorage.setItem("tickethub_user", JSON.stringify(data.user));
        window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("tickethub_user");
        window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
      }
    }
  }, []);

  const refreshSession = useCallback(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  return (
    <SessionContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
