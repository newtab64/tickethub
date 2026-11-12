import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { OutboxStatus } from "@tickethub/shared";
import { DrizzleOutboxStore } from "../src/contexts/notification/infrastructure/drizzle-outbox.store";
import { db, sqlClient } from "../src/database/db";
import { outbox } from "../src/database/schema";

describe("DrizzleOutboxStore against the real database", () => {
  const store = new DrizzleOutboxStore();
  const ids: string[] = [];
  const tag = `store-${Date.now()}`;

  async function insert(overrides: Partial<typeof outbox.$inferInsert> = {}) {
    const [row] = await db
      .insert(outbox)
      .values({
        eventType: "USER_REGISTERED",
        status: OutboxStatus.PENDING,
        payload: { email: `${tag}@x.vn`, marker: tag },
        ...overrides,
      })
      .returning();
    ids.push(row!.id);
    return row!;
  }

  after(async () => {
    await db.delete(outbox).where(inArray(outbox.id, ids));
    await sqlClient.end();
  });

  it("finds pending events by type, id and recipient email, oldest first", async () => {
    const a = await insert();
    await insert({ eventType: "SOMETHING_ELSE" });
    const found = await store.findPending({
      eventTypes: ["USER_REGISTERED"],
      onlyEmail: `${tag}@x.vn`,
      limit: 10,
      now: new Date(),
    });
    assert.deepEqual(
      found.map((f) => f.id),
      [a.id],
    );

    const byId = await store.findPending({
      eventTypes: ["USER_REGISTERED"],
      onlyId: a.id,
      limit: 1,
      now: new Date(),
    });
    assert.equal(byId.length, 1);
  });

  it("does not return events scheduled for a later retry", async () => {
    const later = await insert({
      nextRetryAt: new Date(Date.now() + 3_600_000),
    });
    const found = await store.findPending({
      eventTypes: ["USER_REGISTERED"],
      onlyId: later.id,
      limit: 1,
      now: new Date(),
    });
    assert.equal(found.length, 0);
  });

  it("lets only one of two concurrent claims win", async () => {
    const e = await insert();
    const results = await Promise.all([
      store.claim(e.id, new Date()),
      store.claim(e.id, new Date()),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
  });

  it("releases for retry, then completes only from PROCESSING", async () => {
    const e = await insert();
    assert.equal(await store.complete(e.id, new Date()), false); // PENDING chua hoan tat duoc

    assert.equal(await store.claim(e.id, new Date()), true);
    await store.releaseForRetry({
      id: e.id,
      retryCount: 1,
      nextRetryAt: new Date(Date.now() + 30_000),
      errorMessage: "redis down",
      now: new Date(),
    });
    const [released] = await db
      .select()
      .from(outbox)
      .where(eq(outbox.id, e.id));
    assert.equal(released?.status, OutboxStatus.PENDING);
    assert.equal(released?.retryCount, 1);
    assert.equal(released?.errorMessage, "redis down");

    await db
      .update(outbox)
      .set({ status: OutboxStatus.PROCESSING })
      .where(eq(outbox.id, e.id));
    assert.equal(await store.complete(e.id, new Date()), true);
    const done = await store.findById(e.id);
    assert.equal(done?.status, OutboxStatus.COMPLETED);
    assert.equal(await store.complete(e.id, new Date()), false);
  });

  it("marks a stale PROCESSING event FAILED only if it did not change since it was read", async () => {
    const old = new Date(Date.now() - 3_600_000);
    const e = await insert({ status: OutboxStatus.PROCESSING, updatedAt: old });

    const stale = await store.findStaleProcessing({
      eventType: "USER_REGISTERED",
      olderThan: new Date(Date.now() - 300_000),
      onlyId: e.id,
      limit: 20,
    });
    assert.equal(stale.length, 1);

    await db
      .update(outbox)
      .set({ updatedAt: new Date() })
      .where(eq(outbox.id, e.id));
    assert.equal(
      await store.markFailedIfUnchanged({
        event: stale[0]!,
        olderThan: new Date(Date.now() - 300_000),
        errorMessage: "x",
        now: new Date(),
      }),
      false,
    );

    await db.update(outbox).set({ updatedAt: old }).where(eq(outbox.id, e.id));
    const fresh = await store.findStaleProcessing({
      eventType: "USER_REGISTERED",
      olderThan: new Date(Date.now() - 300_000),
      onlyId: e.id,
      limit: 20,
    });
    assert.equal(
      await store.markFailedIfUnchanged({
        event: fresh[0]!,
        olderThan: new Date(Date.now() - 300_000),
        errorMessage: "exhausted",
        now: new Date(),
      }),
      true,
    );
    assert.equal((await store.findById(e.id))?.status, OutboxStatus.FAILED);
  });

  it("returns null for an unknown id", async () => {
    assert.equal(await store.findById(randomUUID()), null);
  });
});
