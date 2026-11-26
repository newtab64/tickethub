import { UserStatus } from "@tickethub/shared";
import { identityErrors } from "./identity.errors";
import type { User } from "./user.models";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** Tai khoan dang bi khoa tam thoi do nhap sai mat khau. */
export function assertNotTemporarilyLocked(user: User, now: Date): void {
  if (user.lockedUntil && user.lockedUntil > now) {
    const minutes = Math.ceil(
      (user.lockedUntil.getTime() - now.getTime()) / (60 * 1000),
    );
    throw identityErrors.accountLockedFor(minutes);
  }
}

export interface FailedAttemptOutcome {
  attempts: number;
  lockedUntil: Date | null;
}

/** Tinh trang thai sau mot lan nhap sai: khoa 15 phut khi dat 5 lan. */
export function registerFailedAttempt(
  user: User,
  now: Date,
): FailedAttemptOutcome {
  const attempts = user.failedLoginAttempts + 1;
  const lockedUntil =
    attempts >= MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + LOCK_DURATION_MS)
      : null;
  return { attempts, lockedUntil };
}

export function failureError(outcome: FailedAttemptOutcome) {
  return outcome.attempts >= MAX_FAILED_ATTEMPTS
    ? identityErrors.accountJustLocked()
    : identityErrors.invalidCredentialsWithRemaining(
        MAX_FAILED_ATTEMPTS - outcome.attempts,
      );
}

/** Chi tai khoan da kich hoat email va khong bi quan tri vien khoa moi dang nhap duoc. */
export function assertStatusAllowsLogin(user: User): void {
  if (user.status === UserStatus.PENDING_EMAIL) {
    throw identityErrors.emailNotVerified();
  }
  if (user.status === UserStatus.LOCKED) {
    throw identityErrors.accountSuspended();
  }
}

export function hasLoginFailureState(user: User): boolean {
  return user.failedLoginAttempts > 0 || user.lockedUntil !== null;
}
