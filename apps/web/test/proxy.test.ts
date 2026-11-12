import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { verifyJwt } from "../src/features/identity/api/jwt-verify.ts";

const SECRET = "tickethub-super-secret-development-jwt-key-2026-min-32-chars";

async function createSignedJwt(
  payload: Record<string, unknown>,
  secret = SECRET,
): Promise<string> {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = new TextEncoder().encode(`${header}.${payloadB64}`);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigB64 = Buffer.from(sig).toString("base64url");

  return `${header}.${payloadB64}.${sigB64}`;
}

describe("Next.js Edge Proxy: Cryptographic JWT Verification", () => {
  test("Xac thuc thanh cong JWT hop le cua ADMIN", async () => {
    const token = await createSignedJwt({
      sub: "user-admin-1",
      email: "admin@tickethub.vn",
      role: "ADMIN",
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    const verified = await verifyJwt(token);
    assert.ok(verified);
    assert.equal(verified.sub, "user-admin-1");
    assert.equal(verified.role, "ADMIN");
  });

  test("Xac thuc thanh cong JWT hop le cua ORGANIZER", async () => {
    const token = await createSignedJwt({
      sub: "user-org-1",
      email: "organizer@tickethub.vn",
      role: "ORGANIZER",
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    const verified = await verifyJwt(token);
    assert.ok(verified);
    assert.equal(verified.role, "ORGANIZER");
  });

  test("Tu choi token co chu ky bi gia mao", async () => {
    const validToken = await createSignedJwt({
      sub: "user-buyer-1",
      role: "BUYER",
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    // Gia mao payload thanh ADMIN ma khong ky lai
    const parts = validToken.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: "user-buyer-1",
        role: "ADMIN",
        exp: Math.floor(Date.now() / 1000) + 900,
      }),
    ).toString("base64url");
    const forgedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

    const verified = await verifyJwt(forgedToken);
    assert.equal(verified, null);
  });

  test("Tu choi token ky bang secret khac", async () => {
    const attackerSecret = "malicious-secret-key-at-least-32-chars-long";
    const forgedToken = await createSignedJwt(
      {
        sub: "attacker",
        role: "ADMIN",
        exp: Math.floor(Date.now() / 1000) + 900,
      },
      attackerSecret,
    );

    const verified = await verifyJwt(forgedToken);
    assert.equal(verified, null);
  });

  test("Tu choi token da het han (expired)", async () => {
    const expiredToken = await createSignedJwt({
      sub: "user-expired",
      role: "ADMIN",
      exp: Math.floor(Date.now() / 1000) - 60, // Het han 1 phut truoc
    });

    const verified = await verifyJwt(expiredToken);
    assert.equal(verified, null);
  });

  test("Tra ve null cho chuoi token rong hoac khong dung dinh dang", async () => {
    assert.equal(await verifyJwt(""), null);
    assert.equal(await verifyJwt(undefined), null);
    assert.equal(await verifyJwt("not-a-token"), null);
    assert.equal(await verifyJwt("part1.part2"), null);
    assert.equal(await verifyJwt("part1.part2.part3.part4"), null);
  });
});
