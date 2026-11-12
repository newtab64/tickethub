import type { UserRole, UserStatus } from "@tickethub/shared";

export interface User {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface NewUser {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | undefined;
  role: UserRole;
}

export interface RegisteredUser {
  userId: string;
  email: string;
  status: UserStatus;
  verificationToken: string;
  message: string;
}

export interface AuthenticatedProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}
