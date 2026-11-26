import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { OutboxStatus } from "@tickethub/shared";
import { db } from "../../../database/db";
import { outbox } from "../../../database/schema";
import type {
  OutboxStore,
  PendingOutboxEvent,
  PendingOutboxFilter,
  StaleOutboxEvent,
  StoredOutboxEvent,
} from "../domain/notification.ports";

export class DrizzleOutboxStore implements OutboxStore {
  findPending(filter: PendingOutboxFilter): Promise<PendingOutboxEvent[]> {
    return db
      .select({
        id: outbox.id,
        eventType: outbox.eventType,
        payload: outbox.payload,
        retryCount: outbox.retryCount,
      })
      .from(outbox)
      .where(
        and(
          eq(outbox.status, OutboxStatus.PENDING),
          inArray(outbox.eventType, filter.eventTypes),
          lte(outbox.nextRetryAt, filter.now),
          filter.onlyId ? eq(outbox.id, filter.onlyId) : undefined,
          filter.onlyEmail
            ? sql`lower(${outbox.payload} ->> 'email') = ${filter.onlyEmail}`
            : undefined,
        ),
      )
      .orderBy(asc(outbox.createdAt))
      .limit(filter.limit);
  }

  async claim(id: string, now: Date): Promise<boolean> {
    const [claimed] = await db
      .update(outbox)
      .set({ status: OutboxStatus.PROCESSING, updatedAt: now })
      .where(
        and(
          eq(outbox.id, id),
          eq(outbox.status, OutboxStatus.PENDING),
          lte(outbox.nextRetryAt, now),
        ),
      )
      .returning({ id: outbox.id });
    return Boolean(claimed);
  }

  async releaseForRetry(input: {
    id: string;
    retryCount: number;
    nextRetryAt: Date;
    errorMessage: string;
    now: Date;
  }): Promise<void> {
    await db
      .update(outbox)
      .set({
        status: OutboxStatus.PENDING,
        retryCount: input.retryCount,
        nextRetryAt: input.nextRetryAt,
        errorMessage: input.errorMessage,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(outbox.id, input.id),
          eq(outbox.status, OutboxStatus.PROCESSING),
        ),
      );
  }

  async findById(id: string): Promise<StoredOutboxEvent | null> {
    const [row] = await db
      .select({
        id: outbox.id,
        eventType: outbox.eventType,
        payload: outbox.payload,
        status: outbox.status,
      })
      .from(outbox)
      .where(eq(outbox.id, id))
      .limit(1);
    return row ?? null;
  }

  async complete(id: string, now: Date): Promise<boolean> {
    const [updated] = await db
      .update(outbox)
      .set({
        status: OutboxStatus.COMPLETED,
        errorMessage: null,
        updatedAt: now,
      })
      .where(and(eq(outbox.id, id), eq(outbox.status, OutboxStatus.PROCESSING)))
      .returning({ id: outbox.id });
    return Boolean(updated);
  }

  findStaleProcessing(input: {
    eventType: string;
    olderThan: Date;
    onlyId?: string | undefined;
    limit: number;
  }): Promise<StaleOutboxEvent[]> {
    return db
      .select({
        id: outbox.id,
        eventType: outbox.eventType,
        status: outbox.status,
        retryCount: outbox.retryCount,
        updatedAt: outbox.updatedAt,
      })
      .from(outbox)
      .where(
        and(
          eq(outbox.status, OutboxStatus.PROCESSING),
          eq(outbox.eventType, input.eventType),
          lte(outbox.updatedAt, input.olderThan),
          input.onlyId ? eq(outbox.id, input.onlyId) : undefined,
        ),
      )
      .orderBy(asc(outbox.updatedAt))
      .limit(input.limit);
  }

  async markFailedIfUnchanged(input: {
    event: StaleOutboxEvent;
    olderThan: Date;
    errorMessage: string;
    now: Date;
  }): Promise<boolean> {
    const [updated] = await db
      .update(outbox)
      .set({
        status: OutboxStatus.FAILED,
        errorMessage: input.errorMessage,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(outbox.id, input.event.id),
          eq(outbox.status, OutboxStatus.PROCESSING),
          lte(outbox.updatedAt, input.olderThan),
          eq(outbox.updatedAt, input.event.updatedAt),
        ),
      )
      .returning({ id: outbox.id });
    return Boolean(updated);
  }
}
