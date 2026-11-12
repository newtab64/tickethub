import { eq } from "drizzle-orm";
import { OutboxStatus, UserStatus } from "@tickethub/shared";
import { db } from "../../../database/db";
import { outbox, users } from "../../../database/schema";
import { identityErrors } from "../domain/identity.errors";
import type { UserRepository } from "../domain/identity.ports";
import type { NewUser, User } from "../domain/user.models";

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    fullName: row.fullName,
    passwordHash: row.passwordHash,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt,
    failedLoginAttempts: row.failedLoginAttempts,
    lockedUntil: row.lockedUntil,
  };
}

/** Ma loi PostgreSQL 23505 (unique_violation), ke ca khi bi boc trong cause. */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export class DrizzleUserRepository implements UserRepository {
  async findByEmail(email: string) {
    const row = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    return row ? toUser(row) : null;
  }

  async findById(id: string) {
    const row = await db.query.users.findFirst({ where: eq(users.id, id) });
    return row ? toUser(row) : null;
  }

  async createPendingWithOutbox(
    input: NewUser,
    buildVerificationToken: (userId: string) => Promise<string>,
  ) {
    try {
      return await this.insertPending(input, buildVerificationToken);
    } catch (error) {
      // Hai yeu cau dang ky dong thoi cung email: rang buoc unique cua DB thang cuoc.
      if (isUniqueViolation(error)) throw identityErrors.emailAlreadyExists();
      throw error;
    }
  }

  private insertPending(
    input: NewUser,
    buildVerificationToken: (userId: string) => Promise<string>,
  ) {
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash: input.passwordHash,
          fullName: input.fullName,
          phone: input.phone,
          role: input.role,
          status: UserStatus.PENDING_EMAIL,
          failedLoginAttempts: 0,
        })
        .returning();
      if (!created) throw new Error("Không thể tạo bản ghi người dùng");

      const verificationToken = await buildVerificationToken(created.id);

      await tx.insert(outbox).values({
        eventType: "USER_REGISTERED",
        payload: {
          userId: created.id,
          email: created.email,
          fullName: created.fullName,
          verificationToken,
        },
        status: OutboxStatus.PENDING,
      });

      return { user: toUser(created), verificationToken };
    });
  }

  async activate(userId: string, at: Date) {
    await db
      .update(users)
      .set({ status: UserStatus.ACTIVE, emailVerifiedAt: at, updatedAt: at })
      .where(eq(users.id, userId));
  }

  async recordFailedLogin(
    userId: string,
    attempts: number,
    lockedUntil: Date | null,
    at: Date,
  ) {
    await db
      .update(users)
      .set({ failedLoginAttempts: attempts, lockedUntil, updatedAt: at })
      .where(eq(users.id, userId));
  }

  async resetLoginFailures(userId: string, at: Date) {
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: at })
      .where(eq(users.id, userId));
  }
}
