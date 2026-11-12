import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { JwtService } from "@nestjs/jwt";
import { eq } from "drizzle-orm";
import { UserRole } from "@tickethub/shared";
import { createIdentityUseCases } from "../src/contexts/identity/identity.composition";
import { IdentityDomainError } from "../src/contexts/identity/domain/identity.errors";
import { db, sqlClient } from "../src/database/db";
import { users } from "../src/database/schema";
import { env } from "../src/config/env.config";

describe("Identity: concurrent registration with the same email", () => {
  const email = `race_${Date.now()}@tickethub.vn`;

  after(async () => {
    await db.delete(users).where(eq(users.email, email));
    await sqlClient.end();
  });

  it("lets exactly one request win and maps the loser to EMAIL_ALREADY_EXISTS", async () => {
    const identity = createIdentityUseCases(
      new JwtService({ secret: env.JWT_SECRET }),
    );
    const dto = {
      email,
      password: "Password123!",
      fullName: "Race Test",
      role: UserRole.BUYER,
    };

    const results = await Promise.allSettled([
      identity.register.execute(dto),
      identity.register.execute(dto),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0]!.reason instanceof IdentityDomainError);
    assert.equal(rejected[0]!.reason.code, "EMAIL_ALREADY_EXISTS");
  });
});
