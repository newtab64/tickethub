"use client";

import React, { createContext, useContext, useState } from "react";

export type RoleTab = "BUYER" | "ORGANIZER";

interface AuthContextValue {
  roleTab: RoleTab;
  setRoleTab: (role: RoleTab) => void;
  identifier: string;
  setIdentifier: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [roleTab, setRoleTab] = useState<RoleTab>("BUYER");
  const [identifier, setIdentifier] = useState<string>("");

  return (
    <AuthContext.Provider
      value={{ roleTab, setRoleTab, identifier, setIdentifier }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      roleTab: "BUYER" as RoleTab,
      setRoleTab: () => {},
      identifier: "",
      setIdentifier: () => {},
    };
  }
  return context;
}
