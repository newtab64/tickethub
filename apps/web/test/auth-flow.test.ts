import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  identifierSchema,
  isRegistrationConflict,
  isSafeInternalRedirect,
  passwordSchema,
  registerSchema,
  resolveActiveStep,
  resolvePostLoginRedirect,
} from "../src/features/identity/domain/auth-flow.ts";

describe("Identity auth flow: step resolution", () => {
  test("falls back to the identifier step when no identifier is in memory", () => {
    assert.equal(resolveActiveStep("password", ""), "identifier");
    assert.equal(resolveActiveStep("register", ""), "identifier");
    assert.equal(resolveActiveStep(null, "a@b.vn"), "identifier");
    assert.equal(resolveActiveStep("unknown", "a@b.vn"), "identifier");
  });

  test("allows steps 2a and 2b once an identifier is known", () => {
    assert.equal(resolveActiveStep("password", "a@b.vn"), "password");
    assert.equal(resolveActiveStep("register", "a@b.vn"), "register");
  });
});

describe("Identity auth flow: post-login redirect", () => {
  test("honours internal redirect targets", () => {
    assert.equal(
      resolvePostLoginRedirect("/my-tickets", "BUYER"),
      "/my-tickets",
    );
    assert.equal(
      resolvePostLoginRedirect("/events/1?x=1", undefined),
      "/events/1?x=1",
    );
  });

  test("ignores redirects back to the auth screens", () => {
    assert.equal(resolvePostLoginRedirect("/auth?step=password", "BUYER"), "/");
    assert.equal(resolvePostLoginRedirect("/login", "ADMIN"), "/admin");
  });

  test("rejects external and protocol-relative redirects (open redirect)", () => {
    for (const bad of [
      "//evil.com",
      "//evil.com/path",
      "/\\evil.com",
      "https://evil.com",
      "javascript:alert(1)",
      "evil.com",
      "",
    ]) {
      assert.equal(isSafeInternalRedirect(bad), false, bad);
      assert.equal(resolvePostLoginRedirect(bad, "BUYER"), "/", bad);
    }
    assert.equal(isSafeInternalRedirect(null), false);
  });

  test("falls back to the portal of the user's role", () => {
    assert.equal(resolvePostLoginRedirect(null, "ADMIN"), "/admin");
    assert.equal(
      resolvePostLoginRedirect(null, "ORGANIZER"),
      "/organizer/events",
    );
    assert.equal(resolvePostLoginRedirect(null, "BUYER"), "/");
    assert.equal(resolvePostLoginRedirect(null, undefined), "/");
  });
});

describe("Identity auth flow: registration conflict and schemas", () => {
  test("recognises a conflict by status or Vietnamese message", () => {
    assert.equal(isRegistrationConflict(409, "x"), true);
    assert.equal(isRegistrationConflict(400, "Email đã được sử dụng"), true);
    assert.equal(isRegistrationConflict(400, "Tài khoản TỒN TẠI"), true);
    assert.equal(isRegistrationConflict(500, "Lỗi máy chủ"), false);
  });

  test("validates the identifier as an email", () => {
    assert.equal(
      identifierSchema.safeParse({ identifier: "a@b.vn" }).success,
      true,
    );
    assert.equal(
      identifierSchema.safeParse({ identifier: " a@b.vn " }).success,
      true,
    );
    assert.equal(
      identifierSchema.safeParse({ identifier: "abc" }).success,
      false,
    );
    assert.equal(identifierSchema.safeParse({ identifier: "" }).success, false);
  });

  test("validates passwords and registration fields", () => {
    assert.equal(passwordSchema.safeParse({ password: "" }).success, false);
    assert.equal(passwordSchema.safeParse({ password: "x" }).success, true);
    assert.equal(
      registerSchema.safeParse({ fullName: "An", password: "12345678" })
        .success,
      true,
    );
    assert.equal(
      registerSchema.safeParse({ fullName: "A", password: "12345678" }).success,
      false,
    );
    assert.equal(
      registerSchema.safeParse({ fullName: "An", password: "1234567" }).success,
      false,
    );
  });
});
