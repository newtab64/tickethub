import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserRole, UserStatus } from "@tickethub/shared";
import {
  LOCK_DURATION_MS,
  assertNotTemporarilyLocked,
  assertStatusAllowsLogin,
  failureError,
  hasLoginFailureState,
  registerFailedAttempt,
} from "../src/contexts/identity/domain/login-policy";
import { IdentityDomainError } from "../src/contexts/identity/domain/identity.errors";
import type { User } from "../src/contexts/identity/domain/user.models";

const NOW = new Date("2026-11-11T10:00:00.000Z");

function user(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    email: "a@b.vn",
    phone: null,
    fullName: "A",
    passwordHash: "h",
    role: UserRole.BUYER,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
}

function codeOf(fn: () => void): string {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof IdentityDomainError);
    return err.code;
  }
  return "NONE";
}

describe("Identity login policy", () => {
  it("counts failed attempts and locks for 15 minutes at the 5th", () => {
    const fourth = registerFailedAttempt(user({ failedLoginAttempts: 3 }), NOW);
    assert.equal(fourth.attempts, 4);
    assert.equal(fourth.lockedUntil, null);

    const fifth = registerFailedAttempt(user({ failedLoginAttempts: 4 }), NOW);
    assert.equal(fifth.attempts, 5);
    assert.equal(
      fifth.lockedUntil?.getTime(),
      NOW.getTime() + LOCK_DURATION_MS,
    );
  });

  it("reports remaining attempts, then an account lock", () => {
    const e1 = failureError({ attempts: 2, lockedUntil: null });
    assert.equal(e1.code, "INVALID_CREDENTIALS");
    assert.match(e1.message, /3$/);
    assert.equal(
      failureError({ attempts: 5, lockedUntil: NOW }).code,
      "ACCOUNT_LOCKED",
    );
  });

  it("blocks login while lockedUntil is in the future only", () => {
    const future = new Date(NOW.getTime() + 5 * 60 * 1000);
    assert.equal(
      codeOf(() =>
        assertNotTemporarilyLocked(user({ lockedUntil: future }), NOW),
      ),
      "ACCOUNT_LOCKED",
    );
    const past = new Date(NOW.getTime() - 1000);
    assert.equal(
      codeOf(() =>
        assertNotTemporarilyLocked(user({ lockedUntil: past }), NOW),
      ),
      "NONE",
    );
  });

  it("rejects pending and admin-locked accounts", () => {
    assert.equal(
      codeOf(() =>
        assertStatusAllowsLogin(user({ status: UserStatus.PENDING_EMAIL })),
      ),
      "EMAIL_NOT_VERIFIED",
    );
    assert.equal(
      codeOf(() =>
        assertStatusAllowsLogin(user({ status: UserStatus.LOCKED })),
      ),
      "ACCOUNT_SUSPENDED",
    );
    assert.equal(
      codeOf(() => assertStatusAllowsLogin(user())),
      "NONE",
    );
  });

  it("detects stale failure state that must be reset on success", () => {
    assert.equal(hasLoginFailureState(user()), false);
    assert.equal(hasLoginFailureState(user({ failedLoginAttempts: 2 })), true);
    assert.equal(hasLoginFailureState(user({ lockedUntil: NOW })), true);
  });
});
